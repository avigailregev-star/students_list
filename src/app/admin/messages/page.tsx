import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
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
  from_admin?: boolean
  teachers: { name: string } | null
}

export type BugReport = {
  id: string
  teacher_name: string | null
  page_url: string | null
  error_message: string | null
  user_description: string | null
  status: 'new' | 'resolved'
  created_at: string
}

export type TeacherOption = { id: string; name: string }

export default async function AdminMessagesPage() {
  const { supabase } = await requireAdmin()
  const adminSupabase = createAdminClient()

  const [
    { data: messagesRaw },
    { data: vacationsRaw },
    { data: bugsRaw },
    { data: teachersRaw },
  ] = await Promise.all([
    supabase.from('messages').select('*, teachers(name)').order('created_at', { ascending: false }),
    supabase.from('vacation_requests').select('*, teachers(name)').order('created_at', { ascending: false }),
    adminSupabase.from('bug_reports').select('id, teacher_name, page_url, error_message, user_description, status, created_at').order('created_at', { ascending: false }),
    adminSupabase.from('teachers').select('id, name').neq('role', 'admin').order('name'),
  ])

  const messages = (messagesRaw ?? []) as MessageWithTeacher[]
  const vacationRequests = (vacationsRaw ?? []) as VacationRequestWithTeacher[]
  const bugReports = (bugsRaw ?? []) as BugReport[]
  const teachers = (teachersRaw ?? []) as TeacherOption[]

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">ניהול</p>
        <h1 className="text-xl font-bold">הודעות מורים</h1>
      </div>
      <MessagesInboxClient initialMessages={messages} initialVacationRequests={vacationRequests} initialBugReports={bugReports} teachers={teachers} />
    </div>
  )
}
