import { createClient } from '@/lib/supabase/server'
import type { Attendance, AttendanceStatus, Lesson, Group } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getOrCreateLesson(
  groupId: string,
  date: string,
  startTime: string,
  isHoliday: boolean,
  holidayName?: string
): Promise<Lesson> {
  const supabase = await createClient()

  // Resolve the requested occurrence first. A makeup is never substituted by
  // a regular lesson that happens to share its date.
  const { data: exact, error: exactError } = await supabase.from('lessons').select('*')
    .eq('group_id', groupId).eq('date', date).in('start_time', [startTime.slice(0, 5), startTime.slice(0, 5) + ':00'])
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (exactError) throw exactError
  if (exact?.is_makeup) return exact as Lesson

  const weekday = new Date(date + 'T12:00:00').getDay()
  const { data: schedules, error: scheduleError } = await supabase.from('group_schedules')
    .select('start_time').eq('group_id', groupId).eq('day_of_week', weekday)
  if (scheduleError) throw scheduleError
  const multipleSlots = (schedules ?? []).length > 1
  const { data: oldLesson, error: oldError } = await supabase.from('lessons').select('*')
    .eq('group_id', groupId).eq('date', date).eq('is_makeup', false)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (oldError) throw oldError
  const reusableLesson = multipleSlots ? exact : (oldLesson ?? exact)

  if (reusableLesson) {
    const { data: attendanceRow, error: attendanceError } = await supabase.from('attendance')
      .select('id').eq('lesson_id', reusableLesson.id).limit(1).maybeSingle()
    if (attendanceError) throw attendanceError
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

  return data.map(row => {
    const group = row.groups as unknown as Group
    const d = new Date(row.date + 'T12:00:00')
    return {
      groupId: row.group_id,
      groupName: group.name,
      lessonType: group.lesson_type,
      isMangan: group.is_mangan_school,
      schoolName: group.school_name,
      grade: group.grade,
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
