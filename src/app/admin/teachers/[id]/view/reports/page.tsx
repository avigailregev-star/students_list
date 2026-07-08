import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Group, Student, Lesson, Attendance, SchoolEventType, VacationRequest } from '@/types/database'
import ReportGroup from '@/app/reports/ReportGroup'
import VacationSection from '@/app/reports/VacationSection'
import ViewOnlyBanner from '../ViewOnlyBanner'
import ViewNav from '../ViewNav'

type HistoryEntry = {
  date: string
  status: string
  brought: boolean
  eventType?: SchoolEventType
  eventName?: string
  cancelReason?: string
  isMakeup?: boolean
}

type GroupWithData = Group & {
  students: (Student & {
    lessons_attended: number
    lessons_absent: number
    brought_instrument: number
    total_lessons: number
    history: HistoryEntry[]
  })[]
  total_lessons: number
  canceled_lessons: number
}

interface Props { params: Promise<{ id: string }> }

export default async function AdminTeacherViewReportsPage({ params }: Props) {
  const { id } = await params
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: teacher } = await supabase.from('teachers').select('name').eq('id', id).single()
  if (!teacher) notFound()

  const { data: vacationsRaw } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('teacher_id', id)
    .order('created_at', { ascending: false })
  const vacationRequests = (vacationsRaw ?? []) as VacationRequest[]

  const { data: groups } = await supabase
    .from('groups')
    .select('*, group_schedules(*)')
    .eq('teacher_id', id)
    .order('created_at')

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const reportData: GroupWithData[] = []

  for (const group of (groups ?? []) as Group[]) {
    const [{ data: lessons }, { data: canceled }] = await Promise.all([
      supabase.from('lessons').select('*').eq('group_id', group.id).eq('is_holiday', false).neq('status', 'teacher_canceled').lte('date', todayStr).order('date', { ascending: false }),
      supabase.from('lessons').select('id, date, teacher_absence_reason').eq('group_id', group.id).eq('status', 'teacher_canceled').lte('date', todayStr).order('date', { ascending: false }),
    ])

    const lessonList = (lessons ?? []) as Lesson[]
    const canceledList = (canceled ?? []) as { id: string; date: string; teacher_absence_reason: string | null }[]
    const lessonIds = lessonList.map(l => l.id)

    const { data: students } = await supabase
      .from('students').select('*').eq('group_id', group.id).eq('is_active', true).order('name')

    const studentList = (students ?? []) as Student[]

    let attendanceRows: Attendance[] = []
    if (lessonIds.length > 0) {
      const { data: att } = await supabase.from('attendance').select('*').in('lesson_id', lessonIds)
      attendanceRows = (att ?? []) as Attendance[]
    }

    const lessonIdsWithAttendance = new Set(attendanceRows.map(a => a.lesson_id))
    const heldLessonList = lessonList.filter(l => lessonIdsWithAttendance.has(l.id))

    const studentsWithStats = studentList.map(student => {
      const studentAtt = attendanceRows.filter(a => a.student_id === student.id)
      const history = [
        ...heldLessonList.map(lesson => {
          const att = studentAtt.find(a => a.lesson_id === lesson.id)
          return { date: lesson.date, status: att?.status ?? 'no_data', brought: att?.brought_instrument ?? false, isMakeup: lesson.is_makeup }
        }),
        ...canceledList.map(lesson => ({ date: lesson.date, status: 'teacher_canceled', brought: false, cancelReason: lesson.teacher_absence_reason ?? undefined })),
      ].sort((a, b) => b.date.localeCompare(a.date))

      return {
        ...student,
        total_lessons: heldLessonList.length,
        lessons_attended: studentAtt.filter(a => a.status === 'present' || a.status === 'late').length,
        lessons_absent: studentAtt.filter(a => a.status === 'absent').length,
        brought_instrument: studentAtt.filter(a => a.brought_instrument).length,
        history,
      }
    })

    reportData.push({ ...group, students: studentsWithStats, total_lessons: heldLessonList.length, canceled_lessons: canceledList.length })
  }

  reportData.sort((a, b) => {
    const dayA = (a as GroupWithData & { group_schedules?: { day_of_week: number }[] }).group_schedules?.[0]?.day_of_week ?? 7
    const dayB = (b as GroupWithData & { group_schedules?: { day_of_week: number }[] }).group_schedules?.[0]?.day_of_week ?? 7
    return dayA - dayB
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <ViewOnlyBanner teacherId={id} />
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">סטטיסטיקות</p>
        <h1 className="text-2xl font-bold">דוחות נוכחות — {teacher.name}</h1>
        <p className="text-sm text-teal-100 mt-0.5">{(groups ?? []).length} קבוצות</p>
      </div>

      <div className="px-4 py-5 max-w-md mx-auto w-full flex flex-col gap-4">
        {reportData.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">אין קבוצות</p>
        )}
        {reportData.map(group => (
          <ReportGroup key={group.id} group={group} />
        ))}
      </div>

      <VacationSection initialRequests={vacationRequests} viewOnly />
      <ViewNav teacherId={id} />
    </div>
  )
}
