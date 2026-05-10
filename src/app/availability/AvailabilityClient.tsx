'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DAYS_HE } from '@/lib/utils/hebrew'
import { addAvailabilitySlot, toggleAvailabilitySlot, deleteAvailabilitySlot } from './actions'
import type { TeacherAvailability } from '@/types/database'

const LESSON_TYPE_LABELS: Record<'individual' | 'group', string> = {
  individual: 'פרטי',
  group: 'קבוצתי',
}

function SlotCard({ slot, onDeleted }: { slot: TeacherAvailability; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const endHour = slot.start_time.slice(0, 5)

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 ${!slot.is_active ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800">
          יום {DAYS_HE[slot.day_of_week]} · {endHour}
          <span className="text-gray-400 font-normal"> ({slot.duration_minutes} דק׳)</span>
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {slot.instrument} · {LESSON_TYPE_LABELS[slot.lesson_type as 'individual' | 'group']} · {slot.max_students} מקומות
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={isPending}
          onClick={() => startTransition(async () => { await toggleAvailabilitySlot(slot.id, !slot.is_active); router.refresh() })}
          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${slot.is_active ? 'bg-teal-50 text-teal-600 hover:bg-teal-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          {slot.is_active ? 'פעיל' : 'מושהה'}
        </button>
        <button
          disabled={isPending}
          onClick={() => startTransition(async () => { await deleteAvailabilitySlot(slot.id); onDeleted() })}
          className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function AddSlotForm({ onAdded }: { onAdded: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors"
      >
        + הוסף סלוט
      </button>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await addAvailabilitySlot(formData)
        setOpen(false)
        onAdded()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'שגיאה בשמירה')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <p className="text-sm font-bold text-gray-700">סלוט חדש</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">יום</label>
          <select name="day_of_week" required className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300">
            {DAYS_HE.map((day, i) => (
              <option key={i} value={i}>יום {day}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">שעת התחלה</label>
          <input name="start_time" type="time" required className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300"/>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">משך שיעור</label>
        <div className="flex gap-2">
          {([45, 60] as const).map(d => (
            <label key={d} className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 cursor-pointer has-[:checked]:bg-teal-50 has-[:checked]:border-teal-200 transition-colors">
              <input type="radio" name="duration_minutes" value={d} required defaultChecked={d === 45} className="accent-teal-500"/>
              <span className="text-sm font-medium text-gray-700">{d} דק׳</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">כלי נגינה</label>
        <input name="instrument" required placeholder='לדוגמה: גיטרה' className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300"/>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">סוג שיעור</label>
        <div className="flex gap-2">
          {(['individual', 'group'] as const).map(lt => (
            <label key={lt} className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 cursor-pointer has-[:checked]:bg-teal-50 has-[:checked]:border-teal-200 transition-colors">
              <input type="radio" name="lesson_type" value={lt} required defaultChecked={lt === 'individual'} className="accent-teal-500"/>
              <span className="text-sm font-medium text-gray-700">{LESSON_TYPE_LABELS[lt]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">מספר מקומות</label>
        <input name="max_students" type="number" min="1" defaultValue="1" required className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300"/>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
          ביטול
        </button>
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 transition-colors">
          {isPending ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </form>
  )
}

export default function AvailabilityClient({ initialSlots }: { initialSlots: TeacherAvailability[] }) {
  const [slots, setSlots] = useState(initialSlots)
  const [, startTransition] = useTransition()

  function refreshFromServer() {
    startTransition(() => { window.location.reload() })
  }

  const active = slots.filter(s => s.is_active)
  const inactive = slots.filter(s => !s.is_active)

  return (
    <div className="px-4 py-5 max-w-md mx-auto w-full space-y-4">
      {active.length === 0 && inactive.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          <p className="text-3xl mb-3">📅</p>
          <p>עדיין אין סלוטים מוגדרים</p>
          <p className="text-xs mt-1">הוסף סלוט כדי שתלמידים יוכלו להירשם</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">סלוטים פעילים</h2>
          {active.map(s => <SlotCard key={s.id} slot={s} onDeleted={refreshFromServer}/>)}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">מושהים</h2>
          {inactive.map(s => <SlotCard key={s.id} slot={s} onDeleted={refreshFromServer}/>)}
        </div>
      )}

      <AddSlotForm onAdded={refreshFromServer}/>
    </div>
  )
}
