'use client'

import { useState, useTransition } from 'react'
import type { Student } from '@/types/database'
import StudentSheet from './StudentSheet'
import { removeStudent } from '@/app/groups/[id]/actions'

interface Props {
  students: Student[]
  groupId: string
}

export default function StudentList({ students, groupId }: Props) {
  const [editingStudent, setEditingStudent] = useState<Student | undefined>()
  const [showAdd, setShowAdd] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleDelete(student: Student) {
    if (!confirm(`למחוק את ${student.name}?`)) return
    setDeletingId(student.id)
    startTransition(async () => {
      await removeStudent(student.id, groupId)
      setDeletingId(null)
    })
  }

  return (
    <div>
      {/* Student rows */}
      <div className="flex flex-col gap-2 mb-4">
        {students.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            אין תלמידים עדיין — הוסיפי את הראשון!
          </p>
        )}
        {students.map(student => (
          <div
            key={student.id}
            className={`bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity ${
              deletingId === student.id ? 'opacity-40' : ''
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
              {student.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {[student.instrument, student.parent_phone].filter(Boolean).join(' · ') || 'אין פרטים נוספים'}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setEditingStudent(student)}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-indigo-100 flex items-center justify-center text-sm transition-colors"
                aria-label="עריכה"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDelete(student)}
                disabled={isPending}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-red-100 flex items-center justify-center text-sm transition-colors disabled:opacity-40"
                aria-label="מחיקה"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowAdd(true)}
        className="w-full border-2 border-dashed border-indigo-200 text-indigo-600 font-semibold text-sm py-3 rounded-xl hover:bg-indigo-50 transition-colors"
      >
        ＋ הוסף תלמיד
      </button>

      {/* Sheets */}
      {showAdd && (
        <StudentSheet groupId={groupId} onClose={() => setShowAdd(false)} />
      )}
      {editingStudent && (
        <StudentSheet
          groupId={groupId}
          student={editingStudent}
          onClose={() => setEditingStudent(undefined)}
        />
      )}
    </div>
  )
}
