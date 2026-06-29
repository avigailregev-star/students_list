'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTeacherInviteEmail } from '@/lib/email'

async function getResetCallbackUrl() {
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3001'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return `${protocol}://${host}/auth/reset-callback`
}

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

  let newUserId: string
  let inviteLink: string

  const resetCallbackUrl = await getResetCallbackUrl()

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { name },
      redirectTo: resetCallbackUrl,
    },
  })

  if (linkError) {
    if (!linkError.message.toLowerCase().includes('already')) {
      return `שגיאה ביצירת ההזמנה: ${linkError.message}`
    }
    // Auth user already exists — generate a recovery (password reset) link instead
    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: resetCallbackUrl },
    })
    if (recoveryError) return `שגיאה ביצירת קישור: ${recoveryError.message}`
    inviteLink = recoveryData.properties.action_link

    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existingUser = users?.find(u => u.email === email)
    if (!existingUser) return 'שגיאה: המשתמש קיים אך לא נמצא'
    newUserId = existingUser.id
  } else {
    newUserId = linkData.user.id
    inviteLink = linkData.properties.action_link
  }

  try {
    await sendTeacherInviteEmail({ teacherEmail: email, teacherName: name, inviteLink })
  } catch (e: unknown) {
    return `שגיאה בשליחת המייל: ${e instanceof Error ? e.message : String(e)}`
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
  await _requireAdmin('/admin')
  const supabase = createAdminClient()

  const resetCallbackUrl = await getResetCallbackUrl()

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: resetCallbackUrl },
  })
  if (error) return `שגיאה ביצירת קישור: ${error.message}`

  try {
    await sendTeacherInviteEmail({ teacherEmail: email, teacherName: name, inviteLink: data.properties.action_link })
  } catch (e: unknown) {
    return `שגיאה בשליחת המייל: ${e instanceof Error ? e.message : String(e)}`
  }
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
