'use client'

import { useState, useTransition } from 'react'
import { createPendingTeacher } from './actions'

export default function AddTeacherButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleOpen() { setOpen(true); setName(''); setError(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const err = await createPendingTeacher(name.trim())
      if (err) { setError(err); return }
      setOpen(false)
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full py-3 border-2 border-dashed border-teal-300 text-teal-600 font-bold text-sm rounded-2xl hover:border-teal-400 hover:bg-teal-50 transition-colors"
      >
        + הוסף מורה
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-28 max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-gray-900 mb-4">הוספת מורה חדשה</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">שם מלא</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="שם המורה"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
                />
              </div>

              <p className="text-xs text-gray-400">
                ניתן להוסיף אימייל ולשלוח הזמנה בהמשך, מתוך פרופיל המורה.
              </p>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending || !name.trim()}
                  className="flex-1 bg-teal-500 text-white font-bold py-3 rounded-2xl hover:bg-teal-600 transition-colors disabled:opacity-60 text-sm"
                >
                  {isPending ? 'שומר...' : 'הוסף מורה'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl text-sm"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
