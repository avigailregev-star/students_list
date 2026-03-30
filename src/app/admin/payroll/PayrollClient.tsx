'use client'

import { useState, useMemo } from 'react'

interface Teacher { id: string; name: string; hourly_rate: number }
interface Group   { id: string; teacher_id: string }
interface Lesson  { id: string; group_id: string; date: string; status: string }

interface Props {
  teachers: Teacher[]
  groups: Group[]
  lessons: Lesson[]
}

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

export default function PayrollClient({ teachers, groups, lessons }: Props) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  // Map groupId → teacherId
  const groupToTeacher = useMemo(() => {
    const m: Record<string, string> = {}
    for (const g of groups) m[g.id] = g.teacher_id
    return m
  }, [groups])

  // Filter lessons for selected month
  const monthLessons = useMemo(() =>
    lessons.filter(l => {
      const d = new Date(l.date)
      return d.getMonth() === month && d.getFullYear() === year
    }),
  [lessons, month, year])

  // Compute per-teacher stats
  const payrollData = useMemo(() =>
    teachers.map(t => {
      const myLessons = monthLessons.filter(l => groupToTeacher[l.group_id] === t.id)
      const completed = myLessons.filter(l => l.status === 'completed' || l.status === 'scheduled').length
      const canceled  = myLessons.filter(l => l.status === 'teacher_canceled').length
      const holiday   = myLessons.filter(l => l.status === 'holiday').length
      const pay = completed * t.hourly_rate
      return { ...t, completed, canceled, holiday, pay, total: myLessons.length }
    }).sort((a, b) => b.pay - a.pay),
  [teachers, monthLessons, groupToTeacher])

  const totalPay = payrollData.reduce((s, t) => s + t.pay, 0)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function exportCSV() {
    const BOM = '\uFEFF'
    const header = 'מורה,שיעורים הושלמו,ביטולים,חגים,תעריף,סה"כ שכר'
    const rows = payrollData.map(t =>
      `${t.name},${t.completed},${t.canceled},${t.holiday},₪${t.hourly_rate},₪${t.pay}`
    )
    const csv = BOM + [header, ...rows, `סה"כ,,,,,₪${totalPay}`].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `שכר_${MONTHS_HE[month]}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-4 py-5 flex flex-col gap-4">
      {/* Month picker */}
      <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between">
        <button onClick={prevMonth} className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-gray-900">{MONTHS_HE[month]} {year}</p>
          <p className="text-xs text-gray-400">{payrollData.filter(t => t.total > 0).length} מורים פעילים</p>
        </div>
        <button onClick={nextMonth} className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      {/* Total summary */}
      <div className="bg-gradient-to-bl from-emerald-400 to-emerald-600 text-white rounded-2xl px-4 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-emerald-100 uppercase tracking-widest">סה״כ לתשלום</p>
          <p className="text-3xl font-bold mt-0.5">₪{totalPay.toLocaleString()}</p>
        </div>
        <button
          onClick={exportCSV}
          className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          CSV
        </button>
      </div>

      {/* Teacher rows */}
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">פירוט לפי מורה</p>

      {payrollData.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">אין מורים עדיין</p>
      )}

      {payrollData.map(t => (
        <div key={t.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Top row */}
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {t.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{t.name}</p>
              <p className="text-xs text-gray-400">₪{t.hourly_rate}/שעה</p>
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-emerald-600">₪{t.pay.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">{t.completed} שיעורים</p>
            </div>
          </div>

          {/* Stats bar */}
          {t.total > 0 && (
            <div className="px-4 pb-3 grid grid-cols-3 gap-2 border-t border-gray-50 pt-2.5">
              {[
                { label: 'הושלמו', value: t.completed, color: 'text-emerald-500' },
                { label: 'בוטלו',  value: t.canceled,  color: 'text-red-400' },
                { label: 'חגים',   value: t.holiday,   color: 'text-amber-500' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {t.total === 0 && (
            <p className="text-xs text-gray-400 px-4 pb-3">אין שיעורים בחודש זה</p>
          )}
        </div>
      ))}
    </div>
  )
}
