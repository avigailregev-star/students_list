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
}

const STATUS_DOT: Record<string, string> = {
  present:  'bg-emerald-500',
  late:     'bg-amber-400',
  absent:   'bg-red-500',
  excused:  'bg-gray-300',
  no_data:  'bg-gray-100',
}

export default function ReportGroup({ group }: { group: GroupWithData }) {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      {/* Group header */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">{group.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {group.total_lessons} שיעורים · {group.students.length} תלמידים
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
          group.lesson_type === 'group'
            ? 'bg-violet-100 text-violet-700'
            : 'bg-pink-100 text-pink-700'
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
              {/* Student row */}
              <button
                onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-right"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                  {student.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {/* Progress bar */}
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                      {pct}%
                    </span>
                  </div>
                </div>
                {/* Stats */}
                <div className="flex gap-2 text-center shrink-0">
                  <div>
                    <p className="text-sm font-bold text-emerald-600">{student.lessons_attended}</p>
                    <p className="text-[9px] text-gray-400">הגיע</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-500">{student.lessons_absent}</p>
                    <p className="text-[9px] text-gray-400">חסר</p>
                  </div>
                  <div className="text-gray-300 text-xs mt-1">
                    {isExpanded ? '▲' : '▼'}
                  </div>
                </div>
              </button>

              {/* Expandable history */}
              {isExpanded && (
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">היסטוריית שיעורים</p>
                  {student.history.length === 0 && (
                    <p className="text-xs text-gray-400">אין היסטוריה עדיין</p>
                  )}
                  <div className="flex flex-col gap-1.5">
                    {student.history.map((h, i) => {
                      const date = new Date(h.date + 'T12:00:00')
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[h.status] ?? STATUS_DOT.no_data}`} />
                          <span className="text-xs text-gray-600 flex-1">{formatDateHe(date)}</span>
                          {h.brought && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-semibold">🎸 כלי</span>}
                          <span className={`text-[10px] font-semibold ${
                            h.status === 'present' ? 'text-emerald-600' :
                            h.status === 'absent' ? 'text-red-500' :
                            h.status === 'late' ? 'text-amber-600' : 'text-gray-400'
                          }`}>
                            {h.status === 'present' ? 'הגיע' : h.status === 'absent' ? 'חסר' : h.status === 'late' ? 'איחר' : h.status === 'excused' ? 'מוצדק' : '—'}
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
