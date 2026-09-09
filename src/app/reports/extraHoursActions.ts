'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function submitExtraHoursRequest(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' }

  const workDate = String(formData.get('work_date') ?? '')
  const unitMinutes = Number(formData.get('unit_minutes') ?? 0)
  const quantity = Number(formData.get('quantity') ?? 0)
  const activityType = String(formData.get('activity_type') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim() || null
  const totalMinutes = unitMinutes * quantity

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return { error: 'נא לבחור תאריך' }
  if (![30, 45, 60].includes(unitMinutes) || !Number.isInteger(quantity) || quantity < 1 || quantity > 32 || totalMinutes > 1440) {
    return { error: 'נא לבחור אורך יחידה וכמות תקינים (עד 24 שעות)' }
  }
  if (!activityType) return { error: 'נא לבחור סוג פעילות' }

  const { error } = await supabase.from('extra_hours_requests').insert({
    teacher_id: user.id,
    work_date: workDate,
    minutes: totalMinutes,
    activity_type: activityType,
    note,
  })
  if (error) return { error: 'שגיאה בשליחת הבקשה: ' + error.message }

  revalidatePath('/reports')
  revalidatePath('/admin/extra-hours')
  return {}
}
