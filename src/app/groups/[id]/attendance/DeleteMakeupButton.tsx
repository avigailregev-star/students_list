'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMakeupLesson } from './lessonActions'

export default function DeleteMakeupButton({ lessonId, groupId }: { lessonId: string; groupId: string }) {
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  function handleClick() {
    if (!confirm('למחוק את שיעור ההשלמה? פעולה זו אינה ניתנת לביטול.')) return
    setErrorMsg(null)
    startTransition(async () => {
      try {
        await deleteMakeupLesson(lessonId)
        router.push(`/groups/${groupId}`)
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="shrink-0 flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-xs text-purple-400 hover:text-red-500 font-semibold disabled:opacity-50 transition-colors"
      >
        {isPending ? '...' : 'מחק'}
      </button>
      {errorMsg && <p className="text-[10px] text-red-500 max-w-[120px] text-right">{errorMsg}</p>}
    </div>
  )
}
