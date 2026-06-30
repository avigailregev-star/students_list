'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { deleteGCalEvent, pushLesson } from '@/lib/googleCalendar'

function computeMakeupEndTime(makeupStart: string, schedule: { start_time: string; end_time: string | null }): string {
  if (schedule.end_time) {
    const [sh, sm] = schedule.start_time.slice(0, 5).split(':').map(Number)
    const [eh, em] = schedule.end_time.slice(0, 5).split(':').map(Number)
    const durationMin = eh * 60 + em - (sh * 60 + sm)
    const [mh, mm] = makeupStart.split(':').map(Number)
    const endMin = mh * 60 + mm + durationMin
    return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
  }
  const [mh, mm] = makeupStart.split(':').map(Number)
  const endMin = mh * 60 + mm + 45
  return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
}

export async function cancelLesson(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const lessonId = formData.get('lesson_id') as string
  const reason = formData.get('reason') as string
  const notes = formData.get('notes') as string          // makeup date "YYYY-MM-DD"
  const makeupStartTime = formData.get('makeup_start_time') as string  // "HH:MM"
  const isSickLeave = formData.get('is_sick_leave') === 'true'
  const documentUrl = formData.get('document_url') as string | null

  const ADVANCE_NOTICE_REASON = 'ביטול מוצדק של תלמיד (עד שניים בשנה)'
  const isAdvanceNotice = reason === ADVANCE_NOTICE_REASON
  const hasMakeup = (reason === 'ביטול מורה עם השלמה' || isAdvanceNotice) && notes && makeupStartTime

  // Create the makeup lesson record first (so we have its ID for the update)
  let makeupLessonId: string | null = null
  if (hasMakeup) {
    const admin = createAdminClient()
    const { data: orig } = await admin
      .from('lessons')
      .select('group_id')
      .eq('id', lessonId)
      .single()

    if (orig) {
      const { data: makeupLesson, error: mkErr } = await admin
        .from('lessons')
        .insert({
          group_id: orig.group_id,
          date: notes,
          start_time: makeupStartTime + ':00',
          status: 'scheduled',
          is_makeup: true,
          teacher_absence_reason: isAdvanceNotice ? 'השלמת ביטול מוצדק' : reason,
        })
        .select('id')
        .single()

      if (mkErr) throw new Error('שגיאה ביצירת שיעור ההשלמה')
      makeupLessonId = makeupLesson.id
    }
  }

  const { error } = await supabase
    .from('lessons')
    .update({
      status: 'teacher_canceled',
      teacher_absence_reason: reason,
      cancellation_notes: notes || null,
      makeup_start_time: makeupStartTime || null,
      makeup_lesson_id: makeupLessonId,
      is_sick_leave: isSickLeave,
      admin_approval_status: isSickLeave ? 'pending' : null,
      sick_leave_document_url: documentUrl || null,
    })
    .eq('id', lessonId)

  if (error) throw new Error('שגיאה בביטול השיעור')

  revalidatePath('/')
  revalidatePath('/groups/[id]/attendance', 'page')

  // Google Calendar operations (fire-and-forget)
  void (async () => {
    try {
      const admin = createAdminClient()
      const { data: lesson } = await admin
        .from('lessons')
        .select('google_event_id, group_id, groups(name, group_schedules(start_time, end_time))')
        .eq('id', lessonId)
        .single()

      // Delete original GCal event
      if (lesson?.google_event_id) {
        await deleteGCalEvent(user.id, lesson.google_event_id)
        await admin.from('lessons').update({ google_event_id: null }).eq('id', lessonId)
      }

      // Push makeup lesson to GCal
      if (makeupLessonId && lesson?.groups && hasMakeup) {
        const schedule = (lesson.groups as any).group_schedules?.[0] ?? { start_time: '00:00:00', end_time: null }
        const makeupEndTime = computeMakeupEndTime(makeupStartTime, schedule)
        const gcalEventId = await pushLesson(user.id, {
          id: makeupLessonId,
          groupName: `השלמה: ${(lesson.groups as any).name}`,
          date: notes,
          startTime: makeupStartTime + ':00',
          endTime: makeupEndTime,
        })
        if (gcalEventId) {
          await admin.from('lessons').update({ google_event_id: gcalEventId }).eq('id', makeupLessonId)
        }
      }
    } catch (e) {
      console.error('cancelLesson: google operations failed', e)
    }
  })()
}

export async function deleteMakeupLesson(makeupLessonId: string): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch the makeup lesson with admin client (no RLS)
  const { data: makeupLesson } = await admin
    .from('lessons')
    .select('google_event_id, group_id')
    .eq('id', makeupLessonId)
    .single()

  if (!makeupLesson) throw new Error('שיעור לא נמצא')

  const groupId = makeupLesson.group_id as string

  // Verify ownership: teacher's client (with RLS) can only see their own groups
  const { data: ownedGroup } = await supabase
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .single()

  if (!ownedGroup) throw new Error('אין הרשאה')

  // Clear makeup reference from the original lesson
  await admin
    .from('lessons')
    .update({ makeup_lesson_id: null, makeup_start_time: null })
    .eq('makeup_lesson_id', makeupLessonId)

  // Delete attendance records first (foreign key constraint)
  await admin.from('attendance').delete().eq('lesson_id', makeupLessonId)

  // Delete GCal event (fire-and-forget)
  if (makeupLesson.google_event_id) {
    void deleteGCalEvent(user.id, makeupLesson.google_event_id).catch(() => null)
  }

  const { error } = await admin.from('lessons').delete().eq('id', makeupLessonId)
  if (error) throw new Error('שגיאה במחיקת שיעור ההשלמה: ' + error.message)

  revalidatePath('/')
  revalidatePath('/groups/[id]/attendance', 'page')

  return groupId
}

export async function restoreLesson(lessonId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch makeup_lesson_id before updating
  const { data: origLesson } = await supabase
    .from('lessons')
    .select('makeup_lesson_id')
    .eq('id', lessonId)
    .single()

  const makeupLessonId = origLesson?.makeup_lesson_id ?? null

  const { error } = await supabase
    .from('lessons')
    .update({
      status: 'scheduled',
      teacher_absence_reason: null,
      is_sick_leave: false,
      admin_approval_status: null,
      cancellation_notes: null,
      sick_leave_document_url: null,
      makeup_lesson_id: null,
      makeup_start_time: null,
    })
    .eq('id', lessonId)

  if (error) throw new Error('שגיאה בשחזור השיעור')

  revalidatePath('/')
  revalidatePath('/groups/[id]/attendance', 'page')

  // Delete makeup lesson + its GCal event (fire-and-forget)
  if (makeupLessonId) {
    void (async () => {
      try {
        const admin = createAdminClient()
        const { data: makeupLesson } = await admin
          .from('lessons')
          .select('google_event_id')
          .eq('id', makeupLessonId)
          .single()

        if (makeupLesson?.google_event_id) {
          await deleteGCalEvent(user.id, makeupLesson.google_event_id)
        }

        await admin.from('lessons').delete().eq('id', makeupLessonId)
      } catch (e) {
        console.error('restoreLesson: makeup cleanup failed', e)
      }
    })()
  }
}
