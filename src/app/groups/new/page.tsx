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
      <div className="bg-gradient-to-l from-indigo-500 to-purple-600 text-white px-4 py-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-lg"
          >
            ←
          </button>
          <h1 className="text-lg font-bold">הוסף קבוצה חדשה</h1>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 px-4 py-5 pb-10 space-y-5 max-w-md mx-auto w-full">

        {/* Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">שם הקבוצה / תלמיד</label>
          <input
            name="name"
            required
            placeholder="לדוגמה: גיטרה מתחילים"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>

        {/* Lesson type toggle */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">סוג שיעור</label>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            <button
              type="button"
              onClick={() => setLessonType('group')}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                lessonType === 'group'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              👥 קבוצה
            </button>
            <button
              type="button"
              onClick={() => setLessonType('individual')}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                lessonType === 'individual'
                  ? 'bg-pink-500 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              🎵 יחיד
            </button>
          </div>
        </div>

        {/* Schedule 1 */}
        <SchedulePicker index={1} required label="מועד שיעור" />

        {/* Schedule 2 (optional) */}
        {hasSecondSlot ? (
          <div>
            <SchedulePicker index={2} label="מועד שיעור 2 (אופציונלי)" />
            <button
              type="button"
              onClick={() => setHasSecondSlot(false)}
              className="text-xs text-gray-400 mt-1 hover:text-red-500"
            >
              הסר מועד שני
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setHasSecondSlot(true)}
            className="text-sm text-indigo-600 font-semibold hover:underline"
          >
            ＋ הוסף מועד שני
          </button>
        )}

        {/* Mangan toggle */}
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-700">🏫 בית ספר מנגן</p>
            <p className="text-xs text-gray-400 mt-0.5">שיעור במסגרת בית ספר מנגן</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isMangan}
            onClick={() => setIsMangan(!isMangan)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              isMangan ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
              isMangan ? 'right-0.5' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* Mangan conditional fields */}
        {isMangan && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-amber-700">📋 פרטי בית הספר</p>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">שם בית הספר</label>
              <input
                name="school_name"
                required={isMangan}
                placeholder="לדוגמה: אורט גבעתיים"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">כיתה</label>
              <input
                name="grade"
                placeholder="לדוגמה: ה׳"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 bg-white"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-gradient-to-l from-indigo-500 to-purple-600 text-white py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {isPending ? 'שומר...' : 'שמור קבוצה'}
        </button>
      </form>
    </div>
  )
}
