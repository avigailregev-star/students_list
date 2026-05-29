'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Create auth user with the SAME UUID as the pending profile
  const { error: authError } = await supabase.auth.admin.createUser({
    id: pendingId,
    email,
    email_confirm: true,
    user_metadata: { name },
  })
  if (authError) return `שגיאה ביצירת חשבון: ${authError.message}`

  // Mark teacher as active and set email
  const { error: dbError } = await supabase
    .from('teachers')
    .update({ email, is_pending: false })
    .eq('id', pendingId)

  if (dbError) return `שגיאה בעדכון: ${dbError.message}`
  revalidatePath('/admin/teachers')
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
