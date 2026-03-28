'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SchedulePicker from '@/components/groups/SchedulePicker'
import { createGroup } from './actions'

export default function NewGroupPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isMangan, setIsMangan] = useState(false)
  const [hasSecondSlot, setHasSecondSlot] = useState(false)
  const [lessonType, setLessonType] = useState<'group' | 'individual'>('group')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('is_mangan_school', String(isMangan))
    formData.set('lesson_type', lessonType)

    startTransition(async () => {
      try {
        await createGroup(formData)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'שגיאה בשמירת הקבוצה')
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">קבוצה חדשה</h1>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 px-4 py-5 pb-10 space-y-4 max-w-md mx-auto w-full">

        {/* Name */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-gray-600 mb-2">שם הקבוצה / תלמיד</label>
          <input
            name="name"
            required
            placeholder="לדוגמה: גיטרה מתחילים"
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"
          />
        </div>

        {/* Lesson type toggle */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-gray-600 mb-2.5">סוג שיעור</label>
          <div className="flex rounded-2xl overflow-hidden bg-gray-50 p-1 gap-1">
            <button
              type="button"
              onClick={() => setLessonType('group')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                lessonType === 'group'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              קבוצה
            </button>
            <button
              type="button"
              onClick={() => setLessonType('individual')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                lessonType === 'individual'
                  ? 'bg-violet-500 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              יחיד
            </button>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <SchedulePicker index={1} required label="מועד שיעור" />

          {hasSecondSlot ? (
            <div>
              <SchedulePicker index={2} label="מועד שיעור 2 (אופציונלי)" />
              <button
                type="button"
                onClick={() => setHasSecondSlot(false)}
                className="text-xs text-gray-400 mt-1.5 hover:text-red-500 transition-colors"
              >
                הסר מועד שני
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setHasSecondSlot(true)}
              className="text-sm text-teal-600 font-bold hover:text-teal-700 transition-colors"
            >
              + הוסף מועד שני
            </button>
          )}
        </div>

        {/* Mangan toggle */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">בית ספר מנגן</p>
            <p className="text-xs text-gray-400 mt-0.5">שיעור במסגרת בית ספר מנגן</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isMangan}
            onClick={() => setIsMangan(!isMangan)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              isMangan ? 'bg-teal-500' : 'bg-gray-200'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
              isMangan ? 'right-0.5' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* Mangan conditional fields */}
        {isMangan && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">פרטי בית הספר</p>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">שם בית הספר</label>
              <input
                name="school_name"
                required={isMangan}
                placeholder="לדוגמה: אורט גבעתיים"
                className="w-full px-4 py-2.5 bg-white border border-amber-100 rounded-xl text-sm focus:outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">כיתה</label>
              <input
                name="grade"
                placeholder="לדוגמה: ה׳"
                className="w-full px-4 py-2.5 bg-white border border-amber-100 rounded-xl text-sm focus:outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-all"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors disabled:opacity-60 shadow-sm shadow-teal-200"
        >
          {isPending ? 'שומר...' : 'שמור קבוצה'}
        </button>
      </form>
    </div>
  )
}
