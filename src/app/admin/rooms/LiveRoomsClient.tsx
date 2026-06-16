'use client'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'

interface Props {
  rooms: Room[]
  assignments: TeacherRoomAssignment[]
  teachers: Pick<Teacher, 'id' | 'name'>[]
}

export default function LiveRoomsClient({ rooms }: Props) {
  return <div className="text-sm text-gray-400 text-center py-8">טוען תצוגה חיה...</div>
}
