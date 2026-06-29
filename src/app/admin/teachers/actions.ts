'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTeacherInviteEmail } from '@/lib/email'

async function requireAdmin() {
  const { supabase } = await _requireAdmin('/admin')
  return supabase
}

export async function updateTeacher(formData: FormData) {
  const supabase = await requireAdmin()

  const teacherId = formData.get('teacher_id') as string
  const name = formData.get('name') as string

  const { error } = await supabase
    .from('teachers')
    .update({ name })
    .eq('id', teacherId)

  if (error) throw new Error('שגיאה בעדכון המורה')
  revalidatePath('/admin/teachers')
}

export async function createPendingTeacher(name: string): Promise<string | void> {
  await _requireAdmin('/admin')
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (e) {
    return `שגיאת הגדרה: SUPABASE_SERVICE_ROLE_KEY חסר. פנה למנהל המערכת.`
  }

  const { error } = await supabase
    .from('teachers')
    .insert({ name, role: 'teacher', is_pending: true })

  if (error) return `שגיאת DB: ${error.message}`
  revalidatePath('/admin/teachers')
}

export async function inviteTeacher(pendingId: string, email: string, name: string): Promise<string | void> {
  await _requireAdmin('/admin')
  const supabase = createAdminClient()

  // Supabase sends the invite email automatically via its own email service (noreply@mail.app.supabase.io)
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/`,
  })
  if (inviteError) return `שגיאה בשליחת ההזמנה: ${inviteError.message}`

  const newUserId = inviteData.user.id

  // Replace the pending placeholder with the real auth user UUID
  await supabase.from('teachers').delete().eq('id', pendingId)
  const { error: dbError } = await supabase
    .from('teachers')
    .insert({ id: newUserId, name, email, role: 'teacher', is_pending: false })

  if (dbError) return `שגיאה בשמירה: ${dbError.message}`
  revalidatePath('/admin/teachers')
  redirect(`/admin/teachers/${newUserId}`)
}

export async function resetTeacherToPending(teacherId: string): Promise<string | void> {
  await _requireAdmin('/admin')
  const supabase = createAdminClient()

  // Remove the auth user so they can be re-invited
  await supabase.auth.admin.deleteUser(teacherId)

  const { error } = await supabase
    .from('teachers')
    .update({ email: null, is_pending: true })
    .eq('id', teacherId)

  if (error) return `שגיאה: ${error.message}`
  revalidatePath('/admin/teachers')
}

export async function resendTeacherInvite(teacherId: string, email: string, name: string): Promise<string | void> {
  const { supabase } = await _requireAdmin('/admin')

  // Use Supabase's own email delivery (same infrastructure as initial invite)
  // This avoids Gmail deliverability issues with custom domains like rutidimona.xyz
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/`,
  })
  if (error) return `שגיאה בשליחת המייל: ${error.message}`
}

export async function deleteTeacher(teacherId: string) {
  const supabase = await requireAdmin()

  // Don't allow deleting yourself
  const { data: { user } } = await supabase.auth.getUser()
  if (teacherId === user?.id) throw new Error('לא ניתן למחוק את עצמך')

  const { error } = await supabase.from('teachers').delete().eq('id', teacherId)
  if (error) throw new Error('שגיאה במחיקת המורה')

  revalidatePath('/admin/teachers')
  redirect('/admin/teachers')
}
