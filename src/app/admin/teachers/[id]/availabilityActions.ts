'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth'

export async function adminAddAvailabilityRange(formData: FormData, teacherId: string): Promise<string | void> {
  await requireAdmin()
  const supabase = createAdminClient()

  const dayOfWeek = parseInt(formData.get('day_of_week') as string, 10)
  const startTime = formData.get('start_time') as string
  const endTime = formData.get('end_time') as string

  if (isNaN(dayOfWeek) || !startTime || !endTime) return 'כל השדות נדרשים'
  if (endTime <= startTime) return 'שעת הסיום חייבת להיות אחרי שעת ההתחלה'

  const { error } = await supabase
    .from('teacher_availability_ranges')
    .insert({ teacher_id: teacherId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime })

  if (error) return `שגיאת DB: ${error.message}`
  revalidatePath(`/admin/teachers/${teacherId}`)
}

export async function adminDeleteAvailabilityRange(id: string, teacherId: string): Promise<void> {
  await requireAdmin()
  const supabase = createAdminClient()

  await supabase
    .from('teacher_availability_ranges')
    .delete()
    .eq('id', id)
    .eq('teacher_id', teacherId)

  revalidatePath(`/admin/teachers/${teacherId}`)
}
