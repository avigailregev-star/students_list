'use client'

import * as XLSX from 'xlsx'

interface HistoryEntry {
  date: string
  status: string
  brought: boolean
  cancelReason?: string
}

interface StudentRow {
  name: string
  total_lessons: number
  lessons_attended: number
  lessons_absent: number
  brought_instrument: number
  history: HistoryEntry[]
}

interface GroupRow {
  name: string
  lesson_type: string
  total_lessons: number
  students: StudentRow[]
}

interface Props {
  reportData: GroupRow[]
  month: string
  teacherName: string
}

function formatDateStr(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
}

function downloadXlsx(
  rows: (string | number)[][],
  filename: string,
  colWidths: number[],
  merges?: XLSX.Range[],
) {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = colWidths.map(w => ({ wch: w }))
  ws['!views'] = [{ rightToLeft: true }]
  if (merges) ws['!merges'] = merges
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'דוח')
  XLSX.writeFile(wb, filename)
}

export default function ExportButtons({ reportData, month, teacherName }: Props) {
  function exportAttendance() {
    const header = ['תאריך', 'שם שיעור', 'שם תלמיד', 'נוכחות', 'איחור', 'הביא כלי']

    type DataRow = { date: string; cols: (string | number)[] }
    const dataRows: DataRow[] = []

    for (const group of reportData) {
      for (const s of group.students) {
        for (const h of s.history) {
          if (h.status === 'school_event' || h.status === 'no_data') continue

          let nokchut: string
          if (h.status === 'present')               nokchut = 'נוכח'
          else if (h.status === 'late')             nokchut = 'איחר'
          else if (h.status === 'absent')           nokchut = 'חסר'
          else if (h.status === 'teacher_canceled') nokchut = h.cancelReason ?? 'ביטול'
          else                                      nokchut = ''

          dataRows.push({
            date: h.date,
            cols: [formatDateStr(h.date), group.name, s.name, nokchut, h.status === 'late' ? 1 : 0, h.brought ? 1 : 0],
          })
        }
      }
    }

    dataRows.sort((a, b) => a.date.localeCompare(b.date))
    const rows = [header, ...dataRows.map(r => r.cols)]
    downloadXlsx(rows, `דוח-נוכחות-${month}.xlsx`, [12, 30, 20, 15, 8, 10])
  }

  function exportPayroll() {
    const parts = month.split('-')
    const year = parseInt(parts[0])
    const monthNum = parseInt(parts[1])
    const daysInMonth = new Date(year, monthNum, 0).getDate()

    const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
    const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    const monthDisplay = hebrewMonths[monthNum - 1]

    type ColKey = 'individual_45' | 'individual_60' | 'melodies' | 'ensemble' | 'theory' | 'makeup'
    const mkEmpty = (): Record<ColKey, number> => ({
      individual_45: 0, individual_60: 0, melodies: 0, ensemble: 0, theory: 0, makeup: 0,
    })

    function mapType(t: string): ColKey | null {
      if (t === 'individual_45') return 'individual_45'
      if (t === 'individual_60') return 'individual_60'
      if (t === 'melodies_individual' || t === 'melodies_group') return 'melodies'
      if (t === 'orchestra' || t === 'choir' || t === 'group') return 'ensemble'
      if (t === 'theory') return 'theory'
      return null
    }

    const dayCounts = new Map<number, Record<ColKey, number>>()
    for (let d = 1; d <= 31; d++) dayCounts.set(d, mkEmpty())
    const sickDates = new Set<string>()

    for (const group of reportData) {
      const seenDates = new Map<string, HistoryEntry>()
      for (const s of group.students) {
        for (const h of s.history) {
          if (!seenDates.has(h.date)) seenDates.set(h.date, h)
          else if (h.status === 'teacher_canceled') seenDates.set(h.date, h)
        }
      }

      for (const [dateStr, h] of seenDates) {
        if (!dateStr.startsWith(month)) continue
        if (h.status === 'school_event' || h.status === 'no_data') continue
        if (h.status === 'teacher_canceled') {
          if (h.cancelReason === 'מחלת מורה') sickDates.add(dateStr)
          continue
        }
        const dayNum = parseInt(dateStr.split('-')[2])
        const counts = dayCounts.get(dayNum)
        const col = mapType(group.lesson_type)
        if (counts && col) counts[col]++
      }
    }

    const dayAbbrev = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"]
    const COLS = 9
    const blank = (): (string | number)[] => new Array(COLS).fill('')

    const rows: (string | number)[][] = []
    // Row 0: כותרת ראשית
    rows.push(['קונסרבטוריון דימונה - מבית רשת המרכזים הקהילתיים', '', '', '', '', '', '', '', ''])
    // Row 1: חודש + שנה + ת.ז
    rows.push([`דו"ח עבודה לחודש: ${monthDisplay}`, '', '', `שנה: ${year}`, '', 'ת.ז:', '', '', ''])
    // Row 2: פרטי עובד
    rows.push([`שם ומשפחה: ${teacherName}`, '', '', '', 'תפקיד:', '', 'עיר מגורים:', '', ''])
    // Row 3: ריק
    rows.push(blank())
    // Row 4: "פעילות" מעל עמודות השיעורים
    rows.push(['', '', 'פעילות', '', '', '', '', '', ''])
    // Row 5: כותרות עמודות
    rows.push(['תאריך', 'יום', "פרטני 45 דק'", "פרטני 60 דק'", 'מנגינות', 'הרכבים/תזמורות', 'תיאוריה', 'השלמות/החלפות', 'סה"כ'])
    // Row 6: "מס' שיעורים" תחת כל עמודת שיעור
    rows.push(['', '', "מס' שיעורים", "מס' שיעורים", "מס' שיעורים", "מס' שיעורים", "מס' שיעורים", "מס' שיעורים", ''])
    // Row 7: ריק
    rows.push(blank())

    const totals = mkEmpty()
    let grandTotal = 0

    for (let d = 1; d <= 31; d++) {
      if (d > daysInMonth) {
        rows.push([d, '', '', '', '', '', '', '', ''])
        continue
      }
      const dayName = dayAbbrev[new Date(year, monthNum - 1, d).getDay()]
      const c = dayCounts.get(d)!
      const rowTotal = c.individual_45 + c.individual_60 + c.melodies + c.ensemble + c.theory + c.makeup
      totals.individual_45 += c.individual_45
      totals.individual_60 += c.individual_60
      totals.melodies += c.melodies
      totals.ensemble += c.ensemble
      totals.theory += c.theory
      totals.makeup += c.makeup
      grandTotal += rowTotal
      rows.push([
        d,
        dayName,
        c.individual_45 || '',
        c.individual_60 || '',
        c.melodies || '',
        c.ensemble || '',
        c.theory || '',
        c.makeup || '',
        rowTotal || '',
      ])
    }

    rows.push([
      'סה"כ', '',
      totals.individual_45 || '',
      totals.individual_60 || '',
      totals.melodies || '',
      totals.ensemble || '',
      totals.theory || '',
      totals.makeup || '',
      grandTotal || '',
    ])
    rows.push(blank())
    rows.push(['ימי בחירה/חופשה:', '', '', '', '', '', '', '', ''])
    rows.push(['ימי מחלה:', sickDates.size || '', '', '', '', '', '', '', ''])
    rows.push(blank())
    rows.push(['חתימת המורה: _______________', '', '', '', 'חתימת מנהל: _______________', '', '', '', ''])

    const merges: XLSX.Range[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } }, // כותרת ראשית
      { s: { r: 4, c: 2 }, e: { r: 4, c: COLS - 1 } }, // "פעילות"
    ]

    downloadXlsx(
      rows,
      `חשבות-שכר-${month}.xlsx`,
      [8, 6, 13, 13, 12, 18, 12, 18, 10],
      merges,
    )
  }

  function printReport() {
    window.print()
  }

  return (
    <div className="flex gap-2 mt-1 flex-wrap">
      <button
        onClick={exportAttendance}
        className="flex items-center gap-1.5 bg-white border border-teal-200 text-teal-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-teal-50 transition-colors shadow-sm"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        ייצוא לאקסל / שיטס
      </button>
      <button
        onClick={exportPayroll}
        className="flex items-center gap-1.5 bg-white border border-violet-200 text-violet-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-violet-50 transition-colors shadow-sm"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        חשבות שכר
      </button>
      <button
        onClick={printReport}
        className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        הדפסה
      </button>
    </div>
  )
}
