'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const items = [
  {
    href: '/',
    label: 'ראשי',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#14b8a6' : 'none'} stroke={active ? '#14b8a6' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/availability',
    label: 'זמינות',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#14b8a6' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/reports',
    label: 'דוחות',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#14b8a6' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
]

export default function BottomNav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="fixed bottom-0 right-0 left-0 bg-white border-t border-gray-100 flex justify-around px-2 py-2 pb-safe z-50">
      {items.map(item => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-2xl transition-colors ${active ? 'bg-teal-50' : ''}`}
          >
            {item.icon(active)}
            <span className={`text-[10px] font-bold ${active ? 'text-teal-500' : 'text-gray-400'}`}>{item.label}</span>
          </Link>
        )
      })}

      {isAdmin && (
        <Link
          href="/admin"
          className="flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-2xl transition-colors hover:bg-teal-50"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span className="text-[10px] font-bold text-gray-400">ניהול</span>
        </Link>
      )}

      <button
        onClick={handleLogout}
        className="flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-2xl transition-colors hover:bg-red-50"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span className="text-[10px] font-bold text-gray-400">יציאה</span>
      </button>
    </nav>
  )
}
