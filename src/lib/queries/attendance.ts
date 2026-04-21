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
