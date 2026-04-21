'use client'

import { useState, useTransition } from 'react'
import type { Student } from '@/types/database'
import StudentSheet from './StudentSheet'
import { removeStudent } from '@/app/groups/[id]/actions'

interface Props {
  students: Student[]
  groupId: string
  readOnly?: boolean
}

export default function StudentList({ students, groupId, readOnly = false }: Props) {
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
      <div className="flex flex-col gap-2.5 mb-4">
        {students.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">
            אין תלמידים עדיין — הוסיפי את הראשון
          </p>
        )}
        {students.map(student => (
          <div
            key={student.id}
            className={`bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3 transition-opacity ${
              deletingId === student.id ? 'opacity-40' : ''
            }`}
          >
            <div className="w-10 h-10 rounded-2xl bg-teal-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {student.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{student.name}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {[student.instrument, student.parent_phone].filter(Boolean).join(' · ') || 'אין פרטים נוספים'}
              </p>
            </div>
            {!readOnly && (
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => setEditingStudent(student)}
                  className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-teal-50 flex items-center justify-center transition-colors"
                  aria-label="עריכה"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(student)}
                  disabled={isPending}
                  className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 flex items-center justify-center transition-colors disabled:opacity-40"
                  aria-label="מחיקה"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full border-2 border-dashed border-teal-200 text-teal-600 font-bold text-sm py-3.5 rounded-2xl hover:bg-teal-50 transition-colors"
        >
          + הוסף תלמיד
        </button>
      )}

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
