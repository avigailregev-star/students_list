'use client'

import { useState, useTransition } from 'react'
import type { LessonType, GroupWithSchedulesAndStudents } from '@/types/database'
import { LESSON_TYPE_OPTIONS } from '@/lib/utils/lessonTypes'
import { DAYS_HE } from '@/lib/utils/hebrew'
import { createGroupForTeacher, updateGroup, addStudentToGroup, removeStudentFromGroup } from './groupActions'

interface Props {
  teacherId: string
  group?: GroupWithSchedulesAndStudents
  isOpen: boolean
  onClose: () => void
}

interface PendingStudent {
  id: number
  name: string
  instrument: string
  parentPhone: string
}

export default function AdminGroupSheet({ teacherId, group, isOpen, onClose }: Props) {
  const isEdit = !!group
  const schedule = group?.group_schedules?.[0]

  const [lessonType, setLessonType] = useState<LessonType>(group?.lesson_type ?? 'group')
  const [name, setName] = useState(group?.name ?? '')
  const [dayOfWeek, setDayOfWeek] = useState<number>(schedule?.day_of_week ?? 0)
  const [startTime, setStartTime] = useState(schedule?.start_time?.slice(0, 5) ?? '')
  const [endTime, setEndTime] = useState(schedule?.end_time?.slice(0, 5) ?? '')
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([])
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentInstrument, setNewStudentInstrument] = useState('')
  const [newStudentPhone, setNewStudentPhone] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  function addPendingStudent() {
    if (!newStudentName.trim()) return
    setPendingStudents(prev => [...prev, { id: Date.now(), name: newStudentName.trim(), instrument: newStudentInstrument.trim(), parentPhone: newStudentPhone.trim() }])
    setNewStudentName('')
    setNewStudentInstrument('')
    setNewStudentPhone('')
  }

  function handleSave() {
    setError(null)
    // Auto-add any student typed but not yet confirmed
    const allStudents = newStudentName.trim()
      ? [...pendingStudents, { id: Date.now(), name: newStudentName.trim(), instrument: newStudentInstrument.trim(), parentPhone: newStudentPhone.trim() }]
      : pendingStudents
    const data = { name, lessonType, dayOfWeek, startTime, endTime: endTime || undefined, students: allStudents }
    startTransition(async () => {
      if (isEdit) {
        const res = await updateGroup(group.id, teacherId, { ...data, students: [] })
        if (res.error) { setError(res.error); return }
        for (const s of allStudents) {
          const r = await addStudentToGroup(group.id, teacherId, s)
          if (r.error) { setError(r.error); return }
        }
      } else {
        const res = await createGroupForTeacher(teacherId, data)
        if (res.error) { setError(res.error); return }
      }
      onClose()
    })
  }

  function handleRemoveExistingStudent(studentId: string) {
    startTransition(async () => {
      const res = await removeStudentFromGroup(studentId, teacherId)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-[72px] z-[100] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white w-full rounded-t-3xl flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 144px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'עריכת קבוצה' : 'קבוצה חדשה'}</h2>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-4 pb-2">

          {/* Lesson type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">סוג שיעור</label>
            <select
              value={lessonType}
              onChange={e => {
                const val = e.target.value
                if (LESSON_TYPE_OPTIONS.some(([v]) => v === val)) setLessonType(val as LessonType)
              }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 bg-white"
            >
              {LESSON_TYPE_OPTIONS.map(([value, cfg]) => (
                <option key={value} value={value}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">שם קבוצה</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="לדוגמה: תזמורת א׳"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
            />
          </div>

          {/* Day */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">יום</label>
            <select
              value={dayOfWeek}
              onChange={e => setDayOfWeek(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 bg-white"
            >
              {DAYS_HE.slice(0, 6).map((day, i) => (
                <option key={i} value={i}>{day}</option>
              ))}
            </select>
          </div>

          {/* Time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">שעת התחלה</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" dir="ltr"/>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">שעת סיום (אופציונלי)</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" dir="ltr"/>
            </div>
          </div>

          {/* Students */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">תלמידים</label>

            {/* Existing students (edit mode) */}
            {isEdit && (group.students ?? []).map(s => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl mb-1.5">
                <span className="flex-1 text-sm text-gray-800">{s.name}</span>
                {s.instrument && <span className="text-xs text-gray-400">{s.instrument}</span>}
                <button
                  type="button"
                  aria-label="הסר תלמיד"
                  onClick={() => handleRemoveExistingStudent(s.id)}
                  disabled={isPending}
                  className="w-6 h-6 rounded-md bg-red-100 hover:bg-red-200 flex items-center justify-center text-red-500 shrink-0"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}

            {/* Pending new students */}
            {pendingStudents.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-teal-50 rounded-xl mb-1.5">
                <span className="flex-1 text-sm text-teal-800">{s.name}{s.instrument ? ` · ${s.instrument}` : ''}</span>
                <button type="button" aria-label="הסר תלמיד" onClick={() => setPendingStudents(prev => prev.filter((p) => p.id !== s.id))} className="w-6 h-6 rounded-md bg-teal-100 hover:bg-teal-200 flex items-center justify-center text-teal-600 shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}

            {/* Add student inline form */}
            <div className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2 mt-1">
              <input value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="שם תלמיד" className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:border-teal-400"/>
              <div className="flex gap-2">
                <input value={newStudentInstrument} onChange={e => setNewStudentInstrument(e.target.value)} placeholder="כלי (אופציונלי)" className="flex-1 px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:border-teal-400"/>
                <input value={newStudentPhone} onChange={e => setNewStudentPhone(e.target.value)} placeholder="טל׳ הורה" className="flex-1 px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:border-teal-400" dir="ltr"/>
              </div>
              <button type="button" onClick={addPendingStudent} disabled={!newStudentName.trim()} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg disabled:opacity-40">
                + הוסף תלמיד
              </button>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pt-3 pb-6 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !name.trim() || !startTime}
            className="flex-1 bg-teal-500 text-white font-bold py-3 rounded-2xl hover:bg-teal-600 transition-colors disabled:opacity-60 text-sm"
          >
            {isPending ? 'שומר...' : 'שמור'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl text-sm">
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
