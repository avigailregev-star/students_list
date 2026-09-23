'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/types/database'
import { replyToAdminMessage, sendMessage } from '@/app/my-room/messageActions'

export default function MessagesClient({ initialMessages, userId }: { initialMessages: Message[]; userId: string }) {
  const [messages, setMessages] = useState(initialMessages)
  const [content, setContent] = useState('')
  const [sendError, setSendError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [replyPending, setReplyPending] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const refreshMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('teacher_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setMessages(data as Message[])
    }
    const channel = supabase
      .channel('teacher-messages-page')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'messages', filter: `teacher_id=eq.${userId}`,
      }, refreshMessages)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  function handleSend() {
    if (!content.trim()) return
    setSendError('')
    startTransition(async () => {
      const result = await sendMessage(content)
      if (result.error === 'unauthorized') { router.push('/login'); return }
      if (result.error) { setSendError(result.error); return }
      setContent('')
      router.refresh()
    })
  }

  function handleReply(messageId: string) {
    const reply = replyTexts[messageId] ?? ''
    if (!reply.trim()) return
    setReplyPending(prev => new Set(prev).add(messageId))
    startTransition(async () => {
      const result = await replyToAdminMessage(messageId, reply)
      setReplyPending(prev => { const next = new Set(prev); next.delete(messageId); return next })
      if (result.error === 'unauthorized') { router.push('/login'); return }
      if (result.error) { setSendError(result.error); return }
      setReplyTexts(prev => ({ ...prev, [messageId]: '' }))
      setMessages(prev => prev.map(msg => msg.id === messageId
        ? { ...msg, reply: reply.trim(), status: 'replied' as const, replied_at: new Date().toISOString() }
        : msg))
    })
  }

  const adminMessages = messages.filter(message => message.from_admin)
  const teacherMessages = messages.filter(message => !message.from_admin)

  return (
    <div className="px-4 py-5 flex flex-col gap-5" dir="rtl">
      {adminMessages.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">הודעות מהמשרד</h2>
          {adminMessages.map(message => {
            const replied = message.status === 'replied'
            return (
              <div key={message.id} className={`border rounded-2xl p-4 ${replied ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${replied ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-500 text-white'}`}>
                    {replied ? '✓ ענית' : 'מהמשרד'}
                  </span>
                  <span className="text-[10px] text-gray-400">{new Date(message.created_at).toLocaleDateString('he-IL')}</span>
                </div>
                <p className="text-sm text-blue-900 whitespace-pre-wrap">{message.content}</p>
                {replied && message.reply ? (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">התשובה שלך</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.reply}</p>
                  </div>
                ) : (
                  <div className="mt-3">
                    <textarea
                      value={replyTexts[message.id] ?? ''}
                      onChange={event => setReplyTexts(prev => ({ ...prev, [message.id]: event.target.value }))}
                      placeholder="השיבי למשרד..."
                      rows={2}
                      className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400 bg-white"
                    />
                    <button
                      onClick={() => handleReply(message.id)}
                      disabled={replyPending.has(message.id) || !(replyTexts[message.id] ?? '').trim()}
                      className="mt-2 px-5 py-2 bg-blue-500 text-white text-sm font-bold rounded-xl disabled:opacity-40"
                    >
                      {replyPending.has(message.id) ? 'שולחת...' : 'שליחת תשובה'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}

      <section className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-gray-700">שליחת הודעה למשרד</h2>
        <textarea
          value={content}
          onChange={event => setContent(event.target.value)}
          placeholder="כתבי את בקשתך כאן..."
          rows={3}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-400"
        />
        {sendError && <p className="text-xs text-red-500">{sendError}</p>}
        <button
          onClick={handleSend}
          disabled={isPending || !content.trim()}
          className="self-end px-5 py-2 bg-teal-500 text-white text-sm font-bold rounded-xl disabled:opacity-40"
        >
          {isPending ? 'שולחת...' : 'שלחי'}
        </button>
      </section>

      {teacherMessages.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">הודעות ששלחתי</h2>
          {teacherMessages.map(message => (
            <div key={message.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${message.status === 'replied' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {message.status === 'replied' ? 'נענתה' : 'ממתינה'}
                </span>
                <span className="text-[10px] text-gray-400">{new Date(message.created_at).toLocaleDateString('he-IL')}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.content}</p>
              {message.reply && (
                <div className="border-t border-gray-100 pt-3 mt-3">
                  <p className="text-xs text-gray-400 font-semibold mb-1">תשובת המשרד</p>
                  <p className="text-sm text-emerald-700 font-medium whitespace-pre-wrap">{message.reply}</p>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
