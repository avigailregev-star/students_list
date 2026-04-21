'use client'

import { useState, useTransition, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cancelLesson, restoreLesson } from './lessonActions'

const ADVANCE_NOTICE_REASON = 'הודעה מראש מתלמיד'
const ADVANCE_NOTICE_LIMIT = 2

const REASONS = [
  'מחלה',
  'אירוע משפחתי',
  'הכשרה מקצועית',
  'חירום',
  ADVANCE_NOTICE_REASON,
  'אחר',
]

interface Props {
  lessonId: string
  isCanceled: boolean
  cancelReason?: string | null
  cancelNotes?: string | null
  isSickLeave?: boolean
  advanceNoticeUsed: number
}

export default function CancelLessonButton({ lessonId, isCanceled, cancelReason, cancelNotes, isSickLeave, advanceNoticeUsed }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [notes, setNotes] = useState('')
  const [sickLeave, setSickLeave] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const advanceNoticeLeft = Math.max(0, ADVANCE_NOTICE_LIMIT - advanceNoticeUsed)
  const advanceNoticeDisabled = advanceNoticeUsed >= ADVANCE_NOTICE_LIMIT

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
            {cancelNotes && <p className="text-xs text-red-400 mt-0.5">"{cancelNotes}"</p>}
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUploadError(null)

    let documentUrl: string | null = null

    if (sickLeave && file) {
      setUploading(true)
      try {
        const supabase = createClient()
        const ext = file.name.split('.').pop()
        const path = `${lessonId}-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('sick-leave').upload(path, file)
        if (error) throw error
        const { data: urlData } = supabase.storage.from('sick-leave').getPublicUrl(path)
        documentUrl = urlData.publicUrl
      } catch {
        setUploadError('שגיאה בהעלאת הקובץ, נסי שוב')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    const fd = new FormData()
    fd.set('lesson_id', lessonId)
    fd.set('reason', reason)
    fd.set('notes', notes.trim())
    fd.set('is_sick_leave', String(sickLeave))
    if (documentUrl) fd.set('document_url', documentUrl)

    startTransition(async () => {
      await cancelLesson(fd)
      setOpen(false)
    })
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
            className="bg-white w-full rounded-t-3xl p-5 pb-8 max-h-[90dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-gray-900 mb-4">ביטול שיעור</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Reason type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">סיבת הביטול</label>
                <div className="flex flex-col gap-2">
                  {REASONS.map(r => {
                    const isAdvance = r === ADVANCE_NOTICE_REASON
                    const disabled = isAdvance && advanceNoticeDisabled
                    return (
                      <button
                        key={r}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (!disabled) {
                            setReason(r)
                            if (r !== 'מחלה') setSickLeave(false)
                          }
                        }}
                        className={`text-right px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                          disabled
                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                            : reason === r
                            ? 'border-red-400 bg-red-50 text-red-700'
                            : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200'
                        }`}
                      >
                        <span>{r}</span>
                        {isAdvance && (
                          <span className={`text-xs mr-2 ${disabled ? 'text-gray-300' : advanceNoticeLeft <= 1 ? 'text-amber-500' : 'text-gray-400'}`}>
                            {disabled ? '(הגעת למגבלה השנתית)' : `(נותרו ${advanceNoticeLeft})`}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Required free-text notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  פירוט <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  required
                  placeholder="תארי את סיבת הביטול..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 resize-none"
                />
              </div>

              {/* Sick leave options */}
              {reason === 'מחלה' && (
                <div className="flex flex-col gap-2">
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

                  {sickLeave && (
                    <div
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-700">
                          {file ? file.name : 'העלה תמונה או קובץ אישור'}
                        </p>
                        <p className="text-xs text-gray-400">תמונה, PDF (אופציונלי)</p>
                      </div>
                      {file && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setFile(null) }}
                          className="text-gray-400 hover:text-red-400"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={e => setFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  )}
                </div>
              )}

              {uploadError && <p className="text-sm text-red-500 text-right">{uploadError}</p>}

              <div className="flex gap-2 mt-1">
                <button
                  type="submit"
                  disabled={isPending || uploading || !notes.trim()}
                  className="flex-1 bg-red-500 text-white font-bold py-3 rounded-2xl hover:bg-red-600 transition-colors disabled:opacity-60 text-sm"
                >
                  {uploading ? 'מעלה קובץ...' : isPending ? '...' : 'אשר ביטול'}
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
