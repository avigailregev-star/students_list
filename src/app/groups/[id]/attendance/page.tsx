import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getStudentsByGroup } from '@/lib/queries/students'
import { getOrCreateLesson, getAttendanceForLesson } from '@/lib/queries/attendance'
import AttendanceToggle from '@/components/attendance/AttendanceToggle'
import { getNextLessonDate, isHolidayDate } from '@/lib/utils/schedule'
import { formatDateHe } from '@/lib/utils/hebrew'
import type { Group, GroupSchedule, Holiday, AttendanceStatus } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AttendancePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch group + schedules
  const { data: group, error } = await supabase
    .from('groups')
    .select('*, group_schedules(*)')
    .eq('id', id)
    .eq('teacher_id', user.id)
    .single()

  if (error || !group) notFound()
  const typedGroup = group as Group & { group_schedules: GroupSchedule[] }

  // Fetch holidays
  const { data: holidaysData } = await supabase
    .from('holidays')
    .select('*')
  const holidays = (holidaysData ?? []) as Holiday[]

  // Compute lesson date
  const lessonDate = getNextLessonDate(typedGroup.group_schedules) ?? new Date()
  const holidayCheck = isHolidayDate(lessonDate, holidays)

  // Find the schedule matching this day
  const matchingSchedule = typedGroup.group_schedules.find(
    s => s.day_of_week === lessonDate.getDay()
  ) ?? typedGroup.group_schedules[0]

  const dateStr = `${lessonDate.getFullYear()}-${String(lessonDate.getMonth() + 1).padStart(2, '0')}-${String(lessonDate.getDate()).padStart(2, '0')}`
  const startTime = matchingSchedule?.start_time ?? '00:00:00'

  // Create/get lesson record
  const lesson = await getOrCreateLesson(
    id,
    dateStr,
    startTime,
    holidayCheck.isHoliday,
    holidayCheck.name
  )

  // Fetch students + existing attendance
  const [students, attendanceRows] = await Promise.all([
    getStudentsByGroup(id),
    getAttendanceForLesson(lesson.id),
  ])

  const attendanceMap = new Map(attendanceRows.map(a => [a.student_id, a]))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-6">
      {/* Header */}
      <div className={`text-white px-4 py-5 ${holidayCheck.isHoliday ? 'bg-amber-500' : 'bg-gradient-to-l from-indigo-500 to-purple-600'}`}>
        <div className="flex items-start gap-3 mb-2">
          <Link
            href={`/groups/${id}`}
            className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-lg shrink-0"
          >
            ←
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{typedGroup.name}</h1>
            <p className="text-sm opacity-90 mt-0.5">
              {formatDateHe(lessonDate)} · {startTime.slice(0, 5)}
            </p>
          </div>
        </div>

        {holidayCheck.isHoliday && (
          <div className="bg-white/20 rounded-xl px-4 py-2.5 mt-2 text-sm font-semibold">
            🎉 {holidayCheck.name} — אין שיעור
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4 max-w-md mx-auto w-full">
        {holidayCheck.isHoliday ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🏖️</div>
            <p className="text-gray-500 text-sm">השיעור בוטל בגלל {holidayCheck.name}</p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="flex gap-2 mb-4">
              {[
                { label: 'הגיעו',    value: attendanceRows.filter(a => a.status === 'present').length, color: 'text-emerald-600' },
                { label: 'לא הגיעו', value: attendanceRows.filter(a => a.status === 'absent').length,  color: 'text-red-500' },
                { label: 'סה״כ',     value: students.length,                                           color: 'text-indigo-600' },
              ].map(s => (
                <div key={s.label} className="flex-1 bg-white border border-gray-100 rounded-xl py-2.5 text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Attendance toggles */}
            <div className="flex flex-col gap-2">
              {students.map(student => {
                const att = attendanceMap.get(student.id)
                return (
                  <AttendanceToggle
                    key={student.id}
                    lessonId={lesson.id}
                    studentId={student.id}
                    studentName={student.name}
                    initialStatus={(att?.status as AttendanceStatus) ?? null}
                    initialBrought={att?.brought_instrument ?? false}
                  />
                )
              })}
              {students.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">
                  אין תלמידים בקבוצה זו
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
