'use client'

interface HistoryEntry {
  date: string
  status: string
  brought: boolean
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

export default function ExportButtons({ reportData, month }: Props) {
  function exportCSV() {
    const BOM = '﻿'
    const rows: string[] = []

    // Single flat table — one row per student per lesson date
    rows.push(['תאריך', 'שם שיעור', 'שם תלמיד', 'הגיע', 'חסר', 'הביא כלי'].map(cell).join(','))

    for (const group of reportData) {
      for (const s of group.students) {
        for (const h of [...s.history].sort((a, b) => a.date.localeCompare(b.date))) {
          if (h.status === 'teacher_canceled' || h.status === 'school_event' || h.status === 'no_data') continue
          const attended = (h.status === 'present' || h.status === 'late') ? 1 : 0
          const absent   = h.status === 'absent' ? 1 : 0
          rows.push([
            formatDateCSV(h.date),
            group.name,
            s.name,
            attended,
            absent,
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

  function printReport() {
    window.print()
  }

  return (
    <div className="flex gap-2 mt-1">
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
