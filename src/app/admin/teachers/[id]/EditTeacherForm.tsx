'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTeacher, inviteTeacher, resetTeacherToPending } from '../actions'

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
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [newUserId, setNewUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const router = useRouter()

  // Invite section for pending teachers
  if (isPending) {
    if (inviteLink) {
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div>
              <p className="text-sm font-bold text-emerald-800">ההזמנה נוצרה בהצלחה</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                נשלח מייל הזמנה לכתובת <span className="font-bold">{inviteEmail}</span>. אם המייל לא מגיע, אפשר להעתיק את הקישור ולשלוח אותו ידנית (למשל בוואטסאפ).
              </p>
            </div>
          </div>
          <input
            type="text"
            readOnly
            value={inviteLink}
            dir="ltr"
            onFocus={e => e.currentTarget.select()}
            className="w-full px-3 py-2.5 border border-emerald-200 bg-white rounded-xl text-xs text-gray-600"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteLink)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
            >
              {copied ? 'הועתק!' : 'העתק קישור'}
            </button>
            <button
              type="button"
              onClick={() => router.push(newUserId ? `/admin/teachers/${newUserId}` : '/admin/teachers')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm py-2.5 rounded-xl transition-colors"
            >
              המשך
            </button>
          </div>
          <p className="text-[11px] text-gray-400 text-center">הקישור בתוקף ל-24 שעות</p>
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
              const result = await inviteTeacher(teacherId, inviteEmail.trim(), initialName)
              if (result.error) { setInviteError(result.error); return }
              setInviteLink(result.link ?? null)
              setNewUserId(result.newUserId ?? null)
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

      {email && (
        <button
          type="button"
          disabled={isPendingTransition}
          onClick={() => {
            if (!confirm('למחוק את המייל ולאפס את המורה למצב ממתין?')) return
            startTransition(async () => {
              await resetTeacherToPending(teacherId)
            })
          }}
          className="w-full text-xs text-red-400 hover:text-red-600 py-1 transition-colors disabled:opacity-40"
        >
          מחיקת מייל ואיפוס להזמנה מחדש
        </button>
      )}
    </form>
  )
}
