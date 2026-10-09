import { createClient } from '@/lib/supabase/server'
import type { Attendance, AttendanceStatus, Lesson, Group, LessonSlot } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SCHOOL_YEAR_START } from '@/lib/utils/schedule'

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
    // Update only holiday metadata; an upsert would try to replace the immutable
    // payroll snapshot with the group's current schedule after a schedule edit.
    const { data, error } = await supabase.from('lessons')
      .update({ is_holiday: isHoliday, holiday_name: holidayName ?? null })
      .eq('id', reusableLesson.id).select().single()
    if (error) throw error
    return data as Lesson
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

export type CalendarLessonRow = {
  group_id: string
  date: string
  start_time: string
  is_makeup: boolean
  groups: Pick<Group, 'name' | 'lesson_type' | 'is_mangan_school' | 'school_name' | 'grade'> & {
    students?: { name: string; is_active: boolean }[]
  }
}

export function calendarLessonRowsToSlots(rows: CalendarLessonRow[]): LessonSlot[] {
  return rows.map(row => {
    const group = row.groups
    const d = new Date(row.date + 'T12:00:00')
    return {
      groupId: row.group_id,
      groupName: group.name,
      studentNames: group.students?.filter(student => student.is_active).map(student => student.name),
      lessonType: group.lesson_type,
      isMangan: group.is_mangan_school,
      schoolName: group.school_name,
      grade: group.grade,
      date: d,
      startTime: row.start_time.slice(0, 5),
      dayOfWeek: d.getDay(),
      isMakeup: row.is_makeup,
    }
  })
}

export async function getCalendarLessonSlots(): Promise<LessonSlot[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  return getCalendarLessonSlotsForTeacher(supabase, user.id)
}

export async function getCalendarLessonSlotsForTeacher(supabase: SupabaseClient, teacherId: string): Promise<LessonSlot[]> {
  const fromDate = `${SCHOOL_YEAR_START.getFullYear()}-${String(SCHOOL_YEAR_START.getMonth() + 1).padStart(2, '0')}-${String(SCHOOL_YEAR_START.getDate()).padStart(2, '0')}`
  const rows: CalendarLessonRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('lessons')
      .select('group_id, date, start_time, is_makeup, groups!inner(teacher_id, name, lesson_type, is_mangan_school, school_name, grade, students(name, is_active))')
      .eq('groups.teacher_id', teacherId)
      .eq('is_holiday', false)
      .gte('date', fromDate)
      .order('date', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    const page = (data ?? []) as unknown as CalendarLessonRow[]
    rows.push(...page)
    if (page.length < 1000) break
  }
  return calendarLessonRowsToSlots(rows)
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
