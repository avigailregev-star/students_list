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
  return `${protocol}://${host}/reset-password`
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

export type InviteResult = {
  error?: string
  link?: string
  newUserId?: string
}

export async function inviteTeacher(pendingId: string, email: string, name: string): Promise<InviteResult> {
  const { user: actor } = await _requireAdmin('/admin')
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
      return { error: `שגיאה ביצירת ההזמנה: ${linkError.message}` }
    }
    // Auth user already exists — generate a recovery (password reset) link instead
    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: resetCallbackUrl },
    })
    if (recoveryError) return { error: `שגיאה ביצירת קישור: ${recoveryError.message}` }
    inviteLink = recoveryData.properties.action_link

    newUserId = recoveryData.user.id
  } else {
    newUserId = linkData.user.id
    inviteLink = linkData.properties.action_link
  }

  const { error: dbError } = await supabase.rpc('merge_teacher_records', {
    p_actor_id: actor.id, p_source_id: pendingId, p_target_id: newUserId,
    p_name: name, p_email: email, p_pending_only: true,
  })
  if (dbError) return { error: 'שגיאה בשמירה: ' + dbError.message }
  revalidatePath('/admin/teachers')

  // Best-effort email send — the link is always returned to the caller so the
  // admin can copy/share it manually if the email is silently dropped (Gmail does this).
  try {
    await sendTeacherInviteEmail({ teacherEmail: email, teacherName: name, inviteLink })
  } catch (e: unknown) {
    console.error('[inviteTeacher] email send failed:', e)
  }

  return { link: inviteLink, newUserId }
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

export async function resendTeacherInvite(teacherId: string, email: string, name: string): Promise<InviteResult> {
  const { user: actor } = await _requireAdmin('/admin')
  const supabase = createAdminClient()

  const resetCallbackUrl = await getResetCallbackUrl()

  let inviteLink: string

  const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: resetCallbackUrl },
  })

  if (recoveryError) {
    // User doesn't exist in Auth yet — fall back to invite type
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: resetCallbackUrl, data: { name } },
    })

    let newUserId: string | undefined
    let newInviteLink: string | undefined

    if (!inviteError) {
      newUserId = inviteData.user.id
      newInviteLink = inviteData.properties.action_link
    } else {
      // invite also failed — try createUser + recovery as last resort
      // (happens when email is in a soft-deleted state in Supabase Auth)
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        user_metadata: { name },
        email_confirm: false,
      })
      if (createError) {
        // All attempts failed — report the original recovery error
        return { error: `שגיאה ביצירת קישור: ${recoveryError.message} (invite: ${inviteError.message})` }
      }
      newUserId = created.user.id

      // Generate recovery link for the freshly created user
      const { data: newRecovery, error: newRecoveryError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: resetCallbackUrl },
      })
      if (newRecoveryError) return { error: `שגיאה ביצירת קישור: ${newRecoveryError.message}` }
      newInviteLink = newRecovery.properties.action_link
    }

    const { error: mergeError } = await supabase.rpc('merge_teacher_records', {
      p_actor_id: actor.id, p_source_id: teacherId, p_target_id: newUserId,
      p_name: name, p_email: email, p_pending_only: false,
    })
    if (mergeError) return { error: 'שגיאה בשמירת המורה: ' + mergeError.message }

    inviteLink = newInviteLink!
  } else {
    inviteLink = recoveryData.properties.action_link
  }

  try {
    await sendTeacherInviteEmail({ teacherEmail: email, teacherName: name, inviteLink })
  } catch (e: unknown) {
    console.error('[resendTeacherInvite] email send failed:', e)
  }
  revalidatePath('/admin/teachers')
  return { link: inviteLink }
}

export async function mergeTeachers(pendingId: string, registeredId: string): Promise<string | void> {
  const { user: actor } = await _requireAdmin('/admin')
  const supabase = createAdminClient()

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(pendingId) || !UUID_RE.test(registeredId)) return 'מזהה לא תקין'
  if (pendingId === registeredId) return 'לא ניתן למזג מורה עם עצמה'

  const { data: pending } = await supabase
    .from('teachers')
    .select('id, is_pending')
    .eq('id', pendingId)
    .single()

  if (!pending) return 'המורה הממתינה לא נמצאה'
  if (!pending.is_pending) return 'ניתן למזג רק מורה ממתינה'

  const { error } = await supabase.rpc('merge_teacher_records', {
    p_actor_id: actor.id, p_source_id: pendingId, p_target_id: registeredId, p_pending_only: true,
  })
  if (error) return 'שגיאה במיזוג המורה: ' + error.message

  revalidatePath('/admin/teachers')
  redirect(`/admin/teachers/${registeredId}`)
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
