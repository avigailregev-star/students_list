'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { replyToMessage, sendAdminMessage } from './messageActions'
import { decideVacationRequest } from './vacationActions'
import { markResolved } from '@/app/admin/bugs/bugActions'
import type { VacationRequestWithTeacher } from '@/types/database'
import type { BugReport, TeacherOption } from './page'

type MessageWithTeacher = {
  id: string
  teacher_id: string
  content: string
  reply: string | null
  status: 'pending' | 'replied'
  created_at: string
  replied_at: string | null
  from_admin?: boolean
  teachers: { name: string } | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'עכשיו'
  if (minutes < 60) return `לפני ${minutes} דקות`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `לפני ${hours} שעות`
  return `לפני ${Math.floor(hours / 24)} ימים`
}

interface Props {
  initialMessages: MessageWithTeacher[]
  initialVacationRequests: VacationRequestWithTeacher[]
  initialBugReports: BugReport[]
  teachers: TeacherOption[]
}

export default function MessagesInboxClient({ initialMessages, initialVacationRequests, initialBugReports, teachers }: Props) {
  const [tab, setTab] = useState<'messages' | 'vacations' | 'bugs'>('messages')
  const [messages, setMessages] = useState<MessageWithTeacher[]>(initialMessages)
  const [vacations, setVacations] = useState<VacationRequestWithTeacher[]>(initialVacationRequests)
  const [bugs, setBugs] = useState<BugReport[]>(initialBugReports)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})

  // Compose form state
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeTeacherId, setComposeTeacherId] = useState<string>('all')
  const [composeContent, setComposeContent] = useState('')
  const [composePending, setComposePending] = useState(false)
  const [composeError, setComposeError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin-messages-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
        const { data } = await supabase.from('messages').select('*, teachers(name)').order('created_at', { ascending: false })
        if (data) setMessages(data as MessageWithTeacher[])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vacation_requests' }, async () => {
        const { data } = await supabase.from('vacation_requests').select('*, teachers(name)').order('created_at', { ascending: false })
        if (data) setVacations(data as VacationRequestWithTeacher[])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleReply(id: string) {
    const reply = replyTexts[id] ?? ''
    setErrors(prev => ({ ...prev, [id]: '' }))
    setPendingIds(prev => new Set(prev).add(id))
    const result = await replyToMessage(id, reply)
    setPendingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    if (result.error) { setErrors(prev => ({ ...prev, [id]: result.error! })); return }
    setReplyTexts(prev => ({ ...prev, [id]: '' }))
  }

  async function handleDecide(id: string, status: 'approved' | 'rejected') {
    setErrors(prev => ({ ...prev, [id]: '' }))
    setPendingIds(prev => new Set(prev).add(id))
    const result = await decideVacationRequest(id, status, adminNotes[id])
    setPendingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    if (result.error) { setErrors(prev => ({ ...prev, [id]: result.error! })); return }
    setRejectingId(null)
    setAdminNotes(prev => { const s = { ...prev }; delete s[id]; return s })
  }

  async function handleMarkResolved(id: string) {
    setPendingIds(prev => new Set(prev).add(id))
    await markResolved(id)
    setBugs(prev => prev.map(b => b.id === id ? { ...b, status: 'resolved' } : b))
    setPendingIds(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  async function handleSendAdminMessage() {
    setComposeError('')
    setComposePending(true)
    const result = await sendAdminMessage(composeTeacherId, composeContent)
    setComposePending(false)
    if (result.error) { setComposeError(result.error); return }
    setComposeContent('')
    setComposeOpen(false)
  }

  // Exclude admin-initiated messages from inbox counts and lists
  const inboxMessages = messages.filter(m => !m.from_admin)
  const pendingMessages = inboxMessages.filter(m => m.status === 'pending').length
  const pendingVacations = vacations.filter(v => v.status === 'pending').length
  const newBugs = bugs.filter(b => b.status === 'new').length
  const pending = inboxMessages.filter(m => m.status === 'pending')
  const replied = inboxMessages.filter(m => m.status === 'replied')
  const pendingVac = vacations.filter(v => v.status === 'pending')
  const decidedVac = vacations.filter(v => v.status !== 'pending')

  return (
    <div dir="rtl">
      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => setTab('messages')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors shrink-0 ${
            tab === 'messages' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          הודעות{pendingMessages > 0 ? ` (${pendingMessages})` : ''}
        </button>
        <button
          onClick={() => setTab('vacations')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors shrink-0 ${
            tab === 'vacations' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          בקשות חופשה{pendingVacations > 0 ? ` (${pendingVacations})` : ''}
        </button>
        <button
          onClick={() => setTab('bugs')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors shrink-0 ${
            tab === 'bugs' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          באגים{newBugs > 0 ? ` (${newBugs})` : ''}
        </button>
      </div>

      {/* Messages tab */}
      {tab === 'messages' && (
        <div className="px-4 py-5 flex flex-col gap-5">

          {/* Compose button / form */}
          {!composeOpen ? (
            <button
              onClick={() => setComposeOpen(true)}
              className="w-full py-3 bg-teal-500 text-white text-sm font-bold rounded-2xl hover:bg-teal-600 transition-colors"
            >
              ✉️ שלח הודעה חדשה
            </button>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-4 border border-teal-100 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-700">הודעה חדשה</p>
                <button onClick={() => setComposeOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <select
                value={composeTeacherId}
                onChange={e => setComposeTeacherId(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                dir="rtl"
              >
                <option value="all">📢 כל המורות</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <textarea
                value={composeContent}
                onChange={e => setComposeContent(e.target.value)}
                placeholder="כתבי את ההודעה..."
                rows={3}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-400"
                dir="rtl"
              />
              {composeError && <p className="text-xs text-red-500">{composeError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSendAdminMessage}
                  disabled={composePending || !composeContent.trim()}
                  className="flex-1 py-2 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 disabled:opacity-40 transition-colors"
                >
                  {composePending ? 'שולח...' : 'שלח'}
                </button>
                <button
                  onClick={() => { setComposeOpen(false); setComposeError('') }}
                  className="flex-1 py-2 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}

          {inboxMessages.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">אין הודעות עדיין</p>
          )}
          {pending.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                ממתינות לתשובה ({pending.length})
              </p>
              {pending.map(msg => (
                <div key={msg.id} className="bg-white rounded-2xl shadow-sm p-4 border border-amber-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800">
                      {msg.teachers?.name ?? 'מורה לא ידועה'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.created_at).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{msg.content}</p>
                  <textarea
                    value={replyTexts[msg.id] ?? ''}
                    onChange={e => setReplyTexts(prev => ({ ...prev, [msg.id]: e.target.value }))}
                    placeholder="כתבי תשובה..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-400"
                    dir="rtl"
                  />
                  {errors[msg.id] && (
                    <p className="text-xs text-red-500 mt-1">{errors[msg.id]}</p>
                  )}
                  <button
                    onClick={() => handleReply(msg.id)}
                    disabled={pendingIds.has(msg.id) || !(replyTexts[msg.id] ?? '').trim()}
                    className="mt-2 px-4 py-1.5 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 disabled:opacity-40 transition-colors"
                  >
                    {pendingIds.has(msg.id) ? 'שולח...' : 'ענה'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {replied.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                נענו ({replied.length})
              </p>
              {replied.map(msg => (
                <div key={msg.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">
                      {msg.teachers?.name ?? 'מורה לא ידועה'}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      נענה
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{msg.content}</p>
                  <p className="text-sm text-emerald-700 font-medium">{msg.reply}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vacations tab */}
      {tab === 'vacations' && (
        <div className="px-4 py-5 flex flex-col gap-5">
          {vacations.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">אין בקשות חופשה עדיין</p>
          )}
          {pendingVac.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                ממתינות ({pendingVac.length})
              </p>
              {pendingVac.map(vac => (
                <div key={vac.id} className="bg-white rounded-2xl shadow-sm p-4 border border-amber-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800">
                      {vac.teachers?.name ?? 'מורה לא ידועה'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(vac.created_at).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">
                    {new Date(vac.start_date + 'T12:00:00').toLocaleDateString('he-IL')} –{' '}
                    {new Date(vac.end_date + 'T12:00:00').toLocaleDateString('he-IL')}
                  </p>
                  {vac.note && (
                    <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1">{vac.note}</p>
                  )}
                  {errors[vac.id] && (
                    <p className="text-xs text-red-500 mt-1">{errors[vac.id]}</p>
                  )}
                  {rejectingId === vac.id && (
                    <textarea
                      value={adminNotes[vac.id] ?? ''}
                      onChange={e => setAdminNotes(prev => ({ ...prev, [vac.id]: e.target.value }))}
                      placeholder="הערת דחייה (אופציונלי)..."
                      rows={2}
                      className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-red-400"
                      dir="rtl"
                    />
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleDecide(vac.id, 'approved')}
                      disabled={pendingIds.has(vac.id)}
                      className="flex-1 py-1.5 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-40 transition-colors"
                    >
                      {pendingIds.has(vac.id) && rejectingId !== vac.id ? '...' : 'אשר'}
                    </button>
                    {rejectingId === vac.id ? (
                      <>
                        <button
                          onClick={() => handleDecide(vac.id, 'rejected')}
                          disabled={pendingIds.has(vac.id)}
                          className="flex-1 py-1.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 disabled:opacity-40 transition-colors"
                        >
                          {pendingIds.has(vac.id) ? '...' : 'אשרי דחייה'}
                        </button>
                        <button
                          onClick={() => setRejectingId(null)}
                          className="flex-1 py-1.5 bg-gray-100 text-gray-500 text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          ביטול
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setRejectingId(vac.id)}
                        disabled={pendingIds.has(vac.id)}
                        className="flex-1 py-1.5 bg-red-50 text-red-500 text-sm font-bold rounded-xl hover:bg-red-100 disabled:opacity-40 transition-colors"
                      >
                        דחה
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {decidedVac.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                היסטוריה ({decidedVac.length})
              </p>
              {decidedVac.map(vac => (
                <div key={vac.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">
                      {vac.teachers?.name ?? 'מורה לא ידועה'}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      vac.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {vac.status === 'approved' ? 'אושר' : 'נדחה'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    {new Date(vac.start_date + 'T12:00:00').toLocaleDateString('he-IL')} –{' '}
                    {new Date(vac.end_date + 'T12:00:00').toLocaleDateString('he-IL')}
                  </p>
                  {vac.admin_note && (
                    <p className="text-xs text-gray-500 mt-1">{vac.admin_note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bugs tab */}
      {tab === 'bugs' && (
        <div className="px-4 py-5 flex flex-col gap-3">
          {bugs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">אין דיווחי באגים 🎉</p>
          )}
          {bugs.map(report => (
            <div
              key={report.id}
              className={`bg-white rounded-2xl shadow-sm px-4 py-4 ${
                report.status === 'new' ? 'border-r-4 border-red-400' : 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-900">
                      {report.teacher_name ?? 'לא ידוע'}
                    </span>
                    {report.status === 'new' && (
                      <span className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded-xl">חדש</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-mono bg-gray-50 rounded-lg px-2 py-1 mb-2 line-clamp-2">
                    {report.error_message}
                  </p>
                  {report.user_description && (
                    <p className="text-xs text-gray-600 italic mb-2">״{report.user_description}״</p>
                  )}
                  <p className="text-[10px] text-gray-400">{report.page_url}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(report.created_at)}</p>
                </div>
                {report.status === 'new' && (
                  <button
                    onClick={() => handleMarkResolved(report.id)}
                    disabled={pendingIds.has(report.id)}
                    className="shrink-0 text-xs bg-gray-100 text-gray-600 font-medium px-3 py-1.5 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    {pendingIds.has(report.id) ? '...' : 'סמן כטופל'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
