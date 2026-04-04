'use client'

import { useState } from 'react'
import type { Group, Student } from '@/types/database'
import { formatDateHe } from '@/lib/utils/hebrew'

type StudentWithStats = Student & {
  total_lessons: number
  lessons_attended: number
  lessons_absent: number
  brought_instrument: number
  history: { date: string; status: string; brought: boolean }[]
}

type GroupWithData = Group & {
  students: StudentWithStats[]
  total_lessons: number
  canceled_lessons: number
}

const STATUS_DOT: Record<string, string> = {
  present:          'bg-emerald-500',
  late:             'bg-amber-400',
  absent:           'bg-red-400',
  excused:          'bg-gray-300',
  no_data:          'bg-gray-100',
  teacher_canceled: 'bg-orange-400',
}

export default function ReportGroup({ group }: { group: GroupWithData }) {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Group header */}
      <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm ${
            group.lesson_type === 'group' ? 'bg-teal-500' : 'bg-violet-500'
          }`}>
            {group.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{group.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {group.total_lessons} שיעורים{group.canceled_lessons > 0 ? ` · ${group.canceled_lessons} בוטלו` : ''} · {group.students.length} תלמידים
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl ${
          group.lesson_type === 'group' ? 'bg-teal-50 text-teal-600' : 'bg-violet-50 text-violet-600'
        }`}>
          {group.lesson_type === 'group' ? 'קבוצה' : 'יחיד'}
        </span>
      </div>

      {/* Students */}
      <div className="divide-y divide-gray-50">
        {group.students.length === 0 && (
          <p className="text-center text-gray-400 text-xs py-5">אין תלמידים</p>
        )}
        {group.students.map(student => {
          const pct = student.total_lessons > 0
            ? Math.round((student.lessons_attended / student.total_lessons) * 100)
            : 0
          const isExpanded = expandedStudent === student.id

          return (
            <div key={student.id}>
              <button
                onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-right"
              >
                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs shrink-0">
                  {student.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 80 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold tabular-nums ${
                      pct >= 80 ? 'text-emerald-500' : pct >= 60 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 text-center shrink-0">
                  <div>
                    <p className="text-sm font-bold text-emerald-500 tabular-nums">{student.lessons_attended}</p>
                    <p className="text-[9px] text-gray-400 font-medium">הגיע</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-400 tabular-nums">{student.lessons_absent}</p>
                    <p className="text-[9px] text-gray-400 font-medium">חסר</p>
                  </div>
                  <div className="text-gray-300 text-xs mt-1">{isExpanded ? '▲' : '▼'}</div>
                </div>
              </button>

              {isExpanded && (
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">היסטוריית שיעורים</p>
                  {student.history.length === 0 && (
                    <p className="text-xs text-gray-400">אין היסטוריה עדיין</p>
                  )}
                  <div className="flex flex-col gap-2">
                    {student.history.map((h, i) => {
                      const date = new Date(h.date + 'T12:00:00')
                      return (
                        <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[h.status] ?? STATUS_DOT.no_data}`} />
                          <span className="text-xs font-bold text-gray-700 flex-1">{formatDateHe(date)}</span>
                          {h.brought && (
                            <span className="text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-lg font-bold">כלי</span>
                          )}
                          <span className={`text-xs font-bold ${
                            h.status === 'present' ? 'text-emerald-500' :
                            h.status === 'absent' ? 'text-red-400' :
                            h.status === 'late' ? 'text-amber-500' :
                            h.status === 'teacher_canceled' ? 'text-orange-500' : 'text-gray-400'
                          }`}>
                            {h.status === 'present' ? 'הגיע' :
                             h.status === 'absent' ? 'חסר' :
                             h.status === 'late' ? 'איחר' :
                             h.status === 'excused' ? 'מוצדק' :
                             h.status === 'teacher_canceled' ? 'ביטול מורה' : '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
