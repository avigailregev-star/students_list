'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function PendingMessagesCard({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('pending-messages-card')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
      }, async () => {
        const { count: newCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('from_admin', false)
        setCount(newCount ?? 0)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (count === 0) return null

  return (
    <Link
      href="/admin/messages"
      className="bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 flex items-center gap-3"
    >
      <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-violet-700">{count} הודעות ממתינות לתשובה</p>
        <p className="text-xs text-violet-400">לחצי לטיפול</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </Link>
  )
}
