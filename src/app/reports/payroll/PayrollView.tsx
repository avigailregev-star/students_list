'use client'

import * as XLSX from 'xlsx'
import { Fragment } from 'react'
import type { MonthPayroll, DayCount } from './page'

import { DAY_ABBREV, formatMakeupTypes, formatHours, formatSickLeaveDetails, buildMonthWorksheet } from '@/lib/payroll/worksheet'
import { totalLessonUnits, isWorkDay } from '@/lib/payroll/calculate'

export default function PayrollView({ months, teacherName }: { months: MonthPayroll[]; teacherName: string }) {
  if (!months.length) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-20">אין נתוני שעות</div>
  }

  function exportAllMonths() {
    const workbook = XLSX.utils.book_new()
    for (const month of months) {
      XLSX.utils.book_append_sheet(workbook, buildMonthWorksheet(month, teacherName), month.label.slice(0, 31))
    }
    const safeTeacherName = teacherName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'מורה'
    XLSX.writeFile(workbook, `דוח-שעות-${safeTeacherName}-כל-החודשים.xlsx`)
  }

  return (
    <div className="px-3 pt-4">
      <div className="print:hidden mb-5 flex flex-wrap gap-2">
        <button
          onClick={exportAllMonths}
          className="flex items-center gap-1.5 bg-white border border-teal-200 text-teal-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-teal-50 transition-colors shadow-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          ייצוא דוח שעות לאקסל
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          הדפסת כל החודשים
        </button>
      </div>

      {months.map((month, i) => (
        <div
          key={month.key}
          className="mb-10"
          style={{ pageBreakAfter: i < months.length - 1 ? 'always' : 'auto' }}
        >
          <MonthTable month={month} teacherName={teacherName} />
        </div>
      ))}
    </div>
  )
}

function MonthTable({ month, teacherName }: { month: MonthPayroll; teacherName: string }) {
  const totals: DayCount = { individual_45: 0, individual_60: 0, melodies: 0, ensemble: 0, theory: 0, darcha: 0, makeup: 0, extra_hours: 0 }
  const totalMakeupTypes: Record<string, number> = {}
  let grandTotal = 0
  let workDays = 0
  for (let d = 1; d <= month.daysInMonth; d++) {
    const c = month.dayCounts[d]
    totals.individual_45 += c.individual_45
    totals.individual_60 += c.individual_60
    totals.melodies += c.melodies
    totals.ensemble += c.ensemble
    totals.theory += c.theory
    totals.darcha += c.darcha
    totals.makeup += c.makeup
    totals.extra_hours += c.extra_hours
    const types = month.makeupTypes[d] ?? {}
    for (const [type, count] of Object.entries(types)) {
      totalMakeupTypes[type] = (totalMakeupTypes[type] ?? 0) + count
    }
    const dayTotal = totalLessonUnits(c)
    grandTotal += dayTotal
    if (isWorkDay(c)) workDays++
  }

  const th = 'border border-gray-400 px-1 py-1 text-center text-[10px] font-bold bg-gray-100'
  const td = 'border border-gray-300 px-1 py-0.5 text-center text-xs'
  const tdL = 'border border-gray-300 px-2 py-1 text-right text-xs font-bold'

  return (
    <div dir="rtl" className="overflow-x-auto">
      {month.unverifiedLessons > 0 && <p className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
        נתוני עבר — טרם אומתו: {month.unverifiedLessons} שיעורים נשמרו לפי החישוב שהוצג בעת העדכון. שינוי מערכת השעות לא ישנה את הנתונים האלה.
      </p>}
      <table className="w-full border-collapse min-w-[640px]" style={{ direction: 'rtl' }}>
        <thead>
          <tr>
            <th colSpan={11} className="border border-gray-400 py-2 text-center text-sm font-bold bg-gray-50">
              קונסרבטוריון דימונה - מבית רשת המרכזים הקהילתיים
            </th>
          </tr>
          <tr>
            <td colSpan={4} className={tdL}>דו&quot;ח עבודה לחודש: {month.label}</td>
            <td colSpan={2} className={td}>שנה: {month.year}</td>
            <td className={tdL}>ת.ז:</td>
            <td colSpan={4} className={td}></td>
          </tr>
          <tr>
            <td colSpan={4} className={tdL}>שם ומשפחה: {teacherName}</td>
            <td colSpan={4} className={tdL}>תפקיד: _______________</td>
            <td colSpan={3} className={tdL}>עיר מגורים: _______________</td>
          </tr>
          <tr>
            <th colSpan={2} className={`${th} bg-gray-50`}></th>
            <th colSpan={8} className={`${th} bg-violet-50 text-violet-700`}>פעילות</th>
            <th className={`${th} bg-gray-50`}></th>
          </tr>
          <tr>
            {['תאריך','יום',"פרטני 45 דק'",'פרטני 60 דק\'','מנגינות','הרכבים/תזמורות','תיאוריה','דרכא לימן','השלמות/החלפות','שעות נוספות','סה"כ שיעורים'].map(h => (
              <th key={h} className={th}>{h}</th>
            ))}
          </tr>
          <tr>
            <th colSpan={2} className="border border-gray-300 bg-gray-50"></th>
            {[...Array(8)].map((_, i) => (
              <th key={i} className="border border-gray-300 px-1 py-0.5 text-center text-[9px] font-normal text-gray-400 bg-gray-50">
                {i === 7 ? 'שעות' : 'מספר שיעורים'}
              </th>
            ))}
            <th className="border border-gray-300 bg-gray-50"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
            const isOver = d > month.daysInMonth
            const dow = isOver ? -1 : new Date(month.year, month.monthNum - 1, d).getDay()
            const isWeekend = dow === 5 || dow === 6
            const isSickDay = !isOver && month.sickDates.includes(d)
            const isMakeupDay = !isOver && month.makeupDates.includes(d)
            const c = month.dayCounts[d]
            const rowTotal = isOver ? 0 : totalLessonUnits(c)
            const sickDetails = isOver ? [] : month.sickLeaveDetails[d] ?? []
            const rowBg = isOver ? 'bg-gray-50' : isSickDay && !isWorkDay(c) ? 'bg-red-50' : isWeekend ? 'bg-gray-100' : ''
            return (
              <Fragment key={d}>
              <tr className={rowBg}>
                <td className={`${td} ${isOver ? 'text-gray-300' : ''}`}>{d}</td>
                <td className={td}>
                  {isOver ? '' : (
                    <span className="flex flex-wrap items-center justify-center gap-1">
                      {DAY_ABBREV[dow]}
                      {isSickDay && <span className="text-red-600 font-bold text-[10px]">מחלה</span>}
                    </span>
                  )}
                </td>
                {isOver ? (
                  [...Array(9)].map((_, i) => <td key={i} className={`${td} bg-gray-50`}></td>)
                ) : (
                  <>
                    <td className={td}>{c.individual_45 || ''}</td>
                    <td className={td}>{c.individual_60 || ''}</td>
                    <td className={td}>{c.melodies || ''}</td>
                    <td className={td}>{c.ensemble || ''}</td>
                    <td className={td}>{c.theory || ''}</td>
                    <td className={td}>{c.darcha || ''}</td>
                    <td className={`${td} ${isMakeupDay ? 'bg-teal-50 text-teal-700 font-bold' : ''}`}>
                      {c.makeup ? (
                        <div className="flex flex-col items-center leading-tight gap-0.5">
                          <span>{c.makeup}</span>
                          {month.makeupTypes[d] && (
                            <span className="text-[8px] font-normal text-teal-600 whitespace-nowrap">
                              {formatMakeupTypes(month.makeupTypes[d])}
                            </span>
                          )}
                        </div>
                      ) : ''}
                    </td>
                    <td className={`${td} ${c.extra_hours ? 'bg-violet-50 text-violet-700 font-bold' : ''}`} title={(month.extraHoursDetails[d] ?? []).map(x => `${x.activityType} — ${formatHours(x.minutes / 60)}`).join('\n')}>
                      {c.extra_hours ? formatHours(c.extra_hours) : ''}
                    </td>
                    <td className={`${td} font-bold`}>{rowTotal || ''}</td>
                  </>
                )}
              </tr>
              {sickDetails.length > 0 && (
                <tr className="bg-red-50 text-red-700">
                  <td colSpan={2} className={td}></td>
                  <td colSpan={9} className="border border-gray-300 px-2 py-1 text-right text-[10px]">
                    <span className="font-bold">פירוט מחלה מאושרת: </span>
                    {formatSickLeaveDetails(sickDetails)}
                  </td>
                </tr>
              )}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100">
            <td colSpan={2} className={tdL}>סה&quot;כ</td>
            <td className={`${td} font-bold`}>{totals.individual_45 || ''}</td>
            <td className={`${td} font-bold`}>{totals.individual_60 || ''}</td>
            <td className={`${td} font-bold`}>{totals.melodies || ''}</td>
            <td className={`${td} font-bold`}>{totals.ensemble || ''}</td>
            <td className={`${td} font-bold`}>{totals.theory || ''}</td>
            <td className={`${td} font-bold`}>{totals.darcha || ''}</td>
            <td className={`${td} font-bold`}>
              {totals.makeup ? (
                <div className="flex flex-col items-center leading-tight gap-0.5">
                  <span>{totals.makeup}</span>
                  {Object.keys(totalMakeupTypes).length > 0 && (
                    <span className="text-[8px] font-normal text-gray-500 whitespace-nowrap">
                      {formatMakeupTypes(totalMakeupTypes)}
                    </span>
                  )}
                </div>
              ) : ''}
            </td>
            <td className={`${td} font-bold text-violet-700`}>{totals.extra_hours ? formatHours(totals.extra_hours) : ''}</td>
            <td className={`${td} font-bold`}>{grandTotal || ''}</td>
          </tr>
          <tr>
            <td colSpan={4} className={tdL}>סך ימי עבודה: {workDays || '___'}</td>
            <td colSpan={7} className={td}></td>
          </tr>
          <tr>
            <td colSpan={4} className={tdL}>ימי בחירה/חופשה: ___</td>
            <td colSpan={7} className={td}></td>
          </tr>
          <tr>
            <td colSpan={4} className={tdL}>
              ימי מחלה: {month.sickDays || '___'}
              {month.sickDays > 0 && (
                <span className="font-normal text-gray-500 mr-2">
                  ({month.sickUnpaid > 0 ? `${month.sickUnpaid} ללא תשלום` : ''}
                  {month.sickHalf > 0 ? `${month.sickUnpaid > 0 ? ', ' : ''}${month.sickHalf} × ½` : ''}
                  {month.sickFull > 0 ? `${(month.sickUnpaid > 0 || month.sickHalf > 0) ? ', ' : ''}${month.sickFull} מלאים` : ''})
                </span>
              )}
            </td>
            <td colSpan={7} className={td}></td>
          </tr>
          <tr>
            <td colSpan={11} className="py-3"></td>
          </tr>
          <tr>
            <td colSpan={5} className={tdL}>חתימת המורה: _______________</td>
            <td colSpan={6} className={tdL}>חתימת מנהל: _______________</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
