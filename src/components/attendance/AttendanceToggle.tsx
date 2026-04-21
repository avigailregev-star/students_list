'use client'

import { useState, useTransition } from 'react'
import type { AttendanceStatus } from '@/types/database'

interface Props {
  lessonId: string
  studentId: string
  studentName: string
  initialStatus: AttendanceStatus | null
  initialBrought: boolean
  onStatusChange?: (status: AttendanceStatus | null) => void
}

export default function AttendanceToggle({
  lessonId,
  studentId,
  studentName,
  initialStatus,
  initialBrought,
  onStatusChange,
}: Props) {
  const [status, setStatus] = useState<AttendanceStatus | null>(initialStatus)
  const [brought, setBrought] = useState(initialBrought)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(!!initialStatus)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function save(newStatus: AttendanceStatus | null, newBrought: boolean) {
    setSaveError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessonId,
            studentId,
            status: newStatus ?? 'absent',
            broughtInstrument: newBrought,
          }),
        })
        if (res.ok) {
          setSaved(true)
        } else {
          const body = await res.json().catch(() => ({}))
          setSaveError(body.error ?? `שגיאה ${res.status}`)
        }
      } catch {
        setSaveError('שגיאת רשת')
      }
    })
  }

  async function handleStatus(newStatus: AttendanceStatus) {
    const next = status === newStatus ? null : newStatus
    const nextBrought = next === 'present' ? brought : false
    if (next !== 'present') setBrought(false)
    setStatus(next)
    setSaved(false)
    onStatusChange?.(next)
    save(next, nextBrought)
  }

  async function handleBrought() {
    const next = !brought
    setBrought(next)
    if (status) save(status, next)
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

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{studentName}</p>
        {saveError && (
          <p className="text-[10px] text-red-500 font-semibold">{saveError}</p>
        )}
        {!saveError && saved && status && (
          <p className="text-[10px] text-emerald-500 font-semibold">נשמר</p>
        )}
      </div>

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
