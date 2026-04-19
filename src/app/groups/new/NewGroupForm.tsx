'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SchedulePicker from '@/components/groups/SchedulePicker'
import { createGroup } from './actions'
import type { LessonType } from '@/types/database'
import { LESSON_TYPE_OPTIONS } from '@/lib/utils/lessonTypes'

export default function NewGroupForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isMangan, setIsMangan] = useState(false)
  const [hasSecondSlot, setHasSecondSlot] = useState(false)
  const [lessonType, setLessonType] = useState<LessonType>('group')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('is_mangan_school', String(isMangan))
    formData.set('lesson_type', lessonType)
    startTransition(async () => {
      try { await createGroup(formData) }
      catch (err: unknown) { setError(err instanceof Error ? err.message : 'שגיאה בשמירת הקבוצה') }
    })
  }

  const isIndividual = lessonType === 'individual_45' || lessonType === 'individual_60'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-xl font-bold">קבוצה חדשה</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-4 py-5 pb-10 space-y-4 max-w-md mx-auto w-full">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-gray-600 mb-2">שם הקבוצה / תלמיד</label>
          <input name="name" required placeholder="לדוגמה: גיטרה מתחילים" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300 transition-all"/>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-gray-600 mb-2">סוג שיעור</label>
          <select value={lessonType} onChange={e => setLessonType(e.target.value as LessonType)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300">
            {LESSON_TYPE_OPTIONS.map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <SchedulePicker index={1} required label="מועד שיעור"/>
          {hasSecondSlot ? (
            <div>
              <SchedulePicker index={2} label="מועד שיעור 2 (אופציונלי)"/>
              <button type="button" onClick={() => setHasSecondSlot(false)} className="text-xs text-gray-400 mt-1.5 hover:text-red-500">הסר מועד שני</button>
            </div>
          ) : (
            <button type="button" onClick={() => setHasSecondSlot(true)} className="text-sm text-teal-600 font-bold hover:text-teal-700">+ הוסף מועד שני</button>
          )}
        </div>

        {isIndividual && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-600 mb-2">שם התלמיד</label>
            <input name="student_name" required placeholder="לדוגמה: יובל כהן" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300"/>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">בית ספר מנגן</p>
            <p className="text-xs text-gray-400 mt-0.5">שיעור במסגרת בית ספר מנגן</p>
          </div>
          <button type="button" role="switch" aria-checked={isMangan} onClick={() => setIsMangan(!isMangan)} className={`relative w-12 h-6 rounded-full transition-colors ${isMangan ? 'bg-teal-500' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isMangan ? 'right-0.5' : 'left-0.5'}`}/>
          </button>
        </div>

        {isMangan && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">פרטי בית הספר</p>
            <input name="school_name" required={isMangan} placeholder="שם בית הספר" className="w-full px-4 py-2.5 bg-white border border-amber-100 rounded-xl text-sm"/>
            <input name="grade" placeholder="כיתה" className="w-full px-4 py-2.5 bg-white border border-amber-100 rounded-xl text-sm"/>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>}

        <button type="submit" disabled={isPending} className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3.5 rounded-2xl font-bold text-sm disabled:opacity-60">
          {isPending ? 'שומר...' : 'שמור קבוצה'}
        </button>
      </form>
    </div>
  )
}
