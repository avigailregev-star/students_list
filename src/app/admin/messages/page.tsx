import { requireAdmin } from '@/lib/auth'
import MessagesInboxClient from './MessagesInboxClient'
import type { VacationRequestWithTeacher } from '@/types/database'

export const dynamic = 'force-dynamic'

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

export default async function AdminMessagesPage() {
  const { supabase } = await requireAdmin()

  const { data: messagesRaw } = await supabase
    .from('messages')
    .select('*, teachers(name)')
    .order('created_at', { ascending: false })

  const { data: vacationsRaw } = await supabase
    .from('vacation_requests')
    .select('*, teachers(name)')
    .order('created_at', { ascending: false })

  const messages = (messagesRaw ?? []) as MessageWithTeacher[]
  const vacationRequests = (vacationsRaw ?? []) as VacationRequestWithTeacher[]

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">ניהול</p>
        <h1 className="text-xl font-bold">הודעות מורים</h1>
      </div>
      <MessagesInboxClient initialMessages={messages} initialVacationRequests={vacationRequests} />
    </div>
  )
}
