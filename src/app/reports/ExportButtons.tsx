'use client'

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

const STATUS_LABEL: Record<string, string> = {
  present:          'הגיע',
  late:             'איחר',
  absent:           'חסר',
  teacher_canceled: 'ביטול',
  school_event:     'אירוע',
  excused:          'מוצדק',
  no_data:          '',
}

function formatDateCSV(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
}

function cell(val: string | number): string {
  const s = String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function payrollStatus(h: HistoryEntry): string {
  if (h.status === 'teacher_canceled') {
    const r = h.cancelReason ?? ''
    if (r === 'מחלת מורה')                                  return 'אישור מחלה'
    if (r === 'ביטול מוצד (עד פעמיים בשנה)')               return 'לא לתשלום'
    if (r === 'העדרות מורה עם השלמה עתידית')                return 'לא לתשלום'
    if (r === 'ביטול ללא הודעה')                            return 'לתשלום'
    if (r === 'העדרות מורה עם השלמה בתלוש נוכחי')          return 'לתשלום'
    return 'לא לתשלום'
  }
  if (h.status === 'present' || h.status === 'late' || h.status === 'absent') return 'לתשלום'
  return ''
}

export default function ExportButtons({ reportData, month, teacherName }: Props) {
  function exportCSV() {
    const BOM = '﻿'
    const rows: string[] = []

    // Single flat table — one row per student per lesson date
    rows.push(['תאריך', 'שם שיעור', 'שם תלמיד', 'נוכחות', 'איחור', 'הביא כלי'].map(cell).join(','))

    for (const group of reportData) {
      for (const s of group.students) {
        for (const h of [...s.history].sort((a, b) => a.date.localeCompare(b.date))) {
          if (h.status === 'school_event' || h.status === 'no_data') continue

          let nokchut: string
          if (h.status === 'present')               nokchut = 'נוכח'
          else if (h.status === 'late')             nokchut = 'איחר'
          else if (h.status === 'absent')           nokchut = 'חסר'
          else if (h.status === 'teacher_canceled') nokchut = h.cancelReason ?? 'ביטול'
          else                                      nokchut = ''

          rows.push([
            formatDateCSV(h.date),
            group.name,
            s.name,
            nokchut,
            h.status === 'late' ? 1 : 0,
            h.brought ? 1 : 0,
          ].map(cell).join(','))
        }
      }
    }

    const csv = BOM + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `דוח-נוכחות-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPayroll() {
    const BOM = '﻿'
    const rows: string[] = []

    rows.push(`שם מורה: ${teacherName}`)
    rows.push('')
    rows.push(['תאריך', 'שם קבוצה', 'סטטוס', 'סיבה'].map(cell).join(','))

    for (const group of reportData) {
      // One row per lesson (deduplicate by date — take first student's entry)
      const seenDates = new Map<string, HistoryEntry>()
      for (const s of group.students) {
        for (const h of s.history) {
          if (!seenDates.has(h.date)) seenDates.set(h.date, h)
        }
      }

      for (const [, h] of [...seenDates.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        if (h.status === 'school_event' || h.status === 'no_data') continue
        const pStatus = payrollStatus(h)
        if (!pStatus) continue
        let lessonStatus: string
        if (h.status === 'present')               lessonStatus = 'נכח'
        else if (h.status === 'late')             lessonStatus = 'איחר'
        else if (h.status === 'absent')           lessonStatus = 'חסר'
        else if (h.status === 'teacher_canceled') lessonStatus = h.cancelReason ?? 'ביטול'
        else                                      lessonStatus = ''
        rows.push([
          formatDateCSV(h.date),
          group.name,
          lessonStatus,
          pStatus,
        ].map(cell).join(','))
      }
    }

    const csv = BOM + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `חשבות-שכר-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function printReport() {
    window.print()
  }

  return (
    <div className="flex gap-2 mt-1 flex-wrap">
      <button
        onClick={exportCSV}
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
