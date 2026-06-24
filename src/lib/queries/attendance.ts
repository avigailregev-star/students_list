import { createClient } from '@/lib/supabase/server'
import type { Attendance, AttendanceStatus, Lesson } from '@/types/database'

export async function getOrCreateLesson(
  groupId: string,
  date: string,
  startTime: string,
  isHoliday: boolean,
  holidayName?: string
): Promise<Lesson> {
  const supabase = await createClient()

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
