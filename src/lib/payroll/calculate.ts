import { categorizeSickDates } from './sickLeaveTiers'
import { isLegacyPayableCancellation } from './legacyPayslipReason'
import { getLessonUnits } from './lessonUnits'
import { occurrenceKey } from './occurrences'
import type { AdminApprovalStatus } from '@/types/database'

export type DayCount = {
  individual_45: number; individual_60: number; melodies: number; ensemble: number
  theory: number; darcha: number; makeup: number; extra_hours: number
}
export type MonthPayroll = {
  key: string; label: string; year: number; monthNum: number; daysInMonth: number
  dayCounts: Record<number, DayCount>
  sickDays: number; sickUnpaid: number; sickHalf: number; sickFull: number; sickDates: number[]
  sickLeaveDetails: Record<number, { startTime: string; lessonType: string }[]>
  unverifiedLessons: number
  makeupDates: number[]; makeupTypes: Record<number, Record<string, number>>
  extraHoursDetails: Record<number, { activityType: string; minutes: number }[]>
}
export type PayrollGroup = {
  id: string; lesson_type: string
  group_schedules: { day_of_week: number; start_time: string; end_time: string | null }[]
}
export type PayrollLesson = {
  id: string; group_id: string; date: string; start_time: string; status: string
  is_holiday: boolean; is_makeup: boolean; teacher_absence_reason: string | null
  admin_approval_status: AdminApprovalStatus | null; created_at: string
  makeup_lesson_id?: string | null
  payroll_lesson_type?: string | null; payroll_units?: number | null; payroll_occurrence_key?: string | null
  payroll_source_lesson_id?: string | null
  payroll_snapshot_origin?: 'captured' | 'legacy_baseline'
}
export type PayrollExtraHours = { id?: string; work_date: string; minutes: number; activity_type: string; status: string }
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const COLUMNS: Record<string, keyof DayCount> = {
  individual_45: 'individual_45', individual_60: 'individual_60', melodies_individual: 'melodies',
  melodies_group: 'melodies', group: 'melodies', orchestra: 'ensemble', choir: 'ensemble', theory: 'theory', darcha: 'darcha',
}
export function emptyDay(): DayCount {
  return { individual_45: 0, individual_60: 0, melodies: 0, ensemble: 0, theory: 0, darcha: 0, makeup: 0, extra_hours: 0 }
}
export function emptyMonth(key: string): MonthPayroll {
  const [year, monthNum] = key.split('-').map(Number)
  return { key, year, monthNum, label: `${HE_MONTHS[monthNum - 1]} ${year}`, daysInMonth: new Date(year, monthNum, 0).getDate(),
    dayCounts: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [i + 1, emptyDay()])),
    sickDays: 0, sickUnpaid: 0, sickHalf: 0, sickFull: 0, sickDates: [], sickLeaveDetails: {}, unverifiedLessons: 0, makeupDates: [], makeupTypes: {}, extraHoursDetails: {} }
}
// Lesson units and clock hours are different quantities and must not be added together.
export function totalLessonUnits(c: DayCount): number {
  return c.individual_45 + c.individual_60 + c.melodies + c.ensemble + c.theory + c.darcha + c.makeup
}
export function isWorkDay(c: DayCount): boolean { return totalLessonUnits(c) > 0 || c.extra_hours > 0 }
export function israelToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function calculatePayroll({ groups, lessons, attendanceIds, extraHours, today }: {
  groups: PayrollGroup[]; lessons: PayrollLesson[]; attendanceIds: Set<string>; extraHours: PayrollExtraHours[]; today: string
}): MonthPayroll[] {
  const months = new Map<string, MonthPayroll>()
  const ensure = (date: string) => {
    const key = date.slice(0, 7)
    if (!months.has(key)) months.set(key, emptyMonth(key))
    return months.get(key)!
  }
  const byGroup = new Map(groups.map(g => [g.id, g]))
  const eligible = lessons.filter(l => byGroup.has(l.group_id) && !l.is_holiday && l.status !== 'holiday' && l.date <= today)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  const occurrences = new Map<string, PayrollLesson[]>()
  const originals = new Map(lessons.filter(l => l.makeup_lesson_id).map(l => [l.makeup_lesson_id!, l]))
  const byId = new Map(lessons.map(l => [l.id, l]))
  const details = (l: PayrollLesson) => {
    const group = byGroup.get(l.group_id)!
    const original = l.is_makeup ? byId.get(l.payroll_source_lesson_id ?? '') ?? originals.get(l.id) : undefined
    const source = original?.group_id === l.group_id ? original : l
    const type = l.payroll_lesson_type ?? source.payroll_lesson_type ?? group.lesson_type
    const units = l.payroll_units ?? source.payroll_units ?? getLessonUnits(type, source.start_time, group.group_schedules, source.date)
    if (!COLUMNS[type]) throw new Error(`סוג שיעור לא מוכר בדוח: ${type}`)
    if (!Number.isFinite(units) || units <= 0 || units > 32) throw new Error('יחידות השיעור אינן תקינות')
    return { type, units }
  }
  for (const l of eligible) {
    const key = `${l.group_id}:${l.payroll_occurrence_key ?? occurrenceKey(l, byGroup.get(l.group_id)!.group_schedules)}`
    const rows = occurrences.get(key) ?? []
    if (!rows.some(row => row.id === l.id)) rows.push(l)
    occurrences.set(key, rows)
  }
  const held: PayrollLesson[] = []
  for (const rows of occurrences.values()) {
    const canceled = rows.filter(l => l.status === 'teacher_canceled')
    const reported = rows.filter(l => l.status !== 'teacher_canceled' && attendanceIds.has(l.id))
    if (canceled.length && reported.length) throw new Error('נמצאו דיווחים סותרים לאותו שיעור; יש לבדוק את הביטול לפני הפקת הדוח')
    const payable = canceled.length ? canceled.filter(l => isLegacyPayableCancellation(l.teacher_absence_reason)) : reported
    if (new Set(canceled.map(l => isLegacyPayableCancellation(l.teacher_absence_reason))).size > 1 ||
      new Set(payable.map(l => JSON.stringify(details(l)))).size > 1) {
      throw new Error('נמצאו נתוני שיעור סותרים; יש לבדוק את הרשומות לפני הפקת הדוח')
    }
    const selected = canceled[0] ?? reported[0]
    if (selected) held.push(selected)
  }

  for (const l of held) {
    const legacy = isLegacyPayableCancellation(l.teacher_absence_reason)
    // Cancellation must be checked BEFORE the makeup branch: old attendance can remain.
    if (l.status === 'teacher_canceled' && !legacy) continue
    if (l.is_makeup && legacy) continue
    const { type, units } = details(l)
    const col = COLUMNS[type]
    const month = ensure(l.date), day = Number(l.date.slice(8))
    if (l.payroll_snapshot_origin === 'legacy_baseline') month.unverifiedLessons++
    if (l.is_makeup) {
      month.dayCounts[day].makeup += units
      if (!month.makeupDates.includes(day)) month.makeupDates.push(day)
      month.makeupTypes[day] ??= {}
      month.makeupTypes[day][type] = (month.makeupTypes[day][type] ?? 0) + units
    } else month.dayCounts[day][col] += units
  }
  const seenExtra = new Map<string, string>()
  for (const item of extraHours) {
    if (item.status !== 'approved' || item.work_date > today) continue
    if (!Number.isInteger(item.minutes) || item.minutes <= 0 || item.minutes > 1440) throw new Error('משך השעות הנוספות אינו תקין')
    if (item.id) {
      const signature = JSON.stringify([item.work_date, item.minutes, item.activity_type])
      const previous = seenExtra.get(item.id)
      if (previous && previous !== signature) throw new Error('נמצאו נתוני שעות נוספות סותרים')
      if (previous) continue
      seenExtra.set(item.id, signature)
    }
    const month = ensure(item.work_date), day = Number(item.work_date.slice(8))
    month.extraHoursDetails[day] ??= []
    month.extraHoursDetails[day].push({ activityType: item.activity_type, minutes: item.minutes })
    month.dayCounts[day].extra_hours = month.extraHoursDetails[day].reduce((sum, row) => sum + row.minutes, 0) / 60
  }
  const approvedSickLessons = [...occurrences.values()].flatMap(rows => rows.find(l =>
    l.status === 'teacher_canceled' && l.teacher_absence_reason === 'מחלת מורה' && l.admin_approval_status === 'approved'
  ) ?? [])
  for (const lesson of approvedSickLessons) {
    const month = ensure(lesson.date), day = Number(lesson.date.slice(8))
    if (lesson.payroll_snapshot_origin === 'legacy_baseline') month.unverifiedLessons++
    month.sickLeaveDetails[day] ??= []
    month.sickLeaveDetails[day].push({ startTime: lesson.start_time.slice(0, 5), lessonType: details(lesson).type })
  }
  for (const month of months.values()) {
    for (const details of Object.values(month.sickLeaveDetails)) details.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }
  for (const [date, tier] of categorizeSickDates(approvedSickLessons)) {
    const month = ensure(date)
    month.sickDays++
    month.sickDates.push(Number(date.slice(8)))
    if (tier === 'unpaid') month.sickUnpaid++
    else if (tier === 'half') month.sickHalf++
    else month.sickFull++
  }
  return [...months.values()].sort((a, b) => b.key.localeCompare(a.key))
}
