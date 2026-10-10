import { createClient } from '@/lib/supabase/server'
import type { Attendance, Student } from '@/types/database'

export async function getStudentsByGroup(groupId: string, includeInactive = false): Promise<Student[]> {
  const supabase = await createClient()
  let query = supabase
    .from('students')
    .select('*')
    .eq('group_id', groupId)

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query.order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * Keep the current roster on normal lessons, but retain an inactive student
 * when they already have attendance on this lesson. Historical individual
 * groups that became empty after a reassignment fall back to their archived
 * student row, so the old occurrence does not open as an empty lesson.
 */
export function selectStudentsForAttendance(
  students: Student[],
  attendanceRows: Pick<Attendance, 'student_id'>[],
  allowInactiveFallback: boolean
): Student[] {
  const active = students.filter(student => student.is_active)

  if (allowInactiveFallback && active.length === 0) return students

  const attendedIds = new Set(attendanceRows.map(row => row.student_id))
  return students.filter(student => student.is_active || attendedIds.has(student.id))
}

export async function upsertStudent(student: {
  id?: string
  group_id: string
  name: string
  instrument: string | null
  parent_phone: string | null
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('students').upsert({
    ...student,
    is_active: true,
  })
  if (error) throw error
}

export async function deactivateStudent(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('students')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}
