'use client'

import { useState, useTransition } from 'react'
import { DAYS_HE } from '@/lib/utils/hebrew'
import { addAvailabilityRange, deleteAvailabilityRange } from './actions'
import type { TeacherAvailabilityRange } from '@/types/database'

function RangeRow({ range, onDeleted }: { range: TeacherAvailabilityRange; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()
  const start = range.start_time.slice(0, 5)
  const end = range.end_time.slice(0, 5)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-none">
      <span className="text-sm font-semibold text-gray-800">{start} – {end}</span>
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => { await deleteAvailabilityRange(range.id); onDeleted() })}
        className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors disabled:opacity-40"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

function AddRangeForm({ onAdded }: { onAdded: () => void }) {
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
      const err = await addAvailabilityRange(formData)
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

export default function AvailabilityClient({ initialRanges }: { initialRanges: TeacherAvailabilityRange[] }) {
  const [ranges, setRanges] = useState(initialRanges)

  function refreshFromServer() { window.location.reload() }

  const byDay = DAYS_HE.slice(0, 6).map((day, i) => ({
    day,
    dayIndex: i,
    ranges: ranges.filter(r => r.day_of_week === i),
  })).filter(d => d.ranges.length > 0)

  return (
    <div className="px-4 py-5 max-w-md mx-auto w-full space-y-4">
      {ranges.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          <p className="text-3xl mb-3">📅</p>
          <p>עדיין אין טווחי זמינות</p>
          <p className="text-xs mt-1">הוסיפי ימים ושעות שאת פנויה</p>
        </div>
      )}

      {byDay.map(({ day, dayIndex, ranges: dayRanges }) => (
        <div key={dayIndex} className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-700">יום {day}</span>
            <span className="text-xs text-gray-400">{dayRanges.length} טווח{dayRanges.length !== 1 ? 'ים' : ''}</span>
          </div>
          {dayRanges.map(r => (
            <RangeRow key={r.id} range={r} onDeleted={refreshFromServer}/>
          ))}
        </div>
      ))}

      <AddRangeForm onAdded={refreshFromServer}/>
    </div>
  )
}
