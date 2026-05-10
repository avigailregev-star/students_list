'use client'

import { useMemo } from 'react'
import LessonCard from './LessonCard'
import { DAYS_HE } from '@/lib/utils/hebrew'
import { EVENT_COLORS, getActiveEvents } from '@/lib/utils/eventColors'
import type { LessonSlot, SchoolEvent } from '@/types/database'

interface Props {
  allSlots: LessonSlot[]
  events: SchoolEvent[]
}

const WORK_DAYS = [0, 1, 2, 3, 4]

export default function WeekView({ allSlots, events }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const byDay = useMemo(() => {
    const map = new Map<number, LessonSlot[]>()
    for (const slot of allSlots) {
      if (slot.date < weekStart || slot.date > weekEnd) continue
      const arr = map.get(slot.dayOfWeek) ?? []
      arr.push(slot)
      map.set(slot.dayOfWeek, arr)
    }
    for (const [key, arr] of map) {
      map.set(key, arr.sort((a, b) => a.startTime.localeCompare(b.startTime)))
    }
    return map
  }, [allSlots])

  return (
    <div className="flex flex-col gap-5">
      {WORK_DAYS.map(day => {
        const slots = byDay.get(day) ?? []
        const dayDate = new Date(weekStart)
        dayDate.setDate(weekStart.getDate() + day)
        const dayEvents = getActiveEvents(events, dayDate)
        if (slots.length === 0 && dayEvents.length === 0) return null
        const isToday = today.getDay() === day
        return (
          <div key={day}>
            <div className="flex items-center gap-2 mb-2.5">
              <span className={`text-xs font-bold tracking-widest uppercase ${
                isToday ? 'text-teal-500' : 'text-gray-400'
              }`}>
                {DAYS_HE[day]}
              </span>
              {isToday && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />}
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="flex flex-col gap-2">
              {dayEvents.map(ev => {
                const cfg = EVENT_COLORS[ev.event_type]
                return (
                  <div key={ev.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border-r-4 ${cfg.bg} ${cfg.border}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
                    <span className={`text-xs font-bold ${cfg.text}`}>{ev.name}</span>
                  </div>
                )
              })}
              {slots.map(slot => (
                <LessonCard
                  key={`${slot.groupId}-${slot.startTime}`}
                  slot={slot}
                />
              ))}
            </div>
          </div>
        )
      })}
      {allSlots.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          אין שיעורים השבוע
        </div>
      )}
    </div>
  )
}
