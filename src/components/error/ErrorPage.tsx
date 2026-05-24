'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface Props {
  error: Error
  onDismiss: () => void
}

export default function ErrorPage({ error, onDismiss }: Props) {
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function report(withDescription: boolean) {
    setSending(true)
    try {
      await fetch('/api/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorMessage: error.message || String(error),
          errorStack: error.stack,
          pageUrl: pathname,
          userDescription: withDescription ? description : undefined,
        }),
      })
    } catch {
      // best effort — don't block the user
    }
    onDismiss()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-sm p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">😔</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">אירעה שגיאה</h1>
        <p className="text-sm text-gray-500 mb-6">הבעיה דווחה אוטומטית. מטפלים בה.</p>

        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="תרצי להוסיף תיאור קצר של מה עשית?"
          className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-teal-400"
          rows={3}
          dir="rtl"
        />

        <div className="flex gap-3">
          <button
            onClick={() => report(true)}
            disabled={sending}
            className="flex-1 bg-teal-500 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50"
          >
            שלחי דיווח
          </button>
          <button
            onClick={() => report(false)}
            disabled={sending}
            className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl text-sm disabled:opacity-50"
          >
            דלגי
          </button>
        </div>
      </div>
    </div>
  )
}
