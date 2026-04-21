'use client'

import { useState } from 'react'
import AttendanceToggle from './AttendanceToggle'
import type { AttendanceStatus } from '@/types/database'

interface StudentEntry {
  id: string
  name: string
  initialStatus: AttendanceStatus | null
  initialBrought: boolean
}

interface Props {
  lessonId: string
  students: StudentEntry[]
}

export default function AttendanceSection({ lessonId, students }: Props) {
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | null>>(
    () => Object.fromEntries(students.map(s => [s.id, s.initialStatus]))
  )

  const present = Object.values(statuses).filter(s => s === 'present' || s === 'late').length
  const absent = Object.values(statuses).filter(s => s === 'absent').length

  return (
    <>
      {/* Stats row */}
      <div className="flex gap-2.5 mb-5">
        {[
          { label: 'הגיעו',    value: present,          color: 'text-emerald-500' },
          { label: 'לא הגיעו', value: absent,            color: 'text-red-500' },
          { label: 'סה״כ',     value: students.length,   color: 'text-teal-500' },
        ].map(s => (
          <div key={s.label} className="flex-1 bg-white rounded-2xl shadow-sm py-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Attendance toggles */}
      <div className="flex flex-col gap-2.5">
        {students.map(student => (
          <AttendanceToggle
            key={student.id}
            lessonId={lessonId}
            studentId={student.id}
            studentName={student.name}
            initialStatus={student.initialStatus}
            initialBrought={student.initialBrought}
            onStatusChange={newStatus =>
              setStatuses(prev => ({ ...prev, [student.id]: newStatus }))
            }
          />
        ))}
        {students.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">אין תלמידים בקבוצה זו</p>
        )}
      </div>
    </>
  )
}
