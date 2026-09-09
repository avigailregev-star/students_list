'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

function refreshReports(teacherId?: string) {
  revalidatePath('/admin/extra-hours')
  revalidatePath('/reports')
  revalidatePath('/reports/payroll')
  if (teacherId) revalidatePath(`/admin/teachers/${teacherId}/reports`)
}

export async function decideExtraHours(id: string, status: 'approved' | 'rejected', minutes: number, adminNote?: string): Promise<{ error?: string }> {
  const { user } = await requireAdmin()
  if (!id || !['approved', 'rejected'].includes(status)) return { error: 'בקשה לא תקינה' }
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 1440) return { error: 'משך הזמן אינו תקין' }
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('extra_hours_requests').update({ status, minutes, admin_note: adminNote?.trim() || null, decided_by: user.id, decided_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending').select('teacher_id').single()
  if (error) return { error: 'שגיאה בעדכון הבקשה: ' + error.message }
  refreshReports(data?.teacher_id)
  return {}
}

export async function addExtraHours(formData: FormData): Promise<{ error?: string }> {
  const { user } = await requireAdmin()
  const teacherId = String(formData.get('teacher_id') ?? '')
  const workDate = String(formData.get('work_date') ?? '')
  const unitMinutes = Number(formData.get('unit_minutes') ?? 0)
  const quantity = Number(formData.get('quantity') ?? 0)
  const minutes = unitMinutes * quantity
  const activityType = String(formData.get('activity_type') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim() || null
  if (!teacherId || !/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !activityType) return { error: 'נא למלא את כל שדות החובה' }
  if (![30, 45, 60].includes(unitMinutes) || !Number.isInteger(quantity) || quantity < 1 || quantity > 32 || minutes > 1440) return { error: 'אורך היחידה או הכמות אינם תקינים' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('extra_hours_requests').insert({ teacher_id: teacherId, work_date: workDate, minutes, activity_type: activityType, note, status: 'approved', source: 'admin', decided_by: user.id, decided_at: new Date().toISOString() })
  if (error) return { error: 'שגיאה בהוספת השעות: ' + error.message }
  refreshReports(teacherId)
  return {}
}
