'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMakeupLesson } from './lessonActions'

export default function DeleteMakeupButton({ lessonId }: { lessonId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    if (!confirm('למחוק את שיעור ההשלמה? פעולה זו אינה ניתנת לביטול.')) return
    startTransition(async () => {
      const groupId = await deleteMakeupLesson(lessonId)
      router.push(`/groups/${groupId}`)
    })
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
