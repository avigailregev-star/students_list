import * as XLSX from 'xlsx'
import { totalLessonUnits, isWorkDay, type MonthPayroll, type DayCount } from './calculate'
import { LESSON_TYPE_CONFIG } from '@/lib/utils/lessonTypes'
import type { LessonType } from '@/types/database'

export const DAY_ABBREV = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"]

const TYPE_SHORT: Record<string, string> = {
  individual_45: "פ45'",
  individual_60: "פ60'",
  melodies_individual: 'מנ',
  melodies_group: 'מנ',
  group: 'מנ',
  orchestra: 'הר',
  choir: 'הר',
  theory: 'תא',
  darcha: 'ד',
}

export function formatMakeupTypes(types: Record<string, number>): string {
  const merged: Record<string, number> = {}
  for (const [type, count] of Object.entries(types)) {
    const short = TYPE_SHORT[type] ?? type
    merged[short] = (merged[short] ?? 0) + count
  }
  return Object.entries(merged)
    .map(([label, count]) => count > 1 ? `${label}×${count}` : label)
    .join(' · ')
}

export function formatHours(value: number) {
  const minutes = Math.round(value * 60)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

export function formatSickLeaveDetails(details: MonthPayroll['sickLeaveDetails'][number]): string {
  return details.map(item => `${item.startTime} — ${LESSON_TYPE_CONFIG[item.lessonType as LessonType]?.label ?? item.lessonType}`).join(' · ')
}

export function buildMonthWorksheet(month: MonthPayroll, teacherName: string) {
  const headers = ['תאריך', 'יום', "פרטני 45 דק'", "פרטני 60 דק'", 'מנגינות', 'הרכבים/תזמורות', 'תיאוריה', 'דרכא לימן', 'השלמות/החלפות', 'שעות נוספות', 'סה"כ שיעורים']
  const rows: (string | number)[][] = [
    ['קונסרבטוריון דימונה - מבית רשת המרכזים הקהילתיים'],
    [`דו"ח עבודה לחודש: ${month.label}`, '', '', '', `שנה: ${month.year}`, '', 'ת.ז:', '', '', '', ''],
    [`שם ומשפחה: ${teacherName}`, '', '', '', 'תפקיד: _______________', '', '', '', 'עיר מגורים: _______________', '', ''],
    [],
    ['', '', 'פעילות'],
    headers,
    ['', '', ...Array(7).fill("מס' שיעורים"), 'שעות', ''],
  ]

  const totals: DayCount = { individual_45: 0, individual_60: 0, melodies: 0, ensemble: 0, theory: 0, darcha: 0, makeup: 0, extra_hours: 0 }
  let grandTotal = 0
  let workDays = 0
  const sickDetailMerges: XLSX.Range[] = []

  for (let d = 1; d <= 31; d++) {
    if (d > month.daysInMonth) {
      rows.push([d, '', '', '', '', '', '', '', '', '', ''])
      continue
    }

    const c = month.dayCounts[d]
    const dayTotal = totalLessonUnits(c)
    const dayName = DAY_ABBREV[new Date(month.year, month.monthNum - 1, d).getDay()]
    totals.individual_45 += c.individual_45
    totals.individual_60 += c.individual_60
    totals.melodies += c.melodies
    totals.ensemble += c.ensemble
    totals.theory += c.theory
    totals.darcha += c.darcha
    totals.makeup += c.makeup
    totals.extra_hours += c.extra_hours
    grandTotal += dayTotal
    if (isWorkDay(c)) workDays++

    rows.push([
      d,
      month.sickDates.includes(d) ? `${dayName} — מחלה` : dayName,
      c.individual_45 || '',
      c.individual_60 || '',
      c.melodies || '',
      c.ensemble || '',
      c.theory || '',
      c.darcha || '',
      c.makeup ? `${c.makeup}${month.makeupTypes[d] ? ` (${formatMakeupTypes(month.makeupTypes[d])})` : ''}` : '',
      c.extra_hours ? formatHours(c.extra_hours) : '',
      dayTotal || '',
    ])
    const sickDetails = month.sickLeaveDetails[d] ?? []
    if (sickDetails.length) {
      sickDetailMerges.push({ s: { r: rows.length, c: 2 }, e: { r: rows.length, c: 10 } })
      rows.push(['', '', `פירוט מחלה מאושרת: ${formatSickLeaveDetails(sickDetails)}`])
    }
  }

  rows.push([
    'סה"כ', '', totals.individual_45 || '', totals.individual_60 || '', totals.melodies || '',
    totals.ensemble || '', totals.theory || '', totals.darcha || '', totals.makeup || '',
    totals.extra_hours ? formatHours(totals.extra_hours) : '', grandTotal || '',
  ])
  rows.push([])
  rows.push([`סך ימי עבודה: ${workDays || '___'}`])
  rows.push(['ימי בחירה/חופשה: ___'])
  rows.push([`ימי מחלה: ${month.sickDays || '___'}`])
  if (month.unverifiedLessons > 0) rows.push([`נתוני עבר — טרם אומתו: ${month.unverifiedLessons} שיעורים נשמרו לפי החישוב שהוצג בעת העדכון`])
  rows.push([])
  rows.push(['חתימת המורה: _______________', '', '', '', '', 'חתימת מנהל: _______________'])

  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet['!cols'] = [8, 16, 15, 15, 12, 20, 12, 14, 25, 14, 10].map(wch => ({ wch }))
  worksheet['!views'] = [{ rightToLeft: true }]
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    { s: { r: 4, c: 2 }, e: { r: 4, c: 9 } },
    ...sickDetailMerges,
  ]
  return worksheet
}
