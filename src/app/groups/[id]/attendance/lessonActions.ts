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

  const admin = createAdminClient()

  // Verify ownership
  const { data: lessonForAuth } = await admin.from('lessons').select('group_id').eq('id', lessonId).single()
  if (!lessonForAuth) throw new Error('שיעור לא נמצא')
  const { data: ownedGroup } = await supabase
    .from('groups')
    .select('id')
    .eq('id', lessonForAuth.group_id)
    .eq('teacher_id', user.id)
    .single()
  if (!ownedGroup) throw new Error('אין הרשאה')

  const ADVANCE_NOTICE_REASON = 'ביטול מוצדק של תלמיד (עד שניים בשנה)'
  const isAdvanceNotice = reason === ADVANCE_NOTICE_REASON
  const hasMakeup = (reason === 'ביטול מורה עם השלמה' || isAdvanceNotice) && notes && makeupStartTime

  // Create the makeup lesson record first (so we have its ID for the update)
  let makeupLessonId: string | null = null
  if (hasMakeup) {
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

export async function deleteMakeupLesson(makeupLessonId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: makeupLesson, error: fetchErr } = await admin
    .from('lessons')
    .select('group_id')
    .eq('id', makeupLessonId)
    .single()

  if (fetchErr || !makeupLesson) {
    return { ok: false, error: 'שיעור לא נמצא: ' + (fetchErr?.message ?? 'null') }
  }

  // Verify ownership
  const { data: ownedGroup, error: groupErr } = await supabase
    .from('groups')
    .select('id')
    .eq('id', makeupLesson.group_id)
    .eq('teacher_id', user.id)
    .single()

  if (groupErr || !ownedGroup) {
    return { ok: false, error: 'אין הרשאה: ' + (groupErr?.message ?? 'group not found') }
  }

  // Clear makeup reference from the original lesson
  const { error: clearErr } = await admin
    .from('lessons')
    .update({ makeup_lesson_id: null, makeup_start_time: null })
    .eq('makeup_lesson_id', makeupLessonId)

  if (clearErr) return { ok: false, error: 'שגיאה בניקוי הפניה: ' + clearErr.message }

  // Delete attendance records first (foreign key constraint)
  const { error: attErr } = await admin.from('attendance').delete().eq('lesson_id', makeupLessonId)
  if (attErr) return { ok: false, error: 'שגיאה במחיקת נוכחות: ' + attErr.message }

  const { error: deleteErr } = await admin.from('lessons').delete().eq('id', makeupLessonId)
  if (deleteErr) return { ok: false, error: 'שגיאה במחיקת השיעור: ' + deleteErr.message }

  revalidatePath('/')
  return { ok: true }
}

export async function restoreLesson(lessonId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch group_id + makeup_lesson_id, and verify ownership
  const { data: origLesson } = await admin
    .from('lessons')
    .select('group_id, makeup_lesson_id')
    .eq('id', lessonId)
    .single()
  if (!origLesson) throw new Error('שיעור לא נמצא')

  const { data: ownedGroup } = await supabase
    .from('groups')
    .select('id')
    .eq('id', origLesson.group_id)
    .eq('teacher_id', user.id)
    .single()
  if (!ownedGroup) throw new Error('אין הרשאה')

  const makeupLessonId = origLesson?.makeup_lesson_id ?? null

  // If the makeup lesson already has recorded attendance (i.e. it was already
  // taught and is payroll-relevant), don't destroy it when undoing the
  // cancellation — just unlink it and leave it as a standalone lesson.
  let shouldDeleteMakeup = false
  let makeupGoogleEventId: string | null = null
  if (makeupLessonId) {
    const { data: makeupAttendance } = await admin
      .from('attendance')
      .select('id')
      .eq('lesson_id', makeupLessonId)
      .single()
    shouldDeleteMakeup = !makeupAttendance

    if (shouldDeleteMakeup) {
      const { data: makeupLesson } = await admin
        .from('lessons')
        .select('google_event_id')
        .eq('id', makeupLessonId)
        .single()
      makeupGoogleEventId = makeupLesson?.google_event_id ?? null
    }
  }

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

  if (makeupLessonId && shouldDeleteMakeup) {
    const { error: deleteErr } = await admin.from('lessons').delete().eq('id', makeupLessonId)
    if (deleteErr) throw new Error('שגיאה במחיקת שיעור ההשלמה')
  }

  revalidatePath('/')
  revalidatePath('/groups/[id]/attendance', 'page')

  // Delete the makeup lesson's GCal event (fire-and-forget, best-effort)
  if (makeupGoogleEventId) {
    void (async () => {
      try {
        await deleteGCalEvent(user.id, makeupGoogleEventId!)
      } catch (e) {
        console.error('restoreLesson: makeup GCal cleanup failed', e)
      }
    })()
  }
}
