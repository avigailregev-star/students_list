'use client'

import { useTransition } from 'react'
import { approveLesson, rejectLesson } from './sickLeaveActions'

export default function ApprovalButtons({ lessonId }: { lessonId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={() => startTransition(() => approveLesson(lessonId))}
        disabled={isPending}
        className="flex-1 bg-emerald-500 text-white text-xs font-bold py-2 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
      >
        אשר
      </button>
      <button
        onClick={() => startTransition(() => rejectLesson(lessonId))}
        disabled={isPending}
        className="flex-1 bg-red-100 text-red-600 text-xs font-bold py-2 rounded-xl hover:bg-red-200 transition-colors disabled:opacity-50"
      >
        דחה
      </button>
    </div>
  )
}
