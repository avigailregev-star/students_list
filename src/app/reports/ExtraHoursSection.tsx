'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ExtraHoursRequest } from '@/types/database'
import { submitExtraHoursRequest } from './extraHoursActions'

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function StatusBadge({ status }: { status: ExtraHoursRequest['status'] }) {
  if (status === 'approved') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">אושר</span>
  if (status === 'rejected') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">נדחה</span>
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">ממתין</span>
}

export default function ExtraHoursSection({ initialRequests, viewOnly = false }: { initialRequests: ExtraHoursRequest[]; viewOnly?: boolean }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setError('')
    startTransition(async () => {
      const result = await submitExtraHoursRequest(new FormData(form))
      if (result.error === 'unauthorized') return router.push('/login')
      if (result.error) return setError(result.error)
      form.reset()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <section className="px-4 pb-6 max-w-md mx-auto w-full flex flex-col gap-4 print:hidden" dir="rtl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-700">שעות נוספות</p>
        {!open && !viewOnly && <button onClick={() => setOpen(true)} className="px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700">+ בקשת שעות נוספות</button>}
      </div>

      {open && (
        <form onSubmit={submit} className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-sm font-bold text-violet-800">בקשת שעות נוספות חדשה</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-violet-700">תאריך הפעילות<input name="work_date" type="date" required className="mt-1 w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-sm" /></label>
            <label className="text-xs font-semibold text-violet-700">סוג הפעילות<select name="activity_type" required defaultValue="" className="mt-1 w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-sm"><option value="" disabled>בחירה...</option><option>ישיבת צוות</option><option>חזרה</option><option>אירוע</option><option>עבודה מנהלתית</option><option>אחר</option></select></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-violet-700">שעות<input name="hours" type="number" min="0" max="24" defaultValue="0" required className="mt-1 w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-sm" /></label>
            <label className="text-xs font-semibold text-violet-700">דקות<input name="minutes" type="number" min="0" max="59" step="1" defaultValue="0" required className="mt-1 w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-sm" /></label>
          </div>
          <label className="text-xs font-semibold text-violet-700">פירוט<textarea name="note" rows={2} placeholder="מה סוכם עם המנהל?" className="mt-1 w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-sm resize-none" /></label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2"><button disabled={isPending} className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">{isPending ? 'שולחת...' : 'שלחי בקשה'}</button><button type="button" onClick={() => { setOpen(false); setError('') }} className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm font-bold">ביטול</button></div>
        </form>
      )}

      {!initialRequests.length && !open && <p className="text-xs text-gray-400 text-center py-3">אין בקשות לשעות נוספות</p>}
      {initialRequests.map(req => <div key={req.id} className="bg-white rounded-2xl shadow-sm px-4 py-3.5 border-r-4 border-violet-300"><div className="flex items-center justify-between"><StatusBadge status={req.status} /><span className="text-sm font-bold text-violet-700">{formatMinutes(req.minutes)} שעות</span></div><p className="text-sm font-semibold text-gray-800 mt-2">{new Date(req.work_date + 'T12:00:00').toLocaleDateString('he-IL')} · {req.activity_type}</p>{req.note && <p className="text-xs text-gray-500 mt-1">{req.note}</p>}<p className="text-[10px] text-gray-400 mt-1">{req.source === 'admin' ? 'נוסף על ידי המנהל' : 'בקשת מורה'}</p>{req.admin_note && <p className={`text-xs mt-2 rounded-lg px-2 py-1 ${req.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}`}>הערת מנהל: {req.admin_note}</p>}</div>)}
    </section>
  )
}
