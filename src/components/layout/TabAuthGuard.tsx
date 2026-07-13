'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'

const PUBLIC_PATHS = ['/login', '/reset-password', '/auth']

export default function TabAuthGuard() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return
    try {
      if (!sessionStorage.getItem('_sb_tab_session')) {
        window.location.href = '/login'
      }
    } catch {
      // sessionStorage unavailable in this browser — the server-side auth
      // check (proxy.ts) is the real gate, so don't force a redirect here.
    }
  }, [pathname])

  return null
}
