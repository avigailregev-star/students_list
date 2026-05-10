export type Teacher = {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'admin' | 'teacher'
  created_at: string
}

export type Holiday = {
  id: string
  name: string
  date: string // ISO date string "YYYY-MM-DD"
  created_at: string
}

export type LessonType =
  | 'individual_45'
  | 'individual_60'
  | 'group'
  | 'theory'
  | 'orchestra'
  | 'choir'
  | 'melodies_individual'
  | 'melodies_group'

export type Group = {
  id: string
  teacher_id: string
  name: string
  lesson_type: LessonType
  is_mangan_school: boolean
  school_name: string | null
  grade: string | null
  max_students: number | null
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

export type LessonStatus = 'scheduled' | 'completed' | 'teacher_canceled' | 'holiday'
export type AdminApprovalStatus = 'pending' | 'approved' | 'rejected'

export type Lesson = {
  id: string
  group_id: string
  date: string // "YYYY-MM-DD"
  start_time: string // "HH:MM:SS"
  status: LessonStatus
  is_holiday: boolean
  holiday_name: string | null
  teacher_absence_reason: string | null
  is_sick_leave: boolean
  admin_approval_status: AdminApprovalStatus | null
  sick_leave_document_url: string | null
  cancellation_notes: string | null
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
  student_absence_reason: string | null
  created_at: string
}

export type SchoolEventType = 'holiday' | 'vacation' | 'makeup_day' | 'school_start' | 'school_end' | 'concert'

export type SchoolEvent = {
  id: string
  event_type: SchoolEventType
  start_date: string // "YYYY-MM-DD"
  end_date: string   // "YYYY-MM-DD"
  name: string
  created_by: string | null
  created_at: string
}

export type TeacherAvailabilityRange = {
  id: string
  teacher_id: string
  day_of_week: number   // 0=ראשון … 6=שבת
  start_time: string    // "HH:MM:SS"
  end_time: string      // "HH:MM:SS"
  created_at: string
}

// Joined types used in queries
export type GroupWithSchedules = Group & {
  group_schedules: GroupSchedule[]
}

export type GroupWithSchedulesAndStudents = Group & {
  group_schedules: GroupSchedule[]
  students: Student[]
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
