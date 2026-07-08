import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLessonIdsWithAttendance } from '@/lib/queries/attendance'
import PayrollView from '@/app/reports/payroll/PayrollView'
import type { MonthPayroll, DayCount } from '@/app/reports/payroll/page'
import BottomNav from '@/components/layout/BottomNav'

interface Props { params: Promise<{ id: string }> }

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function mapType(t: string): keyof DayCount | null {
  if (t === 'individual_45') return 'individual_45'
  if (t === 'individual_60') return 'individual_60'
  if (t === 'melodies_individual' || t === 'melodies_group' || t === 'group') return 'melodies'
  if (t === 'orchestra' || t === 'choir') return 'ensemble'
  if (t === 'theory') return 'theory'
  if (t === 'darcha') return 'darcha'
  return null
}

export default async function AdminTeacherReportsPage({ params }: Props) {
  const { id } = await params
  await requireAdmin()
  const supabase = createAdminClient()

  const [{ data: teacher }, { data: groups }] = await Promise.all([
    supabase.from('teachers').select('name').eq('id', id).single(),
    supabase.from('groups').select('id, lesson_type').eq('teacher_id', id),
  ])

  if (!teacher) notFound()

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  if (!groups || groups.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-2 text-gray-400">
        <p className="text-sm">אין קבוצות למורה זו</p>
        <Link href={`/admin/teachers/${id}`} className="text-teal-500 text-sm font-bold">חזרה</Link>
      </div>
    )
  }

  const groupIds = groups.map(g => g.id)
  const groupType = new Map(groups.map(g => [g.id, g.lesson_type]))

  const [{ data: lessons }, { data: canceledLessons }] = await Promise.all([
    supabase.from('lessons')
      .select('id, group_id, date, status, teacher_absence_reason, is_makeup')
      .in('group_id', groupIds)
      .eq('is_holiday', false)
      .lte('date', todayStr)
      .order('date'),
    supabase.from('lessons')
      .select('date, teacher_absence_reason')
      .in('group_id', groupIds)
      .eq('status', 'teacher_canceled')
      .eq('is_holiday', false)
      .lte('date', todayStr)
      .order('date'),
  ])

  // A lesson only counts toward payroll if at least one attendance row (any status) was
  // recorded — otherwise it's a phantom row created just by opening the attendance page.
  // However, lessons canceled with the legacy reason must still be counted (they never
  // get attendance rows because canceling doesn't write to the attendance table).
  const LEGACY_PAYSLIP_REASON = 'העדרות מורה עם השלמה בתלוש נוכחי'
  const lessonIdsWithAttendance = await getLessonIdsWithAttendance(supabase, (lessons ?? []).map(l => l.id))
  const heldLessons = (lessons ?? []).filter(l =>
    lessonIdsWithAttendance.has(l.id) ||
    (l.status === 'teacher_canceled' && l.teacher_absence_reason === LEGACY_PAYSLIP_REASON)
  )

  const monthsMap = new Map<string, MonthPayroll>()

  function ensureMonth(key: string): MonthPayroll {
    if (!monthsMap.has(key)) {
      const [y, m] = key.split('-').map(Number)
      const dayCounts: Record<number, DayCount> = {}
      for (let d = 1; d <= 31; d++) {
        dayCounts[d] = { individual_45: 0, individual_60: 0, melodies: 0, ensemble: 0, theory: 0, darcha: 0, makeup: 0 }
      }
      monthsMap.set(key, {
        key,
        label: `${HE_MONTHS[m - 1]} ${y}`,
        year: y,
        monthNum: m,
        daysInMonth: new Date(y, m, 0).getDate(),
        dayCounts,
        sickDays: 0,
        sickUnpaid: 0,
        sickHalf: 0,
        sickFull: 0,
        sickDates: [],
        makeupDates: [],
        makeupTypes: {},
      })
    }
    return monthsMap.get(key)!
  }

  for (const lesson of heldLessons) {
    const parts = lesson.date.split('-')
    const key = `${parts[0]}-${parts[1]}`
    const dayNum = parseInt(parts[2])
    const month = ensureMonth(key)

    if ((lesson as any).is_makeup) {
      const mkReason = (lesson as any).teacher_absence_reason ?? ''
      if (mkReason !== 'העדרות מורה עם השלמה בתלוש נוכחי') {
        month.dayCounts[dayNum].makeup++
        if (!month.makeupDates.includes(dayNum)) month.makeupDates.push(dayNum)
        const mkLessonType = groupType.get(lesson.group_id) ?? ''
        if (mkLessonType) {
          if (!month.makeupTypes[dayNum]) month.makeupTypes[dayNum] = {}
          month.makeupTypes[dayNum][mkLessonType] = (month.makeupTypes[dayNum][mkLessonType] ?? 0) + 1
        }
      }
      continue
    }

    if ((lesson as any).status === 'teacher_canceled') {
      const r = (lesson as any).teacher_absence_reason ?? ''
      if (r === 'העדרות מורה עם השלמה בתלוש נוכחי') {
        const col = mapType(groupType.get(lesson.group_id) ?? '')
        if (col) month.dayCounts[dayNum][col]++
      }
      continue
    }

    const col = mapType(groupType.get(lesson.group_id) ?? '')
    if (col) month.dayCounts[dayNum][col]++
  }

  const sickDatesSet = new Set<string>()
  for (const lesson of (canceledLessons ?? [])) {
    if (lesson.teacher_absence_reason === 'מחלת מורה') sickDatesSet.add(lesson.date)
  }
  const sortedSickDates = Array.from(sickDatesSet).sort()

  const sickDateCategory = new Map<string, 'unpaid' | 'half' | 'full'>()
  let incidentDay = 0
  for (let i = 0; i < sortedSickDates.length; i++) {
    const date = sortedSickDates[i]
    if (i === 0) { incidentDay = 1 }
    else {
      const prev = new Date(sortedSickDates[i - 1])
      const curr = new Date(date)
      const gapDays = Math.round((curr.getTime() - prev.getTime()) / 86400000)
      if (gapDays > 1) incidentDay = 1
      else incidentDay++
    }
    sickDateCategory.set(date, incidentDay === 1 ? 'unpaid' : incidentDay <= 3 ? 'half' : 'full')
  }

  for (const [date, cat] of sickDateCategory) {
    const parts = date.split('-')
    const dayNum = parseInt(parts[2])
    const m = ensureMonth(`${parts[0]}-${parts[1]}`)
    m.sickDays++
    if (!m.sickDates.includes(dayNum)) m.sickDates.push(dayNum)
    if (cat === 'unpaid') m.sickUnpaid++
    else if (cat === 'half') m.sickHalf++
    else m.sickFull++
  }

  const months = Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24 print:bg-white print:pb-0">
      <div className="bg-gradient-to-bl from-violet-500 to-violet-700 text-white rounded-b-[36px] shadow-lg shadow-violet-200 px-5 pt-10 pb-7 print:hidden">
        <div className="flex items-center gap-3">
          <Link href={`/admin/teachers/${id}`} className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-violet-100 uppercase tracking-widest">חשבות שכר</p>
            <h1 className="text-2xl font-bold">{teacher.name}</h1>
          </div>
        </div>
        <p className="text-sm text-violet-100 mt-1 mr-12">{months.length} חודשים</p>
      </div>

      <PayrollView months={months} teacherName={teacher.name} />
      <BottomNav />
    </div>
  )
}
