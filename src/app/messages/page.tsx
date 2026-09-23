import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Message } from '@/types/database'
import BottomNav from '@/components/layout/BottomNav'
import MessagesClient from './MessagesClient'

export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: teacher }, { data: messagesRaw }] = await Promise.all([
    supabase.from('teachers').select('role').eq('id', user.id).single(),
    supabase
      .from('messages')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">קונסרבטוריון דימונה</p>
        <h1 className="text-xl font-bold">הודעות</h1>
      </div>
      <MessagesClient initialMessages={(messagesRaw ?? []) as Message[]} userId={user.id} />
      <BottomNav isAdmin={teacher?.role === 'admin'} userId={user.id} />
    </div>
  )
}
