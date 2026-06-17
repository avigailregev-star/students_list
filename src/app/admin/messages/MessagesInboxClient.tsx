// src/app/admin/messages/MessagesInboxClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { replyToMessage } from './messageActions'
import { decideVacationRequest } from './vacationActions'
import type { VacationRequestWithTeacher } from '@/types/database'

type MessageWithTeacher = {
  id: string
  teacher_id: string
  content: string
  reply: string | null
  status: 'pending' | 'replied'
  created_at: string
  replied_at: string | null
  teachers: { name: string } | null
}

interface Props {
  initialMessages: MessageWithTeacher[]
  initialVacationRequests: VacationRequestWithTeacher[]
}

export default function MessagesInboxClient({ initialMessages, initialVacationRequests }: Props) {
  const [tab, setTab] = useState<'messages' | 'vacations'>('messages')
  const [messages, setMessages] = useState<MessageWithTeacher[]>(initialMessages)
  const [vacations, setVacations] = useState<VacationRequestWithTeacher[]>(initialVacationRequests)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin-messages-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
        const { data } = await supabase
          .from('messages')
          .select('*, teachers(name)')
          .order('created_at', { ascending: false })
        if (data) setMessages(data as MessageWithTeacher[])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vacation_requests' }, async () => {
        const { data } = await supabase
          .from('vacation_requests')
          .select('*, teachers(name)')
          .order('created_at', { ascending: false })
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

  const pendingMessages = messages.filter(m => m.status === 'pending').length
  const pendingVacations = vacations.filter(v => v.status === 'pending').length
  const pending = messages.filter(m => m.status === 'pending')
  const replied = messages.filter(m => m.status === 'replied')
  const pendingVac = vacations.filter(v => v.status === 'pending')
  const decidedVac = vacations.filter(v => v.status !== 'pending')

  return (
    <div dir="rtl">
      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-5">
        <button
          onClick={() => setTab('messages')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            tab === 'messages' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          הודעות{pendingMessages > 0 ? ` (${pendingMessages})` : ''}
        </button>
        <button
          onClick={() => setTab('vacations')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            tab === 'vacations' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          בקשות חופשה{pendingVacations > 0 ? ` (${pendingVacations})` : ''}
        </button>
      </div>

      {/* Messages tab */}
      {tab === 'messages' && (
        <div className="px-4 py-5 flex flex-col gap-5">
          {messages.length === 0 && (
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
    </div>
  )
}
