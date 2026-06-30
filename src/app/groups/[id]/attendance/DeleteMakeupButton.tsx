'use client'

import { useTransition } from 'react'
import { deleteMakeupLesson } from './lessonActions'

export default function DeleteMakeupButton({ lessonId }: { lessonId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm('למחוק את שיעור ההשלמה? פעולה זו אינה ניתנת לביטול.')) return
    startTransition(() => deleteMakeupLesson(lessonId))
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="shrink-0 text-xs text-purple-400 hover:text-red-500 font-semibold disabled:opacity-50 transition-colors"
    >
      {isPending ? '...' : 'מחק'}
    </button>
  )
}
