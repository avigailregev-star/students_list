'use client'

import { useState, useTransition } from 'react'
import { resendTeacherInvite } from '../actions'

interface Props {
  teacherId: string
  email: string
  name: string
}

export default function ResendInviteButton({ teacherId, email, name }: Props) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function handleClick() {
    setStatus('idle')
    startTransition(async () => {
      const err = await resendTeacherInvite(teacherId, email, name)
      if (err) { setStatus('error'); setErrorMsg(err) }
      else setStatus('sent')
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={isPending || status === 'sent'}
        className={`flex items-center justify-center gap-2 w-full py-3 font-bold text-sm rounded-2xl transition-colors disabled:opacity-60 ${
          status === 'sent'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100'
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {status === 'sent'
            ? <><polyline points="20 6 9 17 4 12"/></>
            : <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>
          }
        </svg>
        {isPending ? 'שולח...' : status === 'sent' ? 'ההזמנה נשלחה!' : 'שלח הזמנה למייל'}
      </button>
      {status === 'error' && (
        <p className="text-xs text-red-500 text-center">{errorMsg}</p>
      )}
    </div>
  )
}
