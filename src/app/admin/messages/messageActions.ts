'use server'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
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
