'use client'

import { useState, useTransition } from 'react'
import type { AttendanceStatus } from '@/types/database'

interface Props {
  lessonId: string
  studentId: string
  studentName: string
  initialStatus: AttendanceStatus | null
  initialBrought: boolean
}

export default function AttendanceToggle({
  lessonId,
  studentId,
  studentName,
  initialStatus,
  initialBrought,
}: Props) {
  const [status, setStatus] = useState<AttendanceStatus | null>(initialStatus)
  const [brought, setBrought] = useState(initialBrought)
  const [isPending, startTransition] = useTransition()

  async function handleStatus(newStatus: AttendanceStatus) {
    const next = status === newStatus ? null : newStatus
    setStatus(next)
    startTransition(async () => {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, studentId, status: next ?? 'absent', broughtInstrument: brought }),
      })
    })
  }

  async function handleBrought() {
    const next = !brought
    setBrought(next)
    if (status) {
      startTransition(async () => {
        await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId, studentId, status, broughtInstrument: next }),
        })
      })
    }
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm px-3.5 py-3 flex items-center gap-2.5 transition-all ${
      isPending ? 'opacity-70' : ''
    }`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${
        status === 'present' ? 'bg-emerald-500'
        : status === 'absent' ? 'bg-red-400'
        : status === 'late' ? 'bg-amber-400'
        : 'bg-gray-200'
      }`}>
        <span className={status ? 'text-white' : 'text-gray-500'}>
          {studentName.charAt(0)}
        </span>
      </div>

      <p className="flex-1 text-sm font-bold text-gray-800 truncate">{studentName}</p>

      {/* Brought instrument */}
      {status === 'present' && (
        <button
          onClick={handleBrought}
          className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-colors ${
            brought ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-teal-50'
          }`}
        >
          כלי
        </button>
      )}

      {/* Status buttons */}
      {([
        { s: 'present' as AttendanceStatus, label: 'הגיע', active: 'bg-emerald-500 text-white' },
        { s: 'absent'  as AttendanceStatus, label: 'חסר',  active: 'bg-red-400 text-white' },
        { s: 'late'    as AttendanceStatus, label: 'איחר', active: 'bg-amber-400 text-white' },
      ]).map(({ s, label, active }) => (
        <button
          key={s}
          onClick={() => handleStatus(s)}
          className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-colors min-w-[42px] ${
            status === s ? active : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
