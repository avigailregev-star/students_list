'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { registerTeacherProfile } from './actions'
import logo from '@/app/icon.png'

type Mode = 'login' | 'signup' | 'forgot'

function sessionToBase64(session: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(session))
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    const query = new URLSearchParams(window.location.search)
    if (hash.includes('access_token') || hash.includes('error=')) {
      window.location.replace('/reset-password' + window.location.search + hash)
      return
    }
    if (query.get('verified') === '1') setMessage('כתובת האימייל אומתה. כעת אפשר להתחבר.')
    if (query.has('error')) setError('לא ניתן לאמת את הקישור. בקשי קישור חדש ונסי שוב.')
  }, [])
  function reset(newMode: Mode) {
    setMode(newMode)
    setError(null)
    setMessage(null)
    setShowPassword(false)
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
        setMessage('אם קיים חשבון עם כתובת זו, יישלח אליו קישור לאיפוס סיסמה. בדקי גם בתיקיית הספאם.')
        return
      }

      if (mode === 'signup') {
        if (password.length < 6) throw new Error('הסיסמה צריכה להכיל לפחות 6 תווים')
        if (!name.trim()) throw new Error('יש להזין שם מלא')
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) throw error
        if (data.session) {
          const result = await registerTeacherProfile(name)
          if (result.error) throw new Error(result.error)
          window.location.href = '/redirect'
        } else {
          setMessage('אם ניתן להירשם עם כתובת זו, יישלח אליה קישור לאימות. לאחר האימות יש להתחבר.')
        }
        return
      }
      // login
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // Save this tab's session so the middleware can inject it into server requests,
      // giving each browser tab an independent server-side session.
      // Wrapped separately so a storage failure (unsupported/restricted mobile
      // browser) still lets a valid login proceed via the shared cookie session.
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) sessionStorage.setItem('_sb_tab_session', sessionToBase64(session))
      } catch {
        // sessionStorage unavailable — falls back to shared cookie session
      }

      const result = await registerTeacherProfile(data.user?.user_metadata?.name || email.split('@')[0])
      if (result.error) throw new Error(result.error)
      window.location.href = '/redirect'

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'שגיאה לא ידועה'
      if (msg.includes('Invalid login credentials')) setError('אימייל או סיסמה שגויים')
      else if (msg.includes('User already registered') || msg.includes('already registered')) setError('המשתמש כבר קיים — נסי להתחבר')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const titles: Record<Mode, string> = { login: 'ברוך הבא', signup: 'צרי חשבון חדש', forgot: 'איפוס סיסמה' }
  const btnLabels: Record<Mode, string> = { login: 'כניסה', signup: 'הרשמה', forgot: 'שלחי לי קישור' }


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Teal header */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 rounded-b-[48px] px-6 pt-16 pb-12 text-white text-center shadow-lg shadow-teal-200">
        <div className="w-28 h-28 mx-auto mb-4 overflow-hidden rounded-[22%] relative">
          <Image src={logo} alt="לוגו" fill priority className="object-cover scale-[1.35]" />
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
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="לפחות 6 תווים"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
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
