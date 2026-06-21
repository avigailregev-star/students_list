'use client'

import { useState, useTransition } from 'react'
import { updateTeacher, inviteTeacher } from '../actions'

interface Props {
  teacherId: string
  initialName: string
  isPending: boolean
  email: string | null
}

export default function EditTeacherForm({ teacherId, initialName, isPending, email }: Props) {
  const [editing, setEditing] = useState(false)
  const [isPendingTransition, startTransition] = useTransition()
  const [name, setName] = useState(initialName)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState(false)

  // Invite section for pending teachers
  if (isPending) {
    if (inviteSent) {
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-4 flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <div>
            <p className="text-sm font-bold text-emerald-800">ההזמנה נשלחה בהצלחה</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              נשלח מייל הזמנה לכתובת <span className="font-bold">{inviteEmail}</span> עם קישור להגדרת סיסמה.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <p className="text-sm font-bold text-amber-800">מורה ממתינה לרישום</p>
        </div>
        <p className="text-xs text-amber-700">
          הזיני את האימייל שלה ולחצי "שלח הזמנה" — המורה תקבל קישור להגדרת סיסמה.
        </p>
        <form
          onSubmit={e => {
            e.preventDefault()
            setInviteError(null)
            startTransition(async () => {
              const err = await inviteTeacher(teacherId, inviteEmail.trim(), initialName)
              if (err) { setInviteError(err); return }
              setInviteSent(true)
            })
          }}
          className="flex flex-col gap-2"
        >
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            required
            placeholder="אימייל המורה"
            className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 bg-white"
          />
          {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
          <button
            type="submit"
            disabled={isPendingTransition || !inviteEmail.trim()}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
          >
            {isPendingTransition ? 'שולח...' : 'שלח הזמנה'}
          </button>
        </form>
      </div>
    )
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full bg-teal-500 text-white font-bold text-sm py-3 rounded-2xl hover:bg-teal-600 transition-colors"
      >
        עריכת פרטים
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

      {email && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">אימייל</label>
          <p className="text-sm text-gray-500 px-1">{email}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPendingTransition}
          className="flex-1 bg-teal-500 text-white font-bold text-sm py-2.5 rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-60"
        >
          {isPendingTransition ? 'שומר...' : 'שמור'}
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
