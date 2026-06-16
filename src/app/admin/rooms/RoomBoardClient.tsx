'use client'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'

interface Props {
  rooms: Room[]
  assignments: TeacherRoomAssignment[]
  teachers: Pick<Teacher, 'id' | 'name'>[]
}

export default function RoomBoardClient({ rooms, assignments, teachers }: Props) {
  return <div className="px-4 py-5 text-gray-400 text-sm">טוען...</div>
}
