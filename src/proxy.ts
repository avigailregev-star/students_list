import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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
  const isAdminRoute = pathname.startsWith('/admin')
  const isResetPage = pathname === '/reset-password'
  const isRedirectPage = pathname === '/redirect'

  // Unauthenticated → /login
  if (!user && !isLoginPage && !isAuthRoute && !isResetPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated on login → redirect by role (from user_metadata)
  if (user && isLoginPage) {
    const role = (user.user_metadata as Record<string, string>)?.role ?? 'teacher'
    const url = request.nextUrl.clone()
    url.pathname = role === 'admin' ? '/admin' : '/'
    return NextResponse.redirect(url)
  }

  // Let /redirect page handle role routing
  if (isRedirectPage) return supabaseResponse

  // Role-based protection for authenticated users
  if (user && (isAdminRoute || pathname === '/')) {
    const role = (user.user_metadata as Record<string, string>)?.role ?? 'teacher'

    // Admin on teacher home → /admin
    if (role === 'admin' && pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }

    // Teacher on admin route → /
    if (role === 'teacher' && isAdminRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
