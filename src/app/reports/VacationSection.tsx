// src/app/reports/VacationSection.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { VacationRequest } from '@/types/database'
import { submitVacationRequest } from './vacationActions'

interface Props {
  initialRequests: VacationRequest[]
  viewOnly?: boolean
}

function StatusBadge({ status }: { status: VacationRequest['status'] }) {
  if (status === 'approved')
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">אושר</span>
  if (status === 'rejected')
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">נדחה</span>
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">ממתין</span>
}

export default function VacationSection({ initialRequests, viewOnly }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await submitVacationRequest(formData)
      if (result.error === 'unauthorized') { router.push('/login'); return }
      if (result.error) { setError(result.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="px-4 pb-6 max-w-md mx-auto w-full flex flex-col gap-4 print:hidden" dir="rtl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-700">בקשות חופשה</p>
        {!open && !viewOnly && (
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 transition-colors"
          >
            + בקשי חופשה
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-sm font-bold text-teal-800">בקשת חופשה חדשה</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-teal-700 mb-1">מתאריך</label>
              <input
                name="start_date"
                type="date"
                required
                className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-teal-700 mb-1">עד תאריך</label>
              <input
                name="end_date"
                type="date"
                required
                className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-teal-700 mb-1">הערה (אופציונלי)</label>
            <textarea
              name="note"
              rows={2}
              placeholder="סיבה או פרטים נוספים..."
              className="w-full border border-teal-200 bg-white rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-400"
              dir="rtl"
            />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors"
            >
              {isPending ? 'שולחת...' : 'שלחי'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError('') }}
              className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      {initialRequests.length === 0 && !open && (
        <p className="text-xs text-gray-400 text-center py-4">אין בקשות חופשה</p>
      )}

      {initialRequests.map(req => (
        <div key={req.id} className="bg-white rounded-2xl shadow-sm px-4 py-3.5">
          <div className="flex items-center justify-between mb-1">
            <StatusBadge status={req.status} />
            <span className="text-[10px] text-gray-400">
              {new Date(req.created_at).toLocaleDateString('he-IL')}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-1">
            {new Date(req.start_date + 'T12:00:00').toLocaleDateString('he-IL')} –{' '}
            {new Date(req.end_date + 'T12:00:00').toLocaleDateString('he-IL')}
          </p>
          {req.note && <p className="text-xs text-gray-500 mt-1">{req.note}</p>}
          {req.status === 'rejected' && req.admin_note && (
            <p className="text-xs text-red-600 mt-1 bg-red-50 rounded-lg px-2 py-1">
              הערת המזכירות: {req.admin_note}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
