'use client'

import { useState, useTransition } from 'react'
import { deleteTeacher } from '../actions'

export default function DeleteTeacherButton({ teacherId }: { teacherId: string }) {
  const [confirm, setConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteTeacher(teacherId)
    })
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="w-full py-3 border-2 border-dashed border-red-200 text-red-400 text-sm rounded-2xl hover:border-red-400 hover:text-red-600 transition-colors"
      >
        מחק מורה
      </button>
    )
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-sm font-bold text-red-800 text-center">למחוק את המורה לצמיתות?</p>
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="flex-1 bg-red-500 text-white font-bold text-sm py-2.5 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-60"
        >
          {isPending ? 'מוחק...' : 'כן, מחק'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="flex-1 bg-gray-100 text-gray-600 font-bold text-sm py-2.5 rounded-xl"
        >
          ביטול
        </button>
      </div>
    </div>
  )
}
