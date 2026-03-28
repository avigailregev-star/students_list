export type Teacher = {
  id: string
  name: string
  email: string
  phone: string | null
  created_at: string
}

export type Holiday = {
  id: string
  name: string
  date: string // ISO date string "YYYY-MM-DD"
  created_at: string
}

export type LessonType = 'group' | 'individual'

export type Group = {
  id: string
  teacher_id: string
  name: string
  lesson_type: LessonType
  is_mangan_school: boolean
  school_name: string | null
  grade: string | null
  created_at: string
}

export type GroupSchedule = {
  id: string
  group_id: string
  day_of_week: number // 0=Sun, 1=Mon, ..., 6=Sat
  start_time: string  // "HH:MM:SS"
  end_time: string | null
  created_at: string
}

export type Student = {
  id: string
  group_id: string
  name: string
  instrument: string | null
  parent_phone: string | null
  is_active: boolean
  created_at: string
}

export type Lesson = {
  id: string
  group_id: string
  date: string // "YYYY-MM-DD"
  start_time: string // "HH:MM:SS"
  is_holiday: boolean
  holiday_name: string | null
  notes: string | null
  created_at: string
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export type Attendance = {
  id: string
  lesson_id: string
  student_id: string
  status: AttendanceStatus
  brought_instrument: boolean
  created_at: string
}

// Joined types used in queries
export type GroupWithSchedules = Group & {
  group_schedules: GroupSchedule[]
}

export type LessonSlot = {
  groupId: string
  groupName: string
  lessonType: LessonType
  isMangan: boolean
  schoolName: string | null
  grade: string | null
  date: Date
  startTime: string // "HH:MM"
  dayOfWeek: number
}
