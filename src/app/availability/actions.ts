'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TeacherAvailabilityRange } from '@/types/database'

export async function getAvailabilityRanges(): Promise<{ ranges: TeacherAvailabilityRange[]; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ranges: [], error: null }

  const { data, error } = await supabase
    .from('teacher_availability_ranges')
    .select('*')
    .eq('teacher_id', user.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) return { ranges: [], error: error.message }
  return { ranges: (data ?? []) as TeacherAvailabilityRange[], error: null }
}

export async function addAvailabilityRange(formData: FormData): Promise<string | void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dayOfWeek = parseInt(formData.get('day_of_week') as string, 10)
  const startTime = formData.get('start_time') as string
  const endTime = formData.get('end_time') as string

  if (isNaN(dayOfWeek) || !startTime || !endTime) return 'כל השדות נדרשים'
  if (endTime <= startTime) return 'שעת הסיום חייבת להיות אחרי שעת ההתחלה'

  const { error } = await supabase
    .from('teacher_availability_ranges')
    .insert({ teacher_id: user.id, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime })

  if (error) return `שגיאת DB: ${error.message}`
  revalidatePath('/availability')
}

export async function deleteAvailabilityRange(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('teacher_availability_ranges')
    .delete()
    .eq('id', id)
    .eq('teacher_id', user.id)

  revalidatePath('/availability')
}
