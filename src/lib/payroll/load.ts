import type { SupabaseClient } from '@supabase/supabase-js'
import { calculatePayroll, israelToday, type PayrollGroup, type PayrollLesson, type PayrollExtraHours } from './calculate'

// An empty page ends the scan, even when the server is configured to return
// fewer than the requested 500 rows. Failed reads must never become zero pay.
export async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (;;) {
    const { data, error } = await query(rows.length, rows.length + 499)
    if (error) throw new Error(`לא ניתן להשלים את דוח השעות: ${error.message}`)
    if (!data) throw new Error('לא התקבלו נתונים לדוח השעות')
    if (!data.length) return rows
    rows.push(...data)
  }
}
export async function loadPayroll(supabase: SupabaseClient, teacherId: string, today = israelToday()) {
  const [groups, extraHours] = await Promise.all([
    readAll<PayrollGroup>((from, to) => supabase.from('groups')
      .select('id, lesson_type, group_schedules(day_of_week, start_time, end_time)').eq('teacher_id', teacherId).order('id').range(from, to)),
    readAll<PayrollExtraHours>((from, to) => supabase.from('extra_hours_requests')
      .select('id, work_date, minutes, activity_type, status').eq('teacher_id', teacherId).eq('status', 'approved')
      .lte('work_date', today).order('id').range(from, to)),
  ])
  const lessons: PayrollLesson[] = []
  // Keep URLs bounded as the number of groups/lessons grows.
  for (let i = 0; i < groups.length; i += 100) {
    const ids = groups.slice(i, i + 100).map(g => g.id)
    lessons.push(...await readAll<PayrollLesson>((from, to) => supabase.from('lessons')
      .select('id, group_id, date, start_time, status, is_holiday, is_makeup, teacher_absence_reason, admin_approval_status, created_at, makeup_lesson_id, payroll_lesson_type, payroll_units, payroll_occurrence_key, payroll_source_lesson_id, payroll_snapshot_origin')
      .in('group_id', ids).eq('is_holiday', false).lte('date', today).order('id').range(from, to)))
  }
  const attendanceIds = new Set<string>()
  for (let i = 0; i < lessons.length; i += 100) {
    const ids = lessons.slice(i, i + 100).map(l => l.id)
    const rows = await readAll<{ lesson_id: string }>((from, to) => supabase.from('attendance')
      .select('lesson_id').in('lesson_id', ids).order('id').range(from, to))
    for (const row of rows) attendanceIds.add(row.lesson_id)
  }
  return calculatePayroll({ groups, lessons, attendanceIds, extraHours, today })
}
