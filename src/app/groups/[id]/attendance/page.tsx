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

  const { data: group, error } = await supabase
    .from('groups')
    .select('*, group_schedules(*)')
    .eq('id', id)
    .eq('teacher_id', user.id)
    .single()

  if (error || !group) notFound()
  const typedGroup = group as Group & { group_schedules: GroupSchedule[] }

  const { data: holidaysData } = await supabase.from('holidays').select('*')
  const holidays = (holidaysData ?? []) as Holiday[]

  const lessonDate = getNextLessonDate(typedGroup.group_schedules) ?? new Date()
  const holidayCheck = isHolidayDate(lessonDate, holidays)

  const matchingSchedule = typedGroup.group_schedules.find(
    s => s.day_of_week === lessonDate.getDay()
  ) ?? typedGroup.group_schedules[0]

  const dateStr = `${lessonDate.getFullYear()}-${String(lessonDate.getMonth() + 1).padStart(2, '0')}-${String(lessonDate.getDate()).padStart(2, '0')}`
  const startTime = matchingSchedule?.start_time ?? '00:00:00'

  const lesson = await getOrCreateLesson(id, dateStr, startTime, holidayCheck.isHoliday, holidayCheck.name)

  const [students, attendanceRows] = await Promise.all([
    getStudentsByGroup(id),
    getAttendanceForLesson(lesson.id),
  ])

  const attendanceMap = new Map(attendanceRows.map(a => [a.student_id, a]))

  const headerGradient = holidayCheck.isHoliday
    ? 'from-amber-400 to-orange-500 shadow-amber-200'
    : 'from-teal-400 to-teal-600 shadow-teal-200'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-6">
      {/* Header */}
      <div className={`bg-gradient-to-bl ${headerGradient} text-white rounded-b-[36px] shadow-lg px-5 pt-8 pb-6`}>
        <div className="flex items-start gap-3 mb-1">
          <Link
            href={`/groups/${id}`}
            className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{typedGroup.name}</h1>
            <p className="text-sm text-white/70 mt-0.5">
              {formatDateHe(lessonDate)} · {startTime.slice(0, 5)}
            </p>
          </div>
          <Link
            href="/"
            className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </Link>
        </div>

        {holidayCheck.isHoliday && (
          <div className="bg-white/20 rounded-2xl px-4 py-2.5 mt-3 text-sm font-bold">
            {holidayCheck.name} — אין שיעור
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-5 max-w-md mx-auto w-full">
        {holidayCheck.isHoliday ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">השיעור בוטל בגלל {holidayCheck.name}</p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="flex gap-2.5 mb-5">
              {[
                { label: 'הגיעו',    value: attendanceRows.filter(a => a.status === 'present').length, color: 'text-emerald-500' },
                { label: 'לא הגיעו', value: attendanceRows.filter(a => a.status === 'absent').length,  color: 'text-red-500' },
                { label: 'סה״כ',     value: students.length,                                           color: 'text-teal-500' },
              ].map(s => (
                <div key={s.label} className="flex-1 bg-white rounded-2xl shadow-sm py-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Attendance toggles */}
            <div className="flex flex-col gap-2.5">
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
                <p className="text-center text-gray-400 text-sm py-8">אין תלמידים בקבוצה זו</p>
              )}
            </div>

            {students.length > 0 && (
              <Link
                href="/"
                className="mt-5 w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors shadow-sm shadow-teal-200"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                סיום ושמירה
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  )
}
