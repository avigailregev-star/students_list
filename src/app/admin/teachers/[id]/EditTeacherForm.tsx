'use client'

import { useState, useTransition } from 'react'
import { updateTeacher } from '../actions'

interface Props {
  teacherId: string
  initialName: string
  initialRate: number
}

export default function EditTeacherForm({ teacherId, initialName, initialRate }: Props) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(initialName)
  const [rate, setRate] = useState(initialRate)

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full bg-teal-500 text-white font-bold text-sm py-3 rounded-2xl hover:bg-teal-600 transition-colors"
      >
        עריכת פרטים ותעריף
      </button>
    )
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        const fd = new FormData()
        fd.set('teacher_id', teacherId)
        fd.set('name', name)
        fd.set('hourly_rate', String(rate))
        startTransition(async () => {
          await updateTeacher(fd)
          setEditing(false)
        })
      }}
      className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3"
    >
      <p className="text-sm font-bold text-gray-700">עריכת מורה</p>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">שם מלא</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">תעריף לשעה (₪)</label>
        <input
          type="number"
          min="0"
          step="10"
          value={rate}
          onChange={e => setRate(Number(e.target.value))}
          dir="ltr"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-teal-500 text-white font-bold text-sm py-2.5 rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-60"
        >
          {isPending ? 'שומר...' : 'שמור'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex-1 bg-gray-100 text-gray-600 font-bold text-sm py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
        >
          ביטול
        </button>
      </div>
    </form>
  )
}
