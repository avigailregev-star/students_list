'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { deleteGCalEvent } from '@/lib/googleCalendar'

export async function cancelLesson(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const lessonId = formData.get('lesson_id') as string
  const reason = formData.get('reason') as string
  const notes = formData.get('notes') as string
  const isSickLeave = formData.get('is_sick_leave') === 'true'
  const documentUrl = formData.get('document_url') as string | null

  const { error } = await supabase
    .from('lessons')
    .update({
      status: 'teacher_canceled',
      teacher_absence_reason: reason,
      cancellation_notes: notes || null,
      is_sick_leave: isSickLeave,
      admin_approval_status: isSickLeave ? 'pending' : null,
      sick_leave_document_url: documentUrl || null,
    })
    .eq('id', lessonId)

  if (error) throw new Error('שגיאה בביטול השיעור')

  revalidatePath('/')
  revalidatePath('/groups/[id]/attendance', 'page')

  // Delete from teacher's Google Calendar (fire-and-forget)
  void (async () => {
    try {
      const admin = createAdminClient()
      const { data: lesson } = await admin
        .from('lessons').select('google_event_id').eq('id', lessonId).single()
      if (lesson?.google_event_id) {
        await deleteGCalEvent(user.id, lesson.google_event_id)
        await admin.from('lessons').update({ google_event_id: null }).eq('id', lessonId)
      }
    } catch (e) {
      console.error('cancelLesson: google delete failed', e)
    }
  })()
}

export async function restoreLesson(lessonId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('lessons')
    .update({
      status: 'scheduled',
      teacher_absence_reason: null,
      is_sick_leave: false,
      admin_approval_status: null,
      cancellation_notes: null,
      sick_leave_document_url: null,
    })
    .eq('id', lessonId)

  if (error) throw new Error('שגיאה בשחזור השיעור')
  revalidatePath('/')
  revalidatePath('/groups/[id]/attendance', 'page')
}
