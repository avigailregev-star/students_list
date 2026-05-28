'use client'

import { useState, useTransition } from 'react'
import { DAYS_HE } from '@/lib/utils/hebrew'
import { adminAddAvailabilityRange, adminDeleteAvailabilityRange } from './availabilityActions'
import type { TeacherAvailabilityRange } from '@/types/database'

function RangeRow({ range, teacherId, onDeleted }: { range: TeacherAvailabilityRange; teacherId: string; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-none">
      <div>
        <span className="text-sm font-bold text-gray-700">יום {DAYS_HE[range.day_of_week]}</span>
        <span className="text-sm text-gray-500 mr-2">{range.start_time.slice(0, 5)} – {range.end_time.slice(0, 5)}</span>
      </div>
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => { await adminDeleteAvailabilityRange(range.id, teacherId); onDeleted() })}
        className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors disabled:opacity-40"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

function AddRangeForm({ teacherId, onAdded }: { teacherId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3.5 bg-teal-500 hover:bg-teal-600 text-white rounded-2xl font-bold text-sm transition-colors"
      >
        + הוסף טווח זמינות
      </button>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const err = await adminAddAvailabilityRange(formData, teacherId)
      if (err) { setError(err); return }
      setOpen(false)
      onAdded()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-teal-50 border border-teal-200 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-bold text-teal-800">טווח זמינות חדש</p>

      <div>
        <label className="block text-xs font-semibold text-teal-700 mb-1">יום</label>
        <select name="day_of_week" required className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 font-medium">
          {DAYS_HE.slice(0, 6).map((day, i) => (
            <option key={i} value={i}>יום {day}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-teal-700 mb-1">משעה</label>
          <input name="start_time" type="time" required className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"/>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-teal-700 mb-1">עד שעה</label>
          <input name="end_time" type="time" required className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"/>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors">
          {isPending ? 'שומר...' : 'שמור'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null) }} className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">
          ביטול
        </button>
      </div>
    </form>
  )
}

export default function AdminAvailabilityClient({ teacherId, initialRanges }: { teacherId: string; initialRanges: TeacherAvailabilityRange[] }) {
  const [ranges, setRanges] = useState(initialRanges)

  function refresh() { window.location.reload() }

  return (
    <div className="flex flex-col gap-3">
      {ranges.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">המורה לא הגדיר/ה טווחי זמינות עדיין</p>
      )}

      {ranges.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {ranges.map(range => (
            <RangeRow key={range.id} range={range} teacherId={teacherId} onDeleted={refresh} />
          ))}
        </div>
      )}

      <AddRangeForm teacherId={teacherId} onAdded={refresh} />
    </div>
  )
}
