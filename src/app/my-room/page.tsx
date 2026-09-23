import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TeacherRoomAssignment } from '@/types/database'
import MyRoomClient from './MyRoomClient'
import BottomNav from '@/components/layout/BottomNav'

export const dynamic = 'force-dynamic'

export default async function MyRoomPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = teacher?.role === 'admin'

  const dow = new Date().getDay() // 0=Sun … 6=Sat

  const { data: assignmentRaw } = await supabase
    .from('teacher_room_assignments')
    .select('*, rooms(name)')
    .eq('teacher_id', user.id)
    .eq('day_of_week', dow)
    .maybeSingle()

  const roomName =
    (assignmentRaw as (TeacherRoomAssignment & { rooms: { name: string } | null }) | null)
      ?.rooms?.name ?? null

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">קונסרבטוריון דימונה</p>
        <h1 className="text-xl font-bold">החדר שלי</h1>
      </div>
      <MyRoomClient roomName={roomName} />
      <BottomNav isAdmin={isAdmin} userId={user.id} />
    </div>
  )
}
