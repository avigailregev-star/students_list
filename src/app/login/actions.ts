'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export async function transferTeacherGroups(oldId: string, newId: string): Promise<void> {
  await requireAdmin()
  if (!oldId || !newId || oldId === newId) throw new Error('מזהים לא תקינים')
  const supabase = createAdminClient()
  const { error } = await supabase.from('groups').update({ teacher_id: newId }).eq('teacher_id', oldId)
  if (error) throw new Error('העברת הקבוצות נכשלה')
}

// No lookup by display name and no caller-supplied account id. Pending records
// are connected only by the administrator's invitation/merge workflow.
export async function registerTeacherProfile(name: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email_confirmed_at || !user.email) return { error: 'יש לאמת את כתובת האימייל ולהתחבר לפני השלמת ההרשמה' }
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 120) return { error: 'נא להזין שם מלא תקין' }
  const admin = createAdminClient()
  const { error } = await admin.from('teachers').upsert({
    id: user.id, name: trimmed, email: user.email, role: 'teacher', is_pending: false,
  }, { onConflict: 'id', ignoreDuplicates: true })
  return error ? { error: 'לא ניתן להשלים את ההרשמה. נסי שוב או פני למנהלת.' } : {}
}
