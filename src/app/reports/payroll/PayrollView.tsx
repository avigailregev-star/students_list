'use client'

import type { MonthPayroll, DayCount } from './page'

const DAY_ABBREV = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"]

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

function formatMakeupTypes(types: Record<string, number>): string {
  const merged: Record<string, number> = {}
  for (const [type, count] of Object.entries(types)) {
    const short = TYPE_SHORT[type] ?? type
    merged[short] = (merged[short] ?? 0) + count
  }
  return Object.entries(merged)
    .map(([label, count]) => count > 1 ? `${label}×${count}` : label)
    .join(' · ')
}

function total(c: DayCount) {
  return c.individual_45 + c.individual_60 + c.melodies + c.ensemble + c.theory + c.darcha + c.makeup
}

export default function PayrollView({ months, teacherName }: { months: MonthPayroll[]; teacherName: string }) {
  if (!months.length) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-20">אין נתוני שכר</div>
  }

  return (
    <div className="px-3 pt-4">
      <button
        onClick={() => window.print()}
        className="print:hidden mb-5 flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        הדפסת כל החודשים
      </button>

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
  const totals: DayCount = { individual_45: 0, individual_60: 0, melodies: 0, ensemble: 0, theory: 0, darcha: 0, makeup: 0 }
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
    const types = month.makeupTypes[d] ?? {}
    for (const [type, count] of Object.entries(types)) {
      totalMakeupTypes[type] = (totalMakeupTypes[type] ?? 0) + count
    }
    const dayTotal = total(c)
    grandTotal += dayTotal
    if (dayTotal > 0) workDays++
  }

  const th = 'border border-gray-400 px-1 py-1 text-center text-[10px] font-bold bg-gray-100'
  const td = 'border border-gray-300 px-1 py-0.5 text-center text-xs'
  const tdL = 'border border-gray-300 px-2 py-1 text-right text-xs font-bold'

  return (
    <div dir="rtl" className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[640px]" style={{ direction: 'rtl' }}>
        <thead>
          <tr>
            <th colSpan={10} className="border border-gray-400 py-2 text-center text-sm font-bold bg-gray-50">
              קונסרבטוריון דימונה - מבית רשת המרכזים הקהילתיים
            </th>
          </tr>
          <tr>
            <td colSpan={4} className={tdL}>דו&quot;ח עבודה לחודש: {month.label}</td>
            <td colSpan={2} className={td}>שנה: {month.year}</td>
            <td className={tdL}>ת.ז:</td>
            <td colSpan={3} className={td}></td>
          </tr>
          <tr>
            <td colSpan={3} className={tdL}>שם ומשפחה: {teacherName}</td>
            <td colSpan={4} className={tdL}>תפקיד: _______________</td>
            <td colSpan={3} className={tdL}>עיר מגורים: _______________</td>
          </tr>
          <tr>
            <th colSpan={2} className={`${th} bg-gray-50`}></th>
            <th colSpan={7} className={`${th} bg-violet-50 text-violet-700`}>פעילות</th>
            <th className={`${th} bg-gray-50`}></th>
          </tr>
          <tr>
            {['תאריך','יום',"פרטני 45 דק'",'פרטני 60 דק\'','מנגינות','הרכבים/תזמורות','תיאוריה','דרכא לימן','השלמות/החלפות','סה"כ'].map(h => (
              <th key={h} className={th}>{h}</th>
            ))}
          </tr>
          <tr>
            <th colSpan={2} className="border border-gray-300 bg-gray-50"></th>
            {[...Array(7)].map((_, i) => (
              <th key={i} className="border border-gray-300 px-1 py-0.5 text-center text-[9px] font-normal text-gray-400 bg-gray-50">
                מס&apos; שיעורים
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
            const rowTotal = isOver ? 0 : total(c)
            const rowBg = isOver ? 'bg-gray-50' : isSickDay ? 'bg-red-50' : isWeekend ? 'bg-gray-100' : ''
            return (
              <tr key={d} className={rowBg}>
                <td className={`${td} ${isOver ? 'text-gray-300' : ''}`}>{d}</td>
                <td className={td}>
                  {isOver ? '' : (
                    <span className="flex items-center justify-center gap-0.5">
                      {DAY_ABBREV[dow]}
                      {isSickDay && <span className="text-red-600 font-bold text-[8px] leading-none">ח</span>}
                    </span>
                  )}
                </td>
                {isOver ? (
                  [...Array(8)].map((_, i) => <td key={i} className={`${td} bg-gray-50`}></td>)
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
                    <td className={`${td} font-bold`}>{rowTotal || ''}</td>
                  </>
                )}
              </tr>
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
            <td className={`${td} font-bold`}>{grandTotal || ''}</td>
          </tr>
          <tr>
            <td colSpan={4} className={tdL}>סך ימי עבודה: {workDays || '___'}</td>
            <td colSpan={6} className={td}></td>
          </tr>
          <tr>
            <td colSpan={4} className={tdL}>ימי בחירה/חופשה: ___</td>
            <td colSpan={6} className={td}></td>
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
            <td colSpan={6} className={td}></td>
          </tr>
          <tr>
            <td colSpan={10} className="py-3"></td>
          </tr>
          <tr>
            <td colSpan={5} className={tdL}>חתימת המורה: _______________</td>
            <td colSpan={5} className={tdL}>חתימת מנהל: _______________</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
