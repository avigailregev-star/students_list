'use client'

import { useTransition } from 'react'
import { markResolved } from './bugActions'

export default function MarkResolvedButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => markResolved(id))}
      disabled={isPending}
      className="shrink-0 text-xs bg-gray-100 text-gray-600 font-medium px-3 py-1.5 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
    >
      {isPending ? '...' : 'סמן כטופל'}
    </button>
  )
}
