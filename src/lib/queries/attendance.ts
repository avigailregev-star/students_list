import { createClient } from '@/lib/supabase/server'
import type { Attendance, AttendanceStatus, Lesson } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getOrCreateLesson(
  groupId: string,
  date: string,
  startTime: string,
  isHoliday: boolean,
  holidayName?: string
): Promise<Lesson> {
  const supabase = await createClient()

  // A regular lesson is a calendar occurrence, not a schedule snapshot. If an
  // admin changes only the hour while keeping the same group and weekday, keep
  // using the lesson that was already created for that date. Its attendance is
  // attached to the lesson id and must not become unreachable because the new
  // schedule now supplies a different start_time.
  // Prefer the oldest occurrence as well: installations already affected by
  // the old bug can contain a newer, empty duplicate at the updated hour.
  const { data: reusableLesson } = await supabase
    .from('lessons')
    .select('*')
    .eq('group_id', groupId)
    .eq('date', date)
    .eq('is_makeup', false)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (reusableLesson) {
    const { data: attendanceRow } = await supabase
      .from('attendance')
      .select('id')
      .eq('lesson_id', reusableLesson.id)
      .limit(1)
      .maybeSingle()

    // A lesson that already has recorded attendance keeps its holiday status
    // frozen — a holiday/vacation added afterwards must not silently hide it
    // or drop it out of payroll. Explicit cancellation is the only way to
    // change that once real attendance exists.
    if (attendanceRow || reusableLesson.start_time !== startTime) return reusableLesson as Lesson
  }

  const { data, error } = await supabase
    .from('lessons')
    .upsert({
      group_id: groupId,
      date,
      start_time: startTime,
      is_holiday: isHoliday,
      holiday_name: holidayName ?? null,
    }, { onConflict: 'group_id,date,start_time', ignoreDuplicates: false })
    .select()
    .single()

  if (error) throw error
  return data as Lesson
}

// Once a lesson has real recorded attendance, a holiday/vacation added
// afterwards for its date must not hide it or make it uneditable.
export function shouldDisplayAsHoliday(isHoliday: boolean, attendanceRowCount: number): boolean {
  return isHoliday && attendanceRowCount === 0
}

export async function getAttendanceForLesson(lessonId: string): Promise<Attendance[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('lesson_id', lessonId)
  if (error) throw error
  return data ?? []
}

export async function getMakeupLessons(): Promise<import('@/types/database').LessonSlot[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('lessons')
    .select('id, group_id, date, start_time, groups!inner(teacher_id, name, lesson_type, is_mangan_school, school_name, grade)')
    .eq('is_makeup', true)
    .eq('status', 'scheduled')
    .eq('groups.teacher_id', user.id)

  if (error || !data) return []

  return data.map((row: any) => {
    const d = new Date(row.date + 'T12:00:00')
    return {
      groupId: row.group_id,
      groupName: row.groups.name,
      lessonType: row.groups.lesson_type,
      isMangan: row.groups.is_mangan_school,
      schoolName: row.groups.school_name,
      grade: row.groups.grade,
      date: d,
      startTime: row.start_time.slice(0, 5),
      dayOfWeek: d.getDay(),
      isMakeup: true,
    }
  })
}

export async function upsertAttendance(
  lessonId: string,
  studentId: string,
  status: AttendanceStatus,
  broughtInstrument: boolean
) {
  const supabase = await createClient()
  const { error } = await supabase.from('attendance').upsert({
    lesson_id: lessonId,
    student_id: studentId,
    status,
    brought_instrument: broughtInstrument,
  }, { onConflict: 'lesson_id,student_id' })
  if (error) throw error
}

export async function getLessonIdsWithAttendance(
  supabase: SupabaseClient,
  lessonIds: string[]
): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('attendance')
    .select('lesson_id')
    .in('lesson_id', lessonIds)
  if (error) throw error
  return new Set((data ?? []).map((row: { lesson_id: string }) => row.lesson_id))
}
