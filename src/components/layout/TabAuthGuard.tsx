'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'

const PUBLIC_PATHS = ['/login', '/reset-password', '/auth']

export default function TabAuthGuard() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return
    if (!sessionStorage.getItem('_sb_tab_session')) {
      window.location.href = '/login'
    }
  }, [pathname])

  return null
}
