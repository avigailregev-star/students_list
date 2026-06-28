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
        // Teacher has no auth account yet — create invite
        err = await inviteTeacher(teacherId, finalEmail, name)
      } else {
        // Teacher already has auth account — send recovery/set-password link
        err = await resendTeacherInvite(teacherId, finalEmail, name)
      }
      if (err) { setStatus('error'); setErrorMsg(err) }
      else setStatus('sent')
    })
  }

  return (
    <div className="flex flex-col gap-2 bg-teal-50 border border-teal-200 rounded-2xl p-4">
      <p className="text-xs font-bold text-teal-700 text-right">שליחת הזמנה למייל</p>

      {!email && (
        <input
          type="email"
          value={inputEmail}
          onChange={e => setInputEmail(e.target.value)}
          placeholder="כתובת מייל..."
          dir="ltr"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
        />
      )}
      {email && (
        <p className="text-xs text-gray-500 text-right">{email}</p>
      )}

      <button
        onClick={handleSend}
        disabled={isPendingTransition || status === 'sent' || !inputEmail.trim()}
        className={`flex items-center justify-center gap-2 w-full py-2.5 font-bold text-sm rounded-xl transition-colors disabled:opacity-60 ${
          status === 'sent'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-teal-500 text-white hover:bg-teal-600'
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
