'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendMessage(content: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' }

  const trimmed = content.trim()
  if (!trimmed) return { error: 'ההודעה לא יכולה להיות ריקה' }

  const { error } = await supabase.from('messages').insert({
    teacher_id: user.id,
    content: trimmed,
  })
  if (error) return { error: 'שגיאה בשליחת ההודעה: ' + error.message }

  revalidatePath('/my-room')
  return {}
}
