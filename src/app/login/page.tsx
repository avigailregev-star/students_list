'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function reset(newMode: Mode) {
    setMode(newMode)
    setError(null)
    setMessage(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setMessage('נשלח אימייל לאיפוס סיסמה — בדקי את תיבת הדואר')
        return
      }

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) {
          const { error: insertError } = await supabase.from('teachers').insert({ id: data.user.id, name, email })
          if (insertError) throw insertError
          setMessage('נרשמת בהצלחה!')
        }
        return
      }

      // login
      const { error, data } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const { data: teacher } = await supabase.from('teachers').select('role').eq('id', data.user.id).single()
      window.location.href = teacher?.role === 'admin' ? '/admin' : '/'

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'שגיאה לא ידועה'
      if (msg.includes('Invalid login credentials')) setError('אימייל או סיסמה שגויים')
      else if (msg.includes('User already registered')) setError('המשתמש כבר קיים — נסי להתחבר')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const titles: Record<Mode, string> = { login: 'ברוכה השבה', signup: 'צרי חשבון חדש', forgot: 'איפוס סיסמה' }
  const btnLabels: Record<Mode, string> = { login: 'כניסה', signup: 'הרשמה', forgot: 'שלחי לי קישור' }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Teal header */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 rounded-b-[48px] px-6 pt-16 pb-12 text-white text-center shadow-lg shadow-teal-200">
        <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <h1 className="text-3xl font-bold">מעקב נוכחות</h1>
        <p className="text-teal-100 mt-1 text-sm">{titles[mode]}</p>
      </div>

      {/* Form card */}
      <div className="flex-1 px-5 pt-8 pb-10 max-w-sm mx-auto w-full">
        <div className="bg-white rounded-3xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">שם מלא</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="שם ושם משפחה"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"
                dir="ltr"
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-gray-600">סיסמה</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => reset('forgot')}
                      className="text-xs text-teal-500 hover:text-teal-700 font-semibold"
                    >
                      שכחתי סיסמה
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="לפחות 6 תווים"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"
                  dir="ltr"
                />
              </div>
            )}

            {mode === 'forgot' && (
              <p className="text-xs text-gray-400 leading-relaxed">
                הכניסי את האימייל שלך ונשלח לך קישור לאיפוס הסיסמה.
              </p>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>
            )}
            {message && (
              <div className="bg-teal-50 border border-teal-100 text-teal-700 text-sm px-4 py-3 rounded-2xl">{message}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors disabled:opacity-60 shadow-sm shadow-teal-200 mt-2"
            >
              {loading ? 'אנא המתן...' : btnLabels[mode]}
            </button>
          </form>
        </div>

        <div className="text-center mt-5 flex flex-col gap-2">
          {mode === 'forgot' ? (
            <button onClick={() => reset('login')} className="text-sm text-teal-600 font-bold hover:underline">
              חזרה לכניסה
            </button>
          ) : (
            <p className="text-sm text-gray-500">
              {mode === 'signup' ? 'יש לך חשבון?' : 'אין לך חשבון?'}{' '}
              <button
                onClick={() => reset(mode === 'signup' ? 'login' : 'signup')}
                className="text-teal-600 font-bold hover:underline"
              >
                {mode === 'signup' ? 'כניסה' : 'הרשמה'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
