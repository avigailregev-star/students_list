'use client'

import { useState, useTransition } from 'react'
import { resendTeacherInvite } from '../actions'

interface Props {
  teacherId: string
  email: string | null
  name: string
}

export default function ResendInviteButton({ teacherId, email, name }: Props) {
  const [inputEmail, setInputEmail] = useState(email ?? '')
  const [isPendingTransition, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'link' | 'error'>('idle')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  function handleSend() {
    const finalEmail = inputEmail.trim()
    if (!finalEmail) return
    setStatus('idle')
    startTransition(async () => {
      const result = await resendTeacherInvite(teacherId, finalEmail, name)
      if (result.error) { setStatus('error'); setErrorMsg(result.error); return }
      setLink(result.link ?? '')
      setStatus('link')
    })
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === 'link') {
    return (
      <div className="flex flex-col gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
        <p className="text-xs text-gray-500 text-right leading-relaxed">
          אם המייל לא מגיע, אפשר להעתיק את הקישור ולשלוח אותו ידנית (למשל בוואטסאפ).
        </p>
        <input
          type="text"
          readOnly
          value={link}
          dir="ltr"
          onFocus={e => e.currentTarget.select()}
          className="w-full px-3 py-2.5 border border-emerald-200 bg-white rounded-xl text-xs text-gray-600"
        />
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 font-bold text-sm rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            {copied ? 'הועתק!' : 'העתק קישור'}
          </button>
          <button
            onClick={() => setStatus('idle')}
            className="flex-1 py-2.5 font-bold text-sm rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            סגירה
          </button>
        </div>
        <p className="text-[11px] text-gray-400 text-center">הקישור בתוקף ל-24 שעות</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-center justify-end gap-2">
        <p className="text-sm font-bold text-amber-800">שליחת קישור כניסה</p>
        <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" />
      </div>
      <p className="text-xs text-gray-500 text-right leading-relaxed">שלח למורה קישור חדש להגדרת סיסמה.</p>

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
        disabled={isPendingTransition || !inputEmail.trim()}
        className="flex items-center justify-center gap-2 w-full py-3 font-bold text-sm rounded-xl transition-colors disabled:opacity-60 bg-amber-400 text-white hover:bg-amber-500"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        {isPendingTransition ? 'שולח...' : 'שלח הזמנה'}
      </button>

      {status === 'error' && (
        <p className="text-xs text-red-500 text-center">{errorMsg}</p>
      )}
    </div>
  )
}
