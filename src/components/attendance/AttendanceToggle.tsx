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

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; bg: string; text: string }> = {
  present:  { label: 'הגיע',     bg: 'bg-emerald-500', text: 'text-white' },
  absent:   { label: 'לא הגיע', bg: 'bg-red-500',     text: 'text-white' },
  late:     { label: 'איחר',     bg: 'bg-amber-400',   text: 'text-white' },
  excused:  { label: 'מוצדק',   bg: 'bg-gray-300',    text: 'text-gray-700' },
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
        body: JSON.stringify({
          lessonId,
          studentId,
          status: next ?? 'absent',
          broughtInstrument: brought,
        }),
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
          body: JSON.stringify({
            lessonId,
            studentId,
            status,
            broughtInstrument: next,
          }),
        })
      })
    }
  }

  return (
    <div className={`bg-white border rounded-xl px-3 py-2.5 flex items-center gap-2 transition-all ${
      isPending ? 'opacity-70' : ''
    } ${status === 'present' ? 'border-emerald-200' : status === 'absent' ? 'border-red-200' : 'border-gray-100'}`}>

      {/* Avatar + name */}
      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
        {studentName.charAt(0)}
      </div>
      <p className="flex-1 text-sm font-semibold text-gray-800 truncate">{studentName}</p>

      {/* Brought instrument */}
      {status === 'present' && (
        <button
          onClick={handleBrought}
          className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
            brought
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-blue-50'
          }`}
        >
          🎸 כלי
        </button>
      )}

      {/* Status buttons */}
      {(['present', 'absent', 'late'] as AttendanceStatus[]).map(s => {
        const cfg = STATUS_CONFIG[s]
        const active = status === s
        return (
          <button
            key={s}
            onClick={() => handleStatus(s)}
            className={`text-[10px] font-bold px-2 py-1.5 rounded-lg transition-colors min-w-[44px] ${
              active
                ? `${cfg.bg} ${cfg.text}`
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {cfg.label}
          </button>
        )
      })}
    </div>
  )
}
