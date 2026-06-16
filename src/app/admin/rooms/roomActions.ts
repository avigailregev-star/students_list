'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addRoom(name: string): Promise<{ error?: string }> {
  if (!name.trim()) return { error: 'שם החדר לא יכול להיות ריק' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('rooms').insert({ name: name.trim() })
  if (error) return { error: error.message }
  revalidatePath('/admin/rooms')
  return {}
}

export async function deleteRoom(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  // Check for active assignments first
  const { count } = await supabase
    .from('teacher_room_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', id)
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
  const supabase = createAdminClient()
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
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('teacher_room_assignments')
    .delete()
    .eq('room_id', roomId)
    .eq('day_of_week', dayOfWeek)
  if (error) return { error: error.message }
  revalidatePath('/admin/rooms')
  return {}
}
