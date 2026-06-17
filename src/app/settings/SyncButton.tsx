'use client'

import { useState, useTransition } from 'react'
import { syncFromGoogle } from './googleActions'

export default function SyncButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<number | null>(null)

  function handleSync() {
    startTransition(async () => {
      const { alertsCreated } = await syncFromGoogle()
      setResult(alertsCreated)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={isPending}
        className="w-full py-3 bg-teal-500 text-white font-bold rounded-2xl text-sm hover:bg-teal-600 transition-colors disabled:opacity-60"
      >
        {isPending ? 'מסנכרן...' : 'סנכרן מגוגל עכשיו'}
      </button>
      {result !== null && (
        <p className="text-xs text-center font-semibold text-gray-500">
          {result === 0 ? 'הכל מסונכרן ✓' : `נמצאו ${result} שיעורים שנמחקו ביומן גוגל`}
        </p>
      )}
    </div>
  )
}
