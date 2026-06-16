'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { replyToMessage } from './messageActions'

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
}

export default function MessagesInboxClient({ initialMessages }: Props) {
  const [messages, setMessages] = useState<MessageWithTeacher[]>(initialMessages)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin-messages-inbox')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
      }, async () => {
        const { data } = await supabase
          .from('messages')
          .select('*, teachers(name)')
          .order('created_at', { ascending: false })
        if (data) setMessages(data as MessageWithTeacher[])
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
    if (result.error) {
      setErrors(prev => ({ ...prev, [id]: result.error! }))
      return
    }
    setReplyTexts(prev => ({ ...prev, [id]: '' }))
  }

  const pending = messages.filter(m => m.status === 'pending')
  const replied = messages.filter(m => m.status === 'replied')

  return (
    <div className="px-4 py-5 flex flex-col gap-5" dir="rtl">
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
                ענה
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
  )
}
