'use client'

import { useState, useTransition } from 'react'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'
import { addRoom, deleteRoom, assignRoom, removeAssignment } from './roomActions'
import LiveRoomsClient from './LiveRoomsClient'

const DAYS = [
  { dow: 0, label: "א׳" },
  { dow: 1, label: "ב׳" },
  { dow: 2, label: "ג׳" },
  { dow: 3, label: "ד׳" },
  { dow: 4, label: "ה׳" },
  { dow: 5, label: "ו׳" },
]

const TEACHER_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' },
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
]

interface Props {
  rooms: Room[]
  assignments: TeacherRoomAssignment[]
  teachers: Pick<Teacher, 'id' | 'name'>[]
}

export default function RoomBoardClient({ rooms, assignments, teachers }: Props) {
  const [mode, setMode] = useState<'weekly' | 'live'>('weekly')
  const [newRoomName, setNewRoomName] = useState('')
  const [roomError, setRoomError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [activeCell, setActiveCell] = useState<{ roomId: string; dow: number; top: number; right: number } | null>(null)
  const [cellError, setCellError] = useState('')

  const teacherColorMap = new Map(
    teachers.map((t, i) => [t.id, TEACHER_COLORS[i % TEACHER_COLORS.length]])
  )

  const assignmentMap = new Map(
    assignments.map(a => [`${a.room_id}-${a.day_of_week}`, a])
  )

  function getTeacher(teacherId: string) {
    return teachers.find(t => t.id === teacherId)
  }

  function handleAddRoom() {
    if (!newRoomName.trim()) return
    setRoomError('')
    startTransition(async () => {
      const result = await addRoom(newRoomName)
      if (result.error) { setRoomError(result.error); return }
      setNewRoomName('')
    })
  }

  function handleDeleteRoom(id: string) {
    setRoomError('')
    startTransition(async () => {
      const result = await deleteRoom(id)
      if (result.error) setRoomError(result.error)
    })
  }

  function handleCellClick(e: React.MouseEvent<HTMLButtonElement>, roomId: string, dow: number) {
    setCellError('')
    if (activeCell?.roomId === roomId && activeCell?.dow === dow) {
      setActiveCell(null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      setActiveCell({
        roomId,
        dow,
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
  }

  function handleAssign(teacherId: string) {
    if (!activeCell) return
    setCellError('')
    startTransition(async () => {
      const result = await assignRoom(activeCell.roomId, teacherId, activeCell.dow)
      if (result.error) { setCellError(result.error); return }
      setActiveCell(null)
    })
  }

  function handleRemove() {
    if (!activeCell) return
    setCellError('')
    startTransition(async () => {
      const result = await removeAssignment(activeCell.roomId, activeCell.dow)
      if (result.error) { setCellError(result.error); return }
      setActiveCell(null)
    })
  }

  return (
    <div className="px-4 py-5 flex flex-col gap-5" dir="rtl">

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

      {mode === 'live' && <LiveRoomsClient rooms={rooms} assignments={assignments} teachers={teachers} />}

      {mode === 'weekly' && (
        <>
          {/* Room management */}
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <p className="text-sm font-bold text-gray-700">ניהול חדרים</p>
            <div className="flex gap-2">
              <input
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddRoom()}
                placeholder="שם החדר..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                dir="rtl"
              />
              <button
                onClick={handleAddRoom}
                disabled={isPending || !newRoomName.trim()}
                className="px-4 py-2 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 disabled:opacity-40 transition-colors"
              >
                הוסף
              </button>
            </div>
            {roomError && <p className="text-xs text-red-500">{roomError}</p>}
            <div className="flex flex-col gap-1.5">
              {rooms.map(room => {
                const roomAssignments = assignments.filter(a => a.room_id === room.id)
                return (
                  <div key={room.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl text-sm">
                    <span className="font-semibold text-gray-800">{room.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {roomAssignments.length > 0 ? `${roomAssignments.length} שיבוצים` : 'פנוי'}
                      </span>
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        disabled={isPending}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                )
              })}
              {rooms.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">אין חדרים עדיין</p>
              )}
            </div>
          </div>

          {/* Weekly board */}
          {rooms.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-bold text-gray-700">לוח שבועי</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[420px]">
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
                          const key = `${room.id}-${d.dow}`
                          const assignment = assignmentMap.get(key)
                          const teacher = assignment ? getTeacher(assignment.teacher_id) : null
                          const color = teacher ? teacherColorMap.get(teacher.id) : null
                          const isActive = activeCell?.roomId === room.id && activeCell?.dow === d.dow

                          return (
                            <td key={d.dow} className="p-1 text-center">
                              <button
                                onClick={e => handleCellClick(e, room.id, d.dow)}
                                className={`w-full rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors border ${
                                  isActive
                                    ? 'ring-2 ring-teal-400 border-teal-300 bg-teal-50'
                                    : teacher && color
                                    ? `${color.bg} ${color.text} ${color.border} hover:opacity-80`
                                    : 'border-dashed border-gray-200 text-gray-300 hover:border-gray-300 hover:text-gray-400'
                                }`}
                              >
                                {teacher ? teacher.name : '+ שבץ'}
                              </button>

                              {/* Popover */}
                              {isActive && (
                                <div
                                  style={{ top: activeCell!.top, right: activeCell!.right }}
                                  className="fixed z-50 bg-white rounded-2xl shadow-xl border border-gray-100 min-w-[160px] overflow-hidden"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <div className="px-3 py-2 bg-teal-500 text-white text-xs font-bold">
                                    {d.label} · {room.name}
                                  </div>
                                  <div className="py-1 max-h-48 overflow-y-auto">
                                    {teachers.map(t => {
                                      const c = teacherColorMap.get(t.id)!
                                      const isCurrent = assignment?.teacher_id === t.id
                                      return (
                                        <button
                                          key={t.id}
                                          onClick={() => handleAssign(t.id)}
                                          disabled={isPending}
                                          className={`w-full text-right px-3 py-2 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-40 flex items-center gap-2 ${isCurrent ? `${c.bg} ${c.text}` : 'text-gray-700'}`}
                                        >
                                          {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
                                          {t.name}
                                        </button>
                                      )
                                    })}
                                    {assignment && (
                                      <>
                                        <div className="border-t border-gray-100 mt-1 pt-1">
                                          <button
                                            onClick={handleRemove}
                                            disabled={isPending}
                                            className="w-full text-right px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                          >
                                            הסר שיבוץ
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  {cellError && (
                                    <p className="px-3 py-2 text-[10px] text-red-500 border-t border-gray-100">{cellError}</p>
                                  )}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 text-center py-2">לחצי על תא לשיבוץ או החלפה</p>
            </div>
          )}
        </>
      )}

      {/* Close popover on outside click */}
      {activeCell && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveCell(null)} />
      )}
    </div>
  )
}
