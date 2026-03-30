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

  // Unauthenticated → /login
  if (!user && !isLoginPage && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated on login → redirect by role
  if (user && isLoginPage) {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('role')
      .eq('id', user.id)
      .single()
    const url = request.nextUrl.clone()
    url.pathname = teacher?.role === 'admin' ? '/admin' : '/'
    return NextResponse.redirect(url)
  }

  // Role-based protection for authenticated users
  if (user && (isAdminRoute || pathname === '/')) {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = teacher?.role ?? 'teacher'

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
