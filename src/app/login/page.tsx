'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) {
          const { error: insertError } = await supabase.from('teachers').insert({
            id: data.user.id,
            name,
            email,
          })
          if (insertError) throw insertError
          setMessage('נרשמת בהצלחה!')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
        router.refresh()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'שגיאה לא ידועה'
      if (message.includes('Invalid login credentials')) {
        setError('אימייל או סיסמה שגויים')
      } else if (message.includes('User already registered')) {
        setError('המשתמש כבר קיים — נסי להתחבר')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Teal header area */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 rounded-b-[48px] px-6 pt-16 pb-12 text-white text-center shadow-lg shadow-teal-200">
        <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold">מעקב נוכחות</h1>
        <p className="text-teal-100 mt-1 text-sm">
          {isSignUp ? 'צרי חשבון חדש' : 'ברוכה השבה'}
        </p>
      </div>

      {/* Form card */}
      <div className="flex-1 px-5 pt-8 pb-10 max-w-sm mx-auto w-full">
        <div className="bg-white rounded-3xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">שם מלא</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required={isSignUp}
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

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">סיסמה</label>
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

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-teal-50 border border-teal-100 text-teal-700 text-sm px-4 py-3 rounded-2xl">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors disabled:opacity-60 shadow-sm shadow-teal-200 mt-2"
            >
              {loading ? 'אנא המתן...' : isSignUp ? 'הרשמה' : 'כניסה'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-5">
          {isSignUp ? 'יש לך חשבון?' : 'אין לך חשבון?'}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null) }}
            className="text-teal-600 font-bold hover:underline"
          >
            {isSignUp ? 'כניסה' : 'הרשמה'}
          </button>
        </p>
      </div>
    </div>
  )
}
