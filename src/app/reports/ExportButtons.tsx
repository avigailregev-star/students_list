'use client'

interface StudentRow {
  name: string
  total_lessons: number
  lessons_attended: number
  lessons_absent: number
  brought_instrument: number
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

export default function ExportButtons({ reportData, month }: Props) {
  function exportCSV() {
    const BOM = '\uFEFF' // UTF-8 BOM so Hebrew shows correctly in Excel
    const rows: string[] = []

    rows.push(`דוח נוכחות — ${month}`)
    rows.push('')
    rows.push('קבוצה,סוג,תלמיד,סה"כ שיעורים,הגיע,חסר,אחוז נוכחות,הביא כלי')

    for (const group of reportData) {
      const typeLabel = group.lesson_type === 'group' ? 'קבוצה' : 'יחיד'
      for (const s of group.students) {
        const pct = s.total_lessons > 0
          ? Math.round((s.lessons_attended / s.total_lessons) * 100)
          : 0
        rows.push([
          group.name,
          typeLabel,
          s.name,
          s.total_lessons,
          s.lessons_attended,
          s.lessons_absent,
          `${pct}%`,
          s.brought_instrument,
        ].join(','))
      }
      rows.push('')
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
