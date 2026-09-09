'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function submitExtraHoursRequest(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' }

  const workDate = String(formData.get('work_date') ?? '')
  const hours = Number(formData.get('hours') ?? 0)
  const minutesPart = Number(formData.get('minutes') ?? 0)
  const activityType = String(formData.get('activity_type') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim() || null
  const totalMinutes = hours * 60 + minutesPart

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return { error: 'נא לבחור תאריך' }
  if (!Number.isInteger(hours) || !Number.isInteger(minutesPart) || minutesPart < 0 || minutesPart > 59 || totalMinutes <= 0 || totalMinutes > 1440) {
    return { error: 'נא להזין משך תקין (עד 24 שעות)' }
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
