'use server'

import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const { supabase } = await _requireAdmin('/admin')
  return supabase
}

export async function addRoom(name: string): Promise<{ error?: string }> {
  const supabase = await requireAdmin()
  if (!name.trim()) return { error: 'שם החדר לא יכול להיות ריק' }
  const { error } = await supabase.from('rooms').insert({ name: name.trim() })
  if (error) return { error: error.message }
  revalidatePath('/admin/rooms')
  return {}
}

export async function deleteRoom(id: string): Promise<{ error?: string }> {
  const supabase = await requireAdmin()
  // Check for active assignments first
  const { count, error: countError } = await supabase
    .from('teacher_room_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', id)
  if (countError) return { error: 'שגיאה בבדיקת השיבוצים: ' + countError.message }
  if ((count ?? 0) > 0) return { error: 'לא ניתן למחוק חדר עם שיבוצים פעילים. הסירי את השיבוצים תחילה.' }
  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/rooms')
  return {}
}

export async function assignRoom(
  roomId: string,
  teacherId: string,
  dayOfWeek: number
): Promise<{ error?: string }> {
  const supabase = await requireAdmin()
  if (dayOfWeek < 0 || dayOfWeek > 6) return { error: 'יום בשבוע לא תקין' }
  // Upsert: if (room_id, day_of_week) already exists, update teacher_id
  const { error } = await supabase
    .from('teacher_room_assignments')
    .upsert(
      { room_id: roomId, teacher_id: teacherId, day_of_week: dayOfWeek },
      { onConflict: 'room_id,day_of_week' }
    )
  if (error) return { error: error.message }
  revalidatePath('/admin/rooms')
  return {}
}

export async function removeAssignment(
  roomId: string,
  dayOfWeek: number
): Promise<{ error?: string }> {
  const supabase = await requireAdmin()
  if (dayOfWeek < 0 || dayOfWeek > 6) return { error: 'יום בשבוע לא תקין' }
  const { error } = await supabase
    .from('teacher_room_assignments')
    .delete()
    .eq('room_id', roomId)
    .eq('day_of_week', dayOfWeek)
  if (error) return { error: error.message }
  revalidatePath('/admin/rooms')
  return {}
}
