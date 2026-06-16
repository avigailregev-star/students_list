import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'
import RoomBoardClient from './RoomBoardClient'

export default async function AdminRoomsPage() {
  const { supabase } = await requireAdmin()

  const [
    { data: roomsRaw },
    { data: assignmentsRaw },
    { data: teachersRaw },
  ] = await Promise.all([
    supabase.from('rooms').select('*').order('name'),
    supabase.from('teacher_room_assignments').select('*'),
    supabase.from('teachers')
      .select('id, name')
      .eq('is_pending', false)
      .eq('role', 'teacher')
      .order('name'),
  ])

  const rooms = (roomsRaw ?? []) as Room[]
  const assignments = (assignmentsRaw ?? []) as TeacherRoomAssignment[]
  const teachers = (teachersRaw ?? []) as Pick<Teacher, 'id' | 'name'>[]

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">ניהול</p>
            <h1 className="text-xl font-bold">שיבוץ חדרים</h1>
          </div>
        </div>
      </div>
      <RoomBoardClient rooms={rooms} assignments={assignments} teachers={teachers} />
    </div>
  )
}
