import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Group, Student, Lesson, Attendance } from '@/types/database'
import ReportGroup from './ReportGroup'
import ExportButtons from './ExportButtons'
import BottomNav from '@/components/layout/BottomNav'

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

  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at')

  if (!groups || groups.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6">
          <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest mb-1">סטטיסטיקות</p>
          <h1 className="text-2xl font-bold">דוחות נוכחות</h1>
        </div>
        <div className="flex-1 flex items-center justify-center flex-col gap-3 text-gray-400">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <p className="text-sm">אין קבוצות עדיין</p>
          <Link href="/groups/new" className="text-teal-600 font-bold text-sm hover:underline">
            הוסף קבוצה ראשונה
          </Link>
        </div>
      </div>
    )
  }

  const reportData: GroupWithData[] = []

  for (const group of groups as Group[]) {
    const { data: lessons } = await supabase
      .from('lessons').select('*').eq('group_id', group.id).eq('is_holiday', false).order('date', { ascending: false })

    const lessonList = (lessons ?? []) as Lesson[]
    const lessonIds = lessonList.map(l => l.id)

    const { data: students } = await supabase
      .from('students').select('*').eq('group_id', group.id).eq('is_active', true).order('name')

    const studentList = (students ?? []) as Student[]

    let attendanceRows: Attendance[] = []
    if (lessonIds.length > 0) {
      const { data: att } = await supabase.from('attendance').select('*').in('lesson_id', lessonIds)
      attendanceRows = (att ?? []) as Attendance[]
    }

    const studentsWithStats = studentList.map(student => {
      const studentAtt = attendanceRows.filter(a => a.student_id === student.id)
      const history = lessonList.map(lesson => {
        const att = studentAtt.find(a => a.lesson_id === lesson.id)
        return { date: lesson.date, status: att?.status ?? 'no_data', brought: att?.brought_instrument ?? false }
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

    reportData.push({ ...group, students: studentsWithStats, total_lessons: lessonList.length })
  }

  const now = new Date()
  const monthLabel = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24 print:bg-white print:pb-0">
      {/* Header — hidden on print */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6 print:hidden">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest mb-1">סטטיסטיקות</p>
        <h1 className="text-2xl font-bold">דוחות נוכחות</h1>
        <p className="text-sm text-teal-100 mt-0.5">{groups.length} קבוצות</p>
        <ExportButtons reportData={reportData} month={monthLabel} />
      </div>

      {/* Print header — visible only when printing */}
      <div className="hidden print:block px-6 py-4 border-b border-gray-200 mb-4">
        <h1 className="text-xl font-bold text-gray-900">דוח נוכחות — {monthLabel}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{groups.length} קבוצות</p>
      </div>

      <div className="px-4 py-5 flex flex-col gap-4 max-w-md mx-auto w-full print:max-w-full print:px-6">
        {reportData.map(group => (
          <ReportGroup key={group.id} group={group} />
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
