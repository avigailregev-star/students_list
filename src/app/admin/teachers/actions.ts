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

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/`,
  })

  let newUserId: string

  if (inviteError) {
    if (!inviteError.message.toLowerCase().includes('already')) {
      return `שגיאה בשליחת ההזמנה: ${inviteError.message}`
    }
    // Auth user already exists from a previous attempt — send a password reset email instead
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/`,
    })
    if (resetError) return `שגיאה בשליחת המייל: ${resetError.message}`

    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existingUser = users?.find(u => u.email === email)
    if (!existingUser) return 'שגיאה: המשתמש קיים אך לא נמצא'
    newUserId = existingUser.id
  } else {
    newUserId = inviteData.user.id
  }

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
