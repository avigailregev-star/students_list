'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if ((user.user_metadata as Record<string,string>)?.role !== 'admin') redirect('/admin')
  return { supabase, userId: user.id }
}

export async function createEvent(formData: FormData) {
  const { supabase, userId } = await requireAdmin()

  const name      = formData.get('name') as string
  const eventType = formData.get('event_type') as string
  const startDate = formData.get('start_date') as string
  const endDate   = formData.get('end_date') as string || startDate

  const { error } = await supabase.from('school_events').insert({
    name, event_type: eventType, start_date: startDate, end_date: endDate, created_by: userId,
  })
  if (error) throw new Error('שגיאה ביצירת האירוע')
  revalidatePath('/admin/calendar')
}

export async function deleteEvent(eventId: string) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('school_events').delete().eq('id', eventId)
  if (error) throw new Error('שגיאה במחיקת האירוע')
  revalidatePath('/admin/calendar')
}
