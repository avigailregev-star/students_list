'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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
    })
    .eq('id', lessonId)

  if (error) throw new Error('שגיאה בשחזור השיעור')
  revalidatePath('/')
}
