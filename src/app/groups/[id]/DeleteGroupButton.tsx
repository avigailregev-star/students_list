'use client'

import { useState } from 'react'
import { deleteGroup } from './actions'

export default function DeleteGroupButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/80">למחוק את &quot;{groupName}&quot;?</span>
        <button
          onClick={async () => {
            setLoading(true)
            await deleteGroup(groupId)
          }}
          disabled={loading}
          className="text-xs bg-red-500 text-white font-bold px-3 py-1.5 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-60"
        >
          {loading ? '...' : 'כן, מחק'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs bg-white/20 text-white font-bold px-3 py-1.5 rounded-xl hover:bg-white/30 transition-colors"
        >
          ביטול
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center hover:bg-red-400/40 transition-colors"
      title="מחק קבוצה"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  )
}
