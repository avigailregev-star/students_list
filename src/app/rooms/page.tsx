import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'
import RoomBoardReadOnly from './RoomBoardReadOnly'
import BottomNav from '@/components/layout/BottomNav'

export default async function RoomsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase.from('teachers').select('role').eq('id', user.id).single()
  const isAdmin = teacher?.role === 'admin'

  const [{ data: roomsRaw }, { data: assignmentsRaw }, { data: teachersRaw }] = await Promise.all([
    supabase.from('rooms').select('*').order('name'),
    supabase.from('teacher_room_assignments').select('*'),
    supabase.from('teachers').select('id, name').eq('role', 'teacher').eq('is_pending', false).order('name'),
  ])

  const rooms = (roomsRaw ?? []) as Room[]
  const assignments = (assignmentsRaw ?? []) as TeacherRoomAssignment[]
  const teachers = (teachersRaw ?? []) as Pick<Teacher, 'id' | 'name'>[]

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div>
          <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">קונסרבטוריון דימונה</p>
          <h1 className="text-xl font-bold">לוח חדרים</h1>
        </div>
      </div>
      <RoomBoardReadOnly
        rooms={rooms}
        assignments={assignments}
        teachers={teachers}
        currentUserId={user.id}
      />
      <BottomNav isAdmin={isAdmin}/>
    </div>
  )
}
