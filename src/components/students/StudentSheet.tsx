'use client'

import { useState, useTransition } from 'react'
import type { Student } from '@/types/database'
import { saveStudent } from '@/app/groups/[id]/actions'

interface Props {
  groupId: string
  student?: Student
  onClose: () => void
}

export default function StudentSheet({ groupId, student, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await saveStudent(formData)
        onClose()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'שגיאה בשמירה')
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-2xl p-5 pb-8 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-bold mb-5">
          {student ? 'עריכת תלמיד' : 'הוספת תלמיד'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="group_id" value={groupId} />
          {student && <input type="hidden" name="student_id" value={student.id} />}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">שם מלא</label>
            <input
              name="name"
              required
              defaultValue={student?.name ?? ''}
              placeholder="שם ושם משפחה"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">כלי נגינה</label>
            <input
              name="instrument"
              defaultValue={student?.instrument ?? ''}
              placeholder="לדוגמה: גיטרה, פסנתר..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">טלפון הורה</label>
            <input
              name="parent_phone"
              type="tel"
              defaultValue={student?.parent_phone ?? ''}
              placeholder="050-0000000"
              dir="ltr"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-gradient-to-l from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-60"
          >
            {isPending ? 'שומר...' : 'שמור'}
          </button>
        </form>
      </div>
    </div>
  )
}
