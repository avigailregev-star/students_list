import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Per-tab session injection ────────────────────────────────────────────────
// The browser client stores each tab's session in sessionStorage and sends it
// as x-tab-session on every same-origin fetch. We decode it here and inject it
// into the request cookies so server components see each tab's own user.
// Hard navigations (F5, address bar) don't carry the header — those fall back
// to the shared cookie, which is the unavoidable browser limitation.

const MAX_CHUNK = 3180

function toBase64URL(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function createCookieChunks(key: string, value: string): { name: string; value: string }[] {
  const encoded = encodeURIComponent(value)
  if (encoded.length <= MAX_CHUNK) return [{ name: key, value }]
  const chunks: string[] = []
  let remaining = encoded
  while (remaining.length > 0) {
    let head = remaining.slice(0, MAX_CHUNK)
    const lastPct = head.lastIndexOf('%')
    if (lastPct > MAX_CHUNK - 3) head = head.slice(0, lastPct)
    chunks.push(decodeURIComponent(head))
    remaining = remaining.slice(encodeURIComponent(chunks[chunks.length - 1]).length)
  }
  return chunks.map((v, i) => ({ name: `${key}.${i}`, value: v }))
}

function injectTabSession(request: NextRequest): void {
  const tabSession = request.headers.get('x-tab-session')
  if (!tabSession) return
  try {
    const sessionJson = atob(tabSession)
    JSON.parse(sessionJson) // validate
    const cookieValue = 'base64-' + toBase64URL(sessionJson)
    const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]
    const storageKey = `sb-${projectRef}-auth-token`
    const chunks = createCookieChunks(storageKey, cookieValue)
    // Remove existing auth cookies for this key, then set the tab's session
    request.cookies.delete(storageKey)
    for (let i = 0; i < 5; i++) request.cookies.delete(`${storageKey}.${i}`)
    chunks.forEach(({ name, value }) => request.cookies.set(name, value))
  } catch {
    // ignore malformed header
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  // Inject per-tab session before creating the Supabase client
  injectTabSession(request)

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isAuthRoute = pathname.startsWith('/auth/')
  const isResetPage = pathname === '/reset-password'
  const isRedirectPage = pathname === '/redirect'
  // ?switch=1 lets Tab 2 reach the login page even when a shared cookie exists
  const isSwitchRequest = request.nextUrl.searchParams.has('switch')

  if (!user && !isLoginPage && !isAuthRoute && !isResetPage && !isRedirectPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage && !isSwitchRequest) {
    const url = request.nextUrl.clone()
    url.pathname = '/redirect'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
