'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'

interface Props {
  rooms: Room[]
  assignments: TeacherRoomAssignment[]
  teachers: Pick<Teacher, 'id' | 'name'>[]
}

interface RoomStatus {
  room: Room
  teacherName: string | null
  lessonType: string | null
  startTime: string | null
  endTime: string | null
  isOccupied: boolean
  nextLessonTime: string | null
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function LiveRoomsClient({ rooms, assignments, teachers }: Props) {
  const [statuses, setStatuses] = useState<RoomStatus[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const teacherMap = new Map(teachers.map(t => [t.id, t.name]))

  const fetchLiveData = useCallback(async () => {
    const supabase = createClient()
    const today = todayStr()
    const dow = new Date().getDay()

    // Map: teacher_id → room_id for today's day_of_week
    const teacherRoomMap = new Map(
      assignments
        .filter(a => a.day_of_week === dow)
        .map(a => [a.teacher_id, a.room_id])
    )

    // Fetch today's active lessons
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, group_id, start_time, status')
      .eq('date', today)
      .neq('status', 'teacher_canceled')
      .eq('is_holiday', false)

    if (!lessons || lessons.length === 0) {
      setStatuses(rooms.map(room => ({
        room, teacherName: null, lessonType: null,
        startTime: null, endTime: null, isOccupied: false, nextLessonTime: null,
      })))
      setLastUpdated(new Date())
      return
    }

    const groupIds = [...new Set(lessons.map((l: { group_id: string }) => l.group_id))]

    const [{ data: groups }, { data: schedules }] = await Promise.all([
      supabase.from('groups').select('id, teacher_id, lesson_type').in('id', groupIds),
      supabase.from('group_schedules')
        .select('group_id, start_time, end_time')
        .in('group_id', groupIds)
        .eq('day_of_week', dow),
    ])

    type GroupRow = { id: string; teacher_id: string; lesson_type: string }
    type ScheduleRow = { group_id: string; start_time: string; end_time: string }
    const groupMap = new Map<string, GroupRow>((groups ?? []).map((g: GroupRow) => [g.id, g]))
    const scheduleMap = new Map<string, ScheduleRow>((schedules ?? []).map((s: ScheduleRow) => [s.group_id, s]))
    const now = nowMinutes()

    // Build room_id → list of lesson events
    const roomEvents: Map<string, { teacherName: string; lessonType: string; start: number; end: number; startTime: string; endTime: string }[]> = new Map()

    for (const lesson of lessons) {
      const group = groupMap.get(lesson.group_id)
      const schedule = scheduleMap.get(lesson.group_id)
      if (!group || !schedule || !schedule.end_time) continue
      const roomId = teacherRoomMap.get(group.teacher_id)
      if (!roomId) continue
      const start = timeToMinutes(lesson.start_time)
      const end = timeToMinutes(schedule.end_time)
      if (!roomEvents.has(roomId)) roomEvents.set(roomId, [])
      roomEvents.get(roomId)!.push({
        teacherName: teacherMap.get(group.teacher_id) ?? 'מורה לא ידועה',
        lessonType: group.lesson_type,
        start,
        end,
        startTime: lesson.start_time.slice(0, 5),
        endTime: schedule.end_time.slice(0, 5),
      })
    }

    const newStatuses: RoomStatus[] = rooms.map(room => {
      const events = roomEvents.get(room.id) ?? []
      const current = events.find(e => now >= e.start && now < e.end)
      const next = events.filter(e => e.start > now).sort((a, b) => a.start - b.start)[0]
      return {
        room,
        teacherName: current?.teacherName ?? null,
        lessonType: current?.lessonType ?? null,
        startTime: current?.startTime ?? null,
        endTime: current?.endTime ?? null,
        isOccupied: !!current,
        nextLessonTime: next?.startTime ?? null,
      }
    })

    setStatuses(newStatuses)
    setLastUpdated(new Date())
  }, [rooms, assignments, teachers])

  useEffect(() => {
    fetchLiveData()
    const supabase = createClient()
    const today = todayStr()
    const channel = supabase
      .channel('live-rooms')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lessons',
        filter: `date=eq.${today}`,
      }, () => fetchLiveData())
      .subscribe()

    // Also refresh every minute for time-based status changes
    const timer = setInterval(fetchLiveData, 60_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [fetchLiveData])

  if (statuses.length === 0) {
    return <div className="text-sm text-gray-400 text-center py-8">טוען...</div>
  }

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {lastUpdated && (
        <p className="text-[10px] text-gray-400 text-left">
          עודכן {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      {statuses.map(s => (
        <div
          key={s.room.id}
          className={`rounded-2xl px-4 py-3 flex items-center justify-between ${
            s.isOccupied ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100'
          }`}
        >
          <div>
            <p className="font-bold text-sm text-gray-800">{s.room.name}</p>
            {s.isOccupied ? (
              <>
                <p className="text-xs text-emerald-700 font-semibold">{s.teacherName}</p>
                <p className="text-[10px] text-gray-400">{s.startTime} – {s.endTime}</p>
              </>
            ) : (
              <p className="text-xs text-gray-400">
                {s.nextLessonTime ? `שיעור הבא: ${s.nextLessonTime}` : 'פנוי כל היום'}
              </p>
            )}
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            s.isOccupied ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {s.isOccupied ? 'תפוס' : 'פנוי'}
          </span>
        </div>
      ))}
    </div>
  )
}
