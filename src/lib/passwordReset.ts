import type { SupabaseClient } from '@supabase/supabase-js'

export const RESET_LINK_ERROR = 'הקישור פג תוקף או אינו תקין. יש לבקש קישור חדש.'
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 6) return 'הסיסמה צריכה להכיל לפחות 6 תווים'
  if (password !== confirmation) return 'הסיסמאות אינן תואמות'
  return null
}

export async function verifyPasswordResetSession(auth: SupabaseClient['auth'], href: string): Promise<void> {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.slice(1))
  if (url.searchParams.has('error') || hash.has('error') || hash.has('error_code')) throw new Error(RESET_LINK_ERROR)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  if (code) {
    const { error } = await auth.exchangeCodeForSession(code)
    if (error) throw new Error(RESET_LINK_ERROR)
  } else if (tokenHash) {
    if (type !== 'recovery' && type !== 'invite' && type !== 'signup') throw new Error(RESET_LINK_ERROR)
    const { error } = await auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) throw new Error(RESET_LINK_ERROR)
  } else if (hash.has('access_token') || hash.has('refresh_token')) {
    const access_token = hash.get('access_token')
    const refresh_token = hash.get('refresh_token')
    if (!access_token || !refresh_token) throw new Error(RESET_LINK_ERROR)
    const { error } = await auth.setSession({ access_token, refresh_token })
    if (error) throw new Error(RESET_LINK_ERROR)
  }
  // Validate with Auth, not merely the presence of a cached session.
  const { data, error } = await auth.getUser()
  if (error || !data.user) throw new Error(RESET_LINK_ERROR)
}

export function passwordErrorMessage(message: string): string {
  if (/same_password|different from.*old|different from.*previous/i.test(message)) return 'יש לבחור סיסמה שונה מהסיסמה הקודמת'
  if (/weak|at least|password.*short/i.test(message)) return 'הסיסמה אינה עומדת בדרישות. בחרי סיסמה ארוכה וחזקה יותר'
  if (/session|expired|token|not authenticated/i.test(message)) return RESET_LINK_ERROR
  if (/rate|too many/i.test(message)) return 'בוצעו יותר מדי ניסיונות. המתיני מעט ונסי שוב'
  return 'לא ניתן לשמור את הסיסמה כרגע. בדקי את החיבור ונסי שוב'
}
