'use client'

import { useState, useTransition } from 'react'
import { resendTeacherInvite, inviteTeacher } from '../actions'

interface Props {
  teacherId: string
  email: string | null
  name: string
  isPending: boolean
}

export default function ResendInviteButton({ teacherId, email, name, isPending }: Props) {
  const [inputEmail, setInputEmail] = useState(email ?? '')
  const [isPendingTransition, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function handleSend() {
    const finalEmail = inputEmail.trim()
    if (!finalEmail) return
    setStatus('idle')
    startTransition(async () => {
      let err: string | void
      if (isPending) {
        err = await inviteTeacher(teacherId, finalEmail, name)
      } else {
        err = await resendTeacherInvite(teacherId, finalEmail, name)
      }
      if (err) { setStatus('error'); setErrorMsg(err) }
      else setStatus('sent')
    })
  }

  const title = isPending ? 'מורה ממתינה לרישום' : 'שליחת קישור כניסה'
  const description = isPending
    ? `הזני את האימייל שלה ולחצי 'שלח הזמנה' — המורה תקבל קישור להגדרת סיסמה.`
    : `שלח למורה קישור חדש להגדרת סיסמה.`

  return (
    <div className="flex flex-col gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-center justify-end gap-2">
        <p className="text-sm font-bold text-amber-800">{title}</p>
        <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" />
      </div>
      <p className="text-xs text-gray-500 text-right leading-relaxed">{description}</p>

      {!email ? (
        <input
          type="email"
          value={inputEmail}
          onChange={e => setInputEmail(e.target.value)}
          placeholder="אימייל המורה"
          dir="ltr"
          className="w-full border border-amber-200 bg-white rounded-xl px-3 py-2.5 text-sm text-right focus:outline-none focus:border-amber-400 placeholder:text-right"
        />
      ) : (
        <p className="text-xs text-gray-400 text-right">{email}</p>
      )}

      <button
        onClick={handleSend}
        disabled={isPendingTransition || status === 'sent' || !inputEmail.trim()}
        className={`flex items-center justify-center gap-2 w-full py-3 font-bold text-sm rounded-xl transition-colors disabled:opacity-60 ${
          status === 'sent'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-amber-400 text-white hover:bg-amber-500'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {status === 'sent'
            ? <polyline points="20 6 9 17 4 12"/>
            : <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>
          }
        </svg>
        {isPendingTransition ? 'שולח...' : status === 'sent' ? 'ההזמנה נשלחה!' : 'שלח הזמנה'}
      </button>

      {status === 'error' && (
        <p className="text-xs text-red-500 text-center">{errorMsg}</p>
      )}
    </div>
  )
}
