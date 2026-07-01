'use client'

import { useState, useTransition } from 'react'
import { mergeTeachers } from '../actions'

interface Teacher {
  id: string
  name: string
  email: string | null
}

interface Props {
  pendingId: string
  registeredTeachers: Teacher[]
}

export default function MergeTeacherButton({ pendingId, registeredTeachers }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 border-2 border-dashed border-blue-300 text-blue-600 font-bold text-sm rounded-2xl hover:border-blue-400 hover:bg-blue-50 transition-colors"
      >
        מיזוג עם מורה רשומה
      </button>
    )
  }

  const selectedTeacher = registeredTeachers.find(t => t.id === selectedId)

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-sm font-bold text-blue-900">מיזוג עם מורה רשומה</p>
      <p className="text-xs text-blue-700">
        הקבוצות יועברו למורה שתבחרי, והרשומה הממתינה תימחק. הפעולה לא הפיכה.
      </p>

      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="w-full px-4 py-2.5 border border-blue-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-400"
      >
        <option value="">בחרי מורה רשומה...</option>
        {registeredTeachers.map(t => (
          <option key={t.id} value={t.id}>
            {t.name}{t.email ? ` (${t.email})` : ''}
          </option>
        ))}
      </select>

      {selectedTeacher && (
        <p className="text-xs text-blue-600">
          הקבוצות יועברו אל: <span className="font-bold">{selectedTeacher.name}</span>
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          disabled={isPending || !selectedId}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const err = await mergeTeachers(pendingId, selectedId)
              if (err) setError(err)
            })
          }}
          className="flex-1 bg-blue-500 text-white font-bold text-sm py-2.5 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-60"
        >
          {isPending ? 'ממזג...' : 'בצעי מיזוג'}
        </button>
        <button
          onClick={() => { setOpen(false); setSelectedId(''); setError(null) }}
          className="flex-1 bg-gray-100 text-gray-600 font-bold text-sm py-2.5 rounded-xl"
        >
          ביטול
        </button>
      </div>
    </div>
  )
}
