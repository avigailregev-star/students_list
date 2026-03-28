import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Group, Student, Lesson, Attendance } from '@/types/database'
import { formatDateHe } from '@/lib/utils/hebrew'
import ReportGroup from './ReportGroup'

type GroupWithData = Group & {
  students: (Student & {
    lessons_attended: number
    lessons_absent: number
    brought_instrument: number
    total_lessons: number
    history: { date: string; status: string; brought: boolean }[]
  })[]
  total_lessons: number
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all groups for this teacher
  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at')

  if (!groups || groups.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-gradient-to-l from-indigo-500 to-purple-600 text-white px-4 py-5">
          <h1 className="text-xl font-bold">דוחות</h1>
        </div>
        <div className="flex-1 flex items-center justify-center flex-col gap-3 text-gray-400">
          <div className="text-5xl">📊</div>
          <p className="text-sm">אין קבוצות עדיין</p>
          <Link href="/groups/new" className="text-indigo-600 font-semibold text-sm hover:underline">
            הוסף קבוצה ראשונה
          </Link>
        </div>
      </div>
    )
  }

  // For each group, fetch lessons + attendance
  const reportData: GroupWithData[] = []

  for (const group of groups as Group[]) {
    const { data: lessons } = await supabase
      .from('lessons')
      .select('*')
      .eq('group_id', group.id)
      .eq('is_holiday', false)
      .order('date', { ascending: false })

    const lessonList = (lessons ?? []) as Lesson[]
    const lessonIds = lessonList.map(l => l.id)

    const { data: students } = await supabase
      .from('students')
      .select('*')
      .eq('group_id', group.id)
      .eq('is_active', true)
      .order('name')

    const studentList = (students ?? []) as Student[]

    let attendanceRows: Attendance[] = []
    if (lessonIds.length > 0) {
      const { data: att } = await supabase
        .from('attendance')
        .select('*')
        .in('lesson_id', lessonIds)
      attendanceRows = (att ?? []) as Attendance[]
    }

    const studentsWithStats = studentList.map(student => {
      const studentAtt = attendanceRows.filter(a => a.student_id === student.id)
      const history = lessonList.map(lesson => {
        const att = studentAtt.find(a => a.lesson_id === lesson.id)
        return {
          date: lesson.date,
          status: att?.status ?? 'no_data',
          brought: att?.brought_instrument ?? false,
        }
      })
      return {
        ...student,
        total_lessons: lessonList.length,
        lessons_attended: studentAtt.filter(a => a.status === 'present' || a.status === 'late').length,
        lessons_absent: studentAtt.filter(a => a.status === 'absent').length,
        brought_instrument: studentAtt.filter(a => a.brought_instrument).length,
        history,
      }
    })

    reportData.push({
      ...group,
      students: studentsWithStats,
      total_lessons: lessonList.length,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-500 to-purple-600 text-white px-4 py-5">
        <h1 className="text-xl font-bold">דוחות נוכחות</h1>
        <p className="text-sm opacity-80 mt-0.5">{groups.length} קבוצות</p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 max-w-md mx-auto w-full">
        {reportData.map(group => (
          <ReportGroup key={group.id} group={group} />
        ))}
      </div>
    </div>
  )
}
