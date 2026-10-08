'use client'

import Link from 'next/link'
import { emptyMonth, type MonthPayroll } from '@/lib/payroll/calculate'
import { buildMonthWorksheet } from '@/lib/payroll/worksheet'
import * as XLSX from 'xlsx'
import type { AdminApprovalStatus } from '@/types/database'

interface HistoryEntry {
  lessonId?: string
  startTime?: string
  units?: number
  date: string
  status: string
  brought: boolean
  cancelReason?: string
  cancelApprovalStatus?: AdminApprovalStatus | null
  isMakeup?: boolean
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
  group_schedules?: { start_time: string; end_time: string | null }[]
  payrollLessons?: HistoryEntry[]
  name: string
  lesson_type: string
  total_lessons: number
  students: StudentRow[]
}

interface Props {
  reportData: GroupRow[]
  month: string
  teacherName: string
  payrollMonths: MonthPayroll[]
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

export default function ExportButtons({ reportData, month, teacherName, payrollMonths }: Props) {
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
    const payroll = payrollMonths.find(item => item.key === month) ?? emptyMonth(month)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, buildMonthWorksheet(payroll, teacherName), 'דוח')
    XLSX.writeFile(workbook, `דוח-שעות-${month}.xlsx`)
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
        דוח שעות
      </button>
      <Link
        href="/reports/payroll"
        className="flex items-center gap-1.5 bg-white border border-violet-200 text-violet-600 text-xs font-bold px-3 py-2 rounded-xl hover:bg-violet-50 transition-colors shadow-sm"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        כל החודשים
      </Link>
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
