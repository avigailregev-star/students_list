import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { AdminApprovalStatus, Group, Student, Lesson, Attendance } from '@/types/database'
import ReportGroup from './ReportGroup'
import ExportButtons from './ExportButtons'
import BottomNav from '@/components/layout/BottomNav'
import { getEventsForTeacher } from '@/lib/queries/events'
import type { GroupSchedule, SchoolEventType } from '@/types/database'
import VacationSection from './VacationSection'
import type { VacationRequest } from '@/types/database'
import type { ExtraHoursRequest } from '@/types/database'
import ExtraHoursSection from './ExtraHoursSection'

type HistoryEntry = {
  date: string
  status: string
  brought: boolean
  eventType?: SchoolEventType
  eventName?: string
  cancelReason?: string
  cancelApprovalStatus?: AdminApprovalStatus | null
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

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: vacationsRaw } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })
  const vacationRequests = (vacationsRaw ?? []) as VacationRequest[]

  const { data: extraHoursRaw } = await supabase
    .from('extra_hours_requests')
    .select('*')
    .eq('teacher_id', user.id)
    .order('work_date', { ascending: false })
  const extraHoursRequests = (extraHoursRaw ?? []) as ExtraHoursRequest[]

  const { data: groups } = await supabase
    .from('groups')
    .select('*, group_schedules(*)')
    .eq('teacher_id', user.id)
    .order('created_at')

  if (!groups || groups.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </Link>
            <div>
              <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest mb-1">סטטיסטיקות</p>
              <h1 className="text-2xl font-bold">דוחות נוכחות</h1>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center flex-col gap-3 text-gray-400">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <p className="text-sm">אין קבוצות עדיין</p>
        </div>
        <VacationSection initialRequests={vacationRequests} />
        <ExtraHoursSection initialRequests={extraHoursRequests} />
      </div>
    )
  }

  const { data: teacherData } = await supabase.from('teachers').select('name').eq('id', user.id).single()
  const teacherName = teacherData?.name ?? ''

  const events = await getEventsForTeacher()

  const reportData: GroupWithData[] = []
  const todayDate = new Date()
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`

  for (const group of groups as Group[]) {
    const [{ data: lessons }, { data: canceled }] = await Promise.all([
      supabase.from('lessons').select('*').eq('group_id', group.id).eq('is_holiday', false).neq('status', 'teacher_canceled').lte('date', todayStr).order('date', { ascending: false }),
      supabase.from('lessons').select('id, date, teacher_absence_reason, admin_approval_status').eq('group_id', group.id).eq('status', 'teacher_canceled').lte('date', todayStr).order('date', { ascending: false }),
    ])

    const lessonList = (lessons ?? []) as Lesson[]
    const canceledList = (canceled ?? []) as { id: string; date: string; teacher_absence_reason: string | null; admin_approval_status: AdminApprovalStatus | null }[]
    const lessonIds = lessonList.map(l => l.id)

    const { data: students } = await supabase
      .from('students').select('*').eq('group_id', group.id).eq('is_active', true).order('name')

    const studentList = (students ?? []) as Student[]

    let attendanceRows: Attendance[] = []
    if (lessonIds.length > 0) {
      const { data: att } = await supabase.from('attendance').select('*').in('lesson_id', lessonIds)
      attendanceRows = (att ?? []) as Attendance[]
    }

    // Schedule-hour changes in older versions could create several regular
    // lesson rows for one group/date. Treat those rows as one logical lesson;
    // makeup lessons remain independent occurrences.
    const occurrenceMap = new Map<string, Lesson[]>()
    for (const lesson of lessonList) {
      const key = lesson.is_makeup ? `makeup:${lesson.id}` : `regular:${lesson.date}`
      const occurrence = occurrenceMap.get(key) ?? []
      occurrence.push(lesson)
      occurrenceMap.set(key, occurrence)
    }
    const occurrences = [...occurrenceMap.values()].map(items =>
      items.sort((a, b) => a.created_at.localeCompare(b.created_at))
    )

    // A logical lesson only counts as held if one of its underlying rows has
    // attendance. Empty rows created merely by opening the page stay hidden.
    const lessonIdsWithAttendance = new Set(attendanceRows.map(a => a.lesson_id))
    const heldOccurrences = occurrences.filter(items => items.some(l => lessonIdsWithAttendance.has(l.id)))

    const studentsWithStats = studentList.map(student => {
      const studentAtt = attendanceRows.filter(a => a.student_id === student.id)
      const history = [
        ...heldOccurrences.map(items => {
          const lesson = items[0]
          const att = items.map(item => studentAtt.find(a => a.lesson_id === item.id)).find(Boolean)
          return { date: lesson.date, status: att?.status ?? 'no_data', brought: att?.brought_instrument ?? false, isMakeup: lesson.is_makeup }
        }),
        ...canceledList.map(lesson => ({ date: lesson.date, status: 'teacher_canceled', brought: false, cancelReason: lesson.teacher_absence_reason ?? undefined, cancelApprovalStatus: lesson.admin_approval_status })),
      ].sort((a, b) => b.date.localeCompare(a.date))

      return {
        ...student,
        total_lessons: heldOccurrences.length,
        lessons_attended: history.filter(h => h.status === 'present' || h.status === 'late').length,
        lessons_absent: history.filter(h => h.status === 'absent').length,
        brought_instrument: history.filter(h => h.brought).length,
        history,
      }
    })

    const scheduledDays = ((group as Group & { group_schedules: GroupSchedule[] }).group_schedules ?? [])
      .map((s: GroupSchedule) => s.day_of_week)

    const eventEntries: HistoryEntry[] = []
    const seenEventDates = new Set<string>()
    for (const ev of events) {
      const start = new Date(ev.start_date + 'T12:00:00')
      const end   = new Date(ev.end_date   + 'T12:00:00')
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        if (ds > todayStr) continue
        if (scheduledDays.includes(d.getDay()) && !seenEventDates.has(ds)) {
          seenEventDates.add(ds)
          eventEntries.push({ date: ds, status: 'school_event', brought: false, eventType: ev.event_type, eventName: ev.name })
        }
      }
    }

    const studentsWithEventHistory = studentsWithStats.map(student => ({
      ...student,
      history: [...student.history, ...eventEntries].sort((a, b) => b.date.localeCompare(a.date)),
    }))

    reportData.push({ ...group, students: studentsWithEventHistory, total_lessons: heldOccurrences.length, canceled_lessons: canceledList.length })
  }

  reportData.sort((a, b) => {
    const dayA = (a as GroupWithData & { group_schedules?: { day_of_week: number }[] }).group_schedules?.[0]?.day_of_week ?? 7
    const dayB = (b as GroupWithData & { group_schedules?: { day_of_week: number }[] }).group_schedules?.[0]?.day_of_week ?? 7
    return dayA - dayB
  })

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24 print:bg-white print:pb-0">
      {/* Header — hidden on print */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6 print:hidden">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">סטטיסטיקות</p>
            <h1 className="text-2xl font-bold">דוחות נוכחות</h1>
          </div>
        </div>
        <p className="text-sm text-teal-100 mt-0.5 mr-12">{groups.length} קבוצות</p>
        <ExportButtons
          reportData={reportData}
          month={monthKey}
          teacherName={teacherName}
          extraHours={extraHoursRequests.filter(r => r.status === 'approved').map(r => ({ work_date: r.work_date, minutes: r.minutes }))}
        />
      </div>

      {/* Print header — visible only when printing */}
      <div className="hidden print:block px-6 py-4 border-b border-gray-200 mb-4">
        <h1 className="text-xl font-bold text-gray-900">דוח נוכחות — {monthLabel}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{groups.length} קבוצות</p>
      </div>

      <VacationSection initialRequests={vacationRequests} />
      <ExtraHoursSection initialRequests={extraHoursRequests} />

      <div className="px-4 py-5 flex flex-col gap-3 max-w-md mx-auto w-full print:max-w-full print:px-6">
        {reportData.map((group, i) => {
          const dayLabels: Record<number, string> = { 0: 'ראשון', 1: 'שני', 2: 'שלישי', 3: 'רביעי', 4: 'חמישי', 5: 'שישי', 6: 'שבת' }
          const schedules = (group as GroupWithData & { group_schedules?: { day_of_week: number }[] }).group_schedules
          const day = schedules?.[0]?.day_of_week
          const prevSchedules = i > 0 ? (reportData[i - 1] as GroupWithData & { group_schedules?: { day_of_week: number }[] }).group_schedules : null
          const prevDay = prevSchedules?.[0]?.day_of_week
          const showDayHeader = day !== undefined && day !== prevDay
          return (
            <div key={group.id}>
              {showDayHeader && (
                <div className={`flex items-center gap-3 ${i > 0 ? 'mt-3' : ''} mb-2`}>
                  <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">{dayLabels[day]?.charAt(0)}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-700">יום {dayLabels[day]}</p>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              )}
              <ReportGroup group={group} />
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}
