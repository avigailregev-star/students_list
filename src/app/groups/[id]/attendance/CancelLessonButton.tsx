'use client'

import { useState, useTransition } from 'react'
import { cancelLesson, restoreLesson } from './lessonActions'

const REASONS = [
  'מחלה',
  'אירוע משפחתי',
  'הכשרה מקצועית',
  'חירום',
  'אחר',
]

interface Props {
  lessonId: string
  isCanceled: boolean
  cancelReason?: string | null
  isSickLeave?: boolean
}

export default function CancelLessonButton({ lessonId, isCanceled, cancelReason, isSickLeave }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [sickLeave, setSickLeave] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (isCanceled) {
    return (
      <div className="flex flex-col gap-2">
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700">השיעור בוטל</p>
            <p className="text-xs text-red-400">{cancelReason}{isSickLeave ? ' · בקשת מחלה הוגשה' : ''}</p>
          </div>
          <button
            onClick={() => startTransition(() => restoreLesson(lessonId))}
            disabled={isPending}
            className="text-xs text-red-400 hover:text-red-600 font-semibold disabled:opacity-50"
          >
            בטל ביטול
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full border-2 border-dashed border-red-200 text-red-400 font-bold text-sm py-3 rounded-2xl hover:bg-red-50 transition-colors"
      >
        ביטול שיעור
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div
            className="bg-white w-full rounded-t-3xl p-5 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-gray-900 mb-4">ביטול שיעור</h2>

            <form
              onSubmit={e => {
                e.preventDefault()
                const fd = new FormData()
                fd.set('lesson_id', lessonId)
                fd.set('reason', reason)
                fd.set('is_sick_leave', String(sickLeave))
                startTransition(async () => {
                  await cancelLesson(fd)
                  setOpen(false)
                })
              }}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">סיבת הביטול</label>
                <div className="flex flex-col gap-2">
                  {REASONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setReason(r)
                        if (r !== 'מחלה') setSickLeave(false)
                      }}
                      className={`text-right px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                        reason === r
                          ? 'border-red-400 bg-red-50 text-red-700'
                          : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {reason === 'מחלה' && (
                <button
                  type="button"
                  onClick={() => setSickLeave(v => !v)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-colors text-right ${
                    sickLeave ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                    sickLeave ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                  }`}>
                    {sickLeave && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">הגש בקשת אישור מחלה</p>
                    <p className="text-xs text-gray-400">יישלח למנהל/ת לאישור</p>
                  </div>
                </button>
              )}

              <div className="flex gap-2 mt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl hover:bg-red-600 transition-colors disabled:opacity-60 text-sm"
                >
                  {isPending ? '...' : 'אשר ביטול'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl text-sm"
                >
                  חזרה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
