'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TeacherAvailability } from '@/types/database'

export async function addAvailabilitySlot(formData: FormData): Promise<string | void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dayOfWeek = parseInt(formData.get('day_of_week') as string, 10)
  const startTime = formData.get('start_time') as string
  const durationMinutes = parseInt(formData.get('duration_minutes') as string, 10) as 45 | 60
  const instrument = formData.get('instrument') as string
  const lessonType = formData.get('lesson_type') as 'individual' | 'group'
  const maxStudents = parseInt(formData.get('max_students') as string, 10) || 1

  if (isNaN(dayOfWeek) || !startTime || !instrument || isNaN(durationMinutes) || ![45, 60].includes(durationMinutes)) {
    return 'כל השדות נדרשים'
  }

  const { error } = await supabase
    .from('teacher_availability')
    .insert({
      teacher_id: user.id,
      day_of_week: dayOfWeek,
      start_time: startTime,
      duration_minutes: durationMinutes,
      instrument,
      lesson_type: lessonType,
      max_students: maxStudents,
    })

  if (error) return `שגיאת DB: ${error.message}`
  revalidatePath('/availability')
}

export async function toggleAvailabilitySlot(id: string, isActive: boolean): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('teacher_availability')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('teacher_id', user.id)

  if (error) throw new Error('שגיאה בעדכון הסלוט')
  revalidatePath('/availability')
}

export async function deleteAvailabilitySlot(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('teacher_availability')
    .delete()
    .eq('id', id)
    .eq('teacher_id', user.id)

  if (error) throw new Error('שגיאה במחיקת הסלוט')
  revalidatePath('/availability')
}

export async function getAvailabilitySlots(): Promise<{ slots: TeacherAvailability[]; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { slots: [], error: null }

  const { data, error } = await supabase
    .from('teacher_availability')
    .select('*')
    .eq('teacher_id', user.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) return { slots: [], error: error.message }
  return { slots: (data ?? []) as TeacherAvailability[], error: null }
}
