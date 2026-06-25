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

type ActiveCell = {
  roomId: string
  dow: number
  assignmentId: string | null  // null = adding new slot
  top?: number
  bottom?: number
  right: number
}

export default function RoomBoardClient({ rooms, assignments, teachers }: Props) {
  const [mode, setMode] = useState<'weekly' | 'live'>('weekly')
  const [newRoomName, setNewRoomName] = useState('')
  const [roomError, setRoomError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [cellError, setCellError] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const teacherColorMap = new Map(
    teachers.map((t, i) => [t.id, TEACHER_COLORS[i % TEACHER_COLORS.length]])
  )

  // Group assignments by "roomId-dow", sorted by start_time
  const assignmentMap = new Map<string, TeacherRoomAssignment[]>()
  for (const a of assignments) {
    const key = `${a.room_id}-${a.day_of_week}`
    if (!assignmentMap.has(key)) assignmentMap.set(key, [])
    assignmentMap.get(key)!.push(a)
  }
  for (const list of assignmentMap.values()) {
    list.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
  }

  function getTeacher(teacherId: string) {
    return teachers.find(t => t.id === teacherId)
  }

  function openPopover(
    e: React.MouseEvent<HTMLButtonElement>,
    roomId: string,
    dow: number,
    assignmentId: string | null,
    fillStart?: string,
    fillEnd?: string,
  ) {
    setCellError('')
    // Toggle off if same cell+assignment clicked
    if (activeCell?.roomId === roomId && activeCell?.dow === dow && activeCell?.assignmentId === assignmentId) {
      setActiveCell(null)
      return
    }
    setStartTime(fillStart ?? '')
    setEndTime(fillEnd ?? '')
    const rect = e.currentTarget.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < 300
    setActiveCell({
      roomId,
      dow,
      assignmentId,
      top: openUpward ? undefined : rect.bottom + 4,
      bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
      right: window.innerWidth - rect.right,
    })
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

  function handleAssign(teacherId: string) {
    if (!activeCell) return
    setCellError('')
    startTransition(async () => {
      const result = await assignRoom(
        activeCell.roomId,
        teacherId,
        activeCell.dow,
        startTime,
        endTime,
        activeCell.assignmentId ?? undefined,
      )
      if (result.error) { setCellError(result.error); return }
      setActiveCell(null)
    })
  }

  function handleRemove() {
    if (!activeCell?.assignmentId) return
    setCellError('')
    startTransition(async () => {
      const result = await removeAssignment(activeCell.assignmentId!)
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
                        <td className="p-2 text-xs font-bold text-gray-700 text-right align-top pt-3">{room.name}</td>
                        {DAYS.map(d => {
                          const key = `${room.id}-${d.dow}`
                          const cellAssignments = assignmentMap.get(key) ?? []
                          const isNewActive = activeCell?.roomId === room.id && activeCell?.dow === d.dow && activeCell?.assignmentId === null

                          return (
                            <td key={d.dow} className="p-1 align-top">
                              <div className="flex flex-col gap-0.5">

                                {/* Existing assignment chips */}
                                {cellAssignments.map(a => {
                                  const teacher = getTeacher(a.teacher_id)
                                  const color = teacher ? teacherColorMap.get(teacher.id) : null
                                  const isActive = activeCell?.roomId === room.id && activeCell?.dow === d.dow && activeCell?.assignmentId === a.id
                                  return (
                                    <button
                                      key={a.id}
                                      onClick={e => openPopover(e, room.id, d.dow, a.id, a.start_time?.slice(0, 5), a.end_time?.slice(0, 5))}
                                      className={`w-full rounded-lg px-1 py-1.5 text-[11px] font-semibold transition-colors border flex flex-col items-center gap-0.5 ${
                                        isActive
                                          ? 'ring-2 ring-teal-400 border-teal-300 bg-teal-50 text-teal-700'
                                          : teacher && color
                                          ? `${color.bg} ${color.text} ${color.border} hover:opacity-80`
                                          : 'border-dashed border-gray-200 text-gray-300 hover:border-gray-300'
                                      }`}
                                    >
                                      <span>{teacher ? teacher.name : '?'}</span>
                                      {a.start_time && (
                                        <span className="text-[9px] opacity-70 font-normal">
                                          {a.start_time.slice(0, 5)}{a.end_time ? `–${a.end_time.slice(0, 5)}` : ''}
                                        </span>
                                      )}
                                    </button>
                                  )
                                })}

                                {/* Add new slot */}
                                <button
                                  onClick={e => openPopover(e, room.id, d.dow, null)}
                                  className={`w-full rounded-lg px-1 py-1 text-[10px] font-semibold border transition-colors ${
                                    isNewActive
                                      ? 'ring-2 ring-teal-400 border-teal-300 border-solid bg-teal-50 text-teal-400'
                                      : 'border-dashed border-gray-200 text-gray-300 hover:border-teal-300 hover:text-teal-400'
                                  }`}
                                >
                                  + שבץ
                                </button>
                              </div>

                              {/* Popover */}
                              {activeCell?.roomId === room.id && activeCell?.dow === d.dow && (
                                <div
                                  style={{ top: activeCell.top, bottom: activeCell.bottom, right: activeCell.right }}
                                  className="fixed z-50 bg-white rounded-2xl shadow-xl border border-gray-100 min-w-[160px] max-h-[300px] overflow-y-auto"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <div className="sticky top-0 px-3 py-2 bg-teal-500 text-white text-xs font-bold">
                                    {d.label} · {room.name}
                                    {activeCell.assignmentId ? ' · עריכה' : ' · שיבוץ חדש'}
                                  </div>
                                  <div className="px-3 py-2 border-b border-gray-100 flex gap-2 items-center">
                                    <input
                                      type="time"
                                      value={startTime}
                                      onChange={e => setStartTime(e.target.value)}
                                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-teal-400"
                                    />
                                    <span className="text-gray-300 text-xs">—</span>
                                    <input
                                      type="time"
                                      value={endTime}
                                      onChange={e => setEndTime(e.target.value)}
                                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-teal-400"
                                    />
                                  </div>
                                  <div className="py-1">
                                    {teachers.map(t => {
                                      const c = teacherColorMap.get(t.id)!
                                      const currentAssignment = activeCell.assignmentId
                                        ? assignments.find(a => a.id === activeCell.assignmentId)
                                        : null
                                      const isCurrent = currentAssignment?.teacher_id === t.id
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
                                    {activeCell.assignmentId && (
                                      <div className="border-t border-gray-100 mt-1 pt-1">
                                        <button
                                          onClick={handleRemove}
                                          disabled={isPending}
                                          className="w-full text-right px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                        >
                                          הסר שיבוץ
                                        </button>
                                      </div>
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
              <p className="text-[10px] text-gray-400 text-center py-2">לחצי על שיבוץ לעריכה · + שבץ להוספת משבצת נוספת באותו יום</p>
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
