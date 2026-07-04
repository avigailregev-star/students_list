'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/types/database'
import { sendMessage } from './messageActions'

interface Props {
  roomName: string | null
  initialMessages: Message[]
  userId: string
}

export default function MyRoomClient({ roomName, initialMessages, userId }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [content, setContent] = useState('')
  const [sendError, setSendError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [replyToast, setReplyToast] = useState(false)
  const [adminReplyTexts, setAdminReplyTexts] = useState<Record<string, string>>({})
  const [adminReplyPending, setAdminReplyPending] = useState<Set<string>>(new Set())
  const [repliedAdminIds, setRepliedAdminIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`repliedAdminMsgs_${userId}`)
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>()
    } catch { return new Set<string>() }
  })
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('my-messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `teacher_id=eq.${userId}`,
      }, async () => {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('teacher_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)
        if (data) {
          const newMessages = data as Message[]
          setMessages(prev => {
            const prevPending = new Set(prev.filter(m => m.status === 'pending' && !m.from_admin).map(m => m.id))
            const gotReply = newMessages.some(m => m.status === 'replied' && prevPending.has(m.id))
            if (gotReply) setReplyToast(true)
            return newMessages
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    if (!replyToast) return
    const t = setTimeout(() => setReplyToast(false), 4000)
    return () => clearTimeout(t)
  }, [replyToast])

  function handleSend() {
    if (!content.trim()) return
    setSendError('')
    startTransition(async () => {
      const result = await sendMessage(content)
      if (result.error === 'unauthorized') { router.push('/login'); return }
      if (result.error) { setSendError(result.error); return }
      setContent('')
    })
  }

  function handleAdminReply(msgId: string) {
    const replyContent = adminReplyTexts[msgId] ?? ''
    if (!replyContent.trim()) return
    setAdminReplyPending(prev => new Set(prev).add(msgId))
    startTransition(async () => {
      const result = await sendMessage(replyContent)
      setAdminReplyPending(prev => { const s = new Set(prev); s.delete(msgId); return s })
      if (result.error === 'unauthorized') { router.push('/login'); return }
      if (!result.error) {
        setAdminReplyTexts(prev => ({ ...prev, [msgId]: '' }))
        setRepliedAdminIds(prev => {
          const next = new Set(prev).add(msgId)
          try { localStorage.setItem(`repliedAdminMsgs_${userId}`, JSON.stringify([...next])) } catch {}
          return next
        })
      }
    })
  }

  const adminMessages = messages.filter(m => m.from_admin)
  const myMessages = messages.filter(m => !m.from_admin)

  return (
    <div className="px-4 py-5 flex flex-col gap-4" dir="rtl">
      {/* Reply toast */}
      {replyToast && (
        <div className="fixed top-4 inset-x-4 z-50 bg-emerald-500 text-white rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
          <span className="text-xl">✉️</span>
          <p className="text-sm font-bold">התקבלה תשובה מהמזכירות!</p>
          <button onClick={() => setReplyToast(false)} className="mr-auto text-white/70 hover:text-white text-lg leading-none">×</button>
        </div>
      )}

      {/* Room card */}
      {roomName ? (
        <div className="bg-emerald-500 text-white rounded-2xl px-5 py-5 shadow-sm shadow-emerald-200">
          <p className="text-xs font-semibold opacity-80 mb-1">החדר שלך היום</p>
          <p className="text-3xl font-bold">{roomName}</p>
        </div>
      ) : (
        <div className="bg-gray-100 rounded-2xl px-5 py-5">
          <p className="text-sm text-gray-400 font-semibold">לא שובצת לחדר היום</p>
        </div>
      )}

      <Link href="/rooms" className="text-xs text-teal-500 font-semibold">
        ← ראי את הלוח השבועי
      </Link>

      {/* Admin messages */}
      {adminMessages.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">הודעות מהמנהל</p>
          {adminMessages.map(msg => {
            const replied = repliedAdminIds.has(msg.id)
            return (
              <div key={msg.id} className={`border rounded-2xl p-4 transition-colors ${replied ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${replied ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-500 text-white'}`}>
                    {replied ? '✓ ענית' : 'מהמנהל'}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(msg.created_at).toLocaleDateString('he-IL')}
                  </span>
                </div>
                <p className={`text-sm mb-3 ${replied ? 'text-gray-500' : 'text-blue-900'}`}>{msg.content}</p>
                {!replied && (
                  <>
                    <textarea
                      value={adminReplyTexts[msg.id] ?? ''}
                      onChange={e => setAdminReplyTexts(prev => ({ ...prev, [msg.id]: e.target.value }))}
                      placeholder="השב למנהל..."
                      rows={2}
                      className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400 bg-white"
                      dir="rtl"
                    />
                    <button
                      onClick={() => handleAdminReply(msg.id)}
                      disabled={adminReplyPending.has(msg.id) || !(adminReplyTexts[msg.id] ?? '').trim()}
                      className="mt-2 px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-colors"
                    >
                      {adminReplyPending.has(msg.id) ? '...' : 'שלח'}
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Send message */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
        <p className="text-sm font-bold text-gray-700">שליחת הודעה למזכירות</p>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="כתבי את בקשתך כאן..."
          rows={3}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-400"
          dir="rtl"
        />
        {sendError && <p className="text-xs text-red-500">{sendError}</p>}
        <button
          onClick={handleSend}
          disabled={isPending || !content.trim()}
          className="self-end px-5 py-2 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 disabled:opacity-40 transition-colors"
        >
          {isPending ? 'שולחת...' : 'שלחי'}
        </button>
      </div>

      {/* Teacher's own messages */}
      {myMessages.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">הודעות שלי</p>
          {myMessages.map(msg => (
            <div key={msg.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  msg.status === 'replied'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {msg.status === 'replied' ? 'נענה' : 'ממתין'}
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(msg.created_at).toLocaleDateString('he-IL')}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-2">{msg.content}</p>
              {msg.reply && (
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <p className="text-xs text-gray-400 font-semibold mb-1">תשובת המזכירות:</p>
                  <p className="text-sm text-emerald-700 font-medium">{msg.reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
