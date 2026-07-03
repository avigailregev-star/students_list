'use server'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const { supabase } = await _requireAdmin('/admin')
  return { supabase }
}

export async function replyToMessage(id: string, reply: string): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin()

  const trimmed = reply.trim()
  if (!trimmed) return { error: 'התשובה לא יכולה להיות ריקה' }

  const { error } = await supabase
    .from('messages')
    .update({
      reply: trimmed,
      status: 'replied',
      replied_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: 'שגיאה בשמירת התשובה: ' + error.message }
  revalidatePath('/admin/messages')
  return {}
}

export async function sendAdminMessage(
  teacherId: string | 'all',
  content: string
): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin()

  const trimmed = content.trim()
  if (!trimmed) return { error: 'ההודעה לא יכולה להיות ריקה' }

  if (teacherId === 'all') {
    const admin = createAdminClient()
    const { data: teachers, error: fetchErr } = await admin
      .from('teachers')
      .select('id')
      .neq('role', 'admin')

    if (fetchErr) return { error: 'שגיאה בטעינת רשימת המורות: ' + fetchErr.message }
    if (!teachers?.length) return { error: 'לא נמצאו מורות' }

    const rows = teachers.map(t => ({
      teacher_id: t.id,
      content: trimmed,
      from_admin: true,
    }))

    const { error } = await admin.from('messages').insert(rows)
    if (error) return { error: 'שגיאה בשליחת ההודעות: ' + error.message }
  } else {
    const { error } = await supabase.from('messages').insert({
      teacher_id: teacherId,
      content: trimmed,
      from_admin: true,
    })
    if (error) return { error: 'שגיאה בשליחת ההודעה: ' + error.message }
  }

  revalidatePath('/admin/messages')
  return {}
}
