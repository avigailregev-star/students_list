'use client'

import { useState } from 'react'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'
import LiveRoomsClient from '@/app/admin/rooms/LiveRoomsClient'

const DAYS = [
  { dow: 0, label: "א׳" },
  { dow: 1, label: "ב׳" },
  { dow: 2, label: "ג׳" },
  { dow: 3, label: "ד׳" },
  { dow: 4, label: "ה׳" },
  { dow: 5, label: "ו׳" },
]

const TEACHER_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800' },
  { bg: 'bg-violet-100', text: 'text-violet-800' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-pink-100', text: 'text-pink-800' },
  { bg: 'bg-teal-100', text: 'text-teal-800' },
]

interface Props {
  rooms: Room[]
  assignments: TeacherRoomAssignment[]
  teachers: Pick<Teacher, 'id' | 'name'>[]
  currentUserId: string
}

export default function RoomBoardReadOnly({ rooms, assignments, teachers, currentUserId }: Props) {
  const [mode, setMode] = useState<'weekly' | 'live'>('weekly')

  const teacherColorMap = new Map(
    teachers.map((t, i) => [t.id, TEACHER_COLORS[i % TEACHER_COLORS.length]])
  )
  const assignmentMap = new Map(
    assignments.map(a => [`${a.room_id}-${a.day_of_week}`, a])
  )
  const teacherMap = new Map(teachers.map(t => [t.id, t.name]))

  if (rooms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-20">
        אין חדרים מוגדרים עדיין
      </div>
    )
  }

  return (
    <div className="px-4 py-5 flex flex-col gap-4" dir="rtl">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('weekly')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'weekly' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'}`}
        >
          לוח שבועי
        </button>
        <button
          onClick={() => setMode('live')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'live' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}
        >
          ⚡ עכשיו
        </button>
      </div>

      {mode === 'live' && (
        <LiveRoomsClient rooms={rooms} assignments={assignments} teachers={teachers} />
      )}

      {mode === 'weekly' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[380px]">
              <thead>
                <tr>
                  <th className="p-2 text-xs font-bold text-gray-400 text-right border-b border-gray-100 w-24">חדר</th>
                  {DAYS.map(d => (
                    <th key={d.dow} className="p-2 text-xs font-bold text-gray-400 text-center border-b border-gray-100">{d.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.id} className="border-b border-gray-50 last:border-0">
                    <td className="p-2 text-xs font-bold text-gray-700 text-right">{room.name}</td>
                    {DAYS.map(d => {
                      const assignment = assignmentMap.get(`${room.id}-${d.dow}`)
                      const teacherName = assignment ? teacherMap.get(assignment.teacher_id) : null
                      const isMe = assignment?.teacher_id === currentUserId
                      const color = assignment ? teacherColorMap.get(assignment.teacher_id) : null
                      return (
                        <td key={d.dow} className="p-1 text-center">
                          {teacherName ? (
                            <span
                              className={`inline-block w-full rounded-lg px-1 py-2 text-[11px] font-semibold ${
                                isMe
                                  ? 'bg-violet-100 text-violet-800 ring-2 ring-violet-400'
                                  : `${color?.bg} ${color?.text}`
                              }`}
                            >
                              {isMe ? `⭐ ${teacherName}` : teacherName}
                            </span>
                          ) : (
                            <span className="text-gray-200 text-[11px]">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 text-center py-2">תא עם מסגרת סגולה = החדר שלך</p>
        </div>
      )}
    </div>
  )
}
