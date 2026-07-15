'use client'

import { useMemo, useState } from 'react'
import LessonCard from './LessonCard'
import { DAYS_HE, MONTHS_HE } from '@/lib/utils/hebrew'
import { EVENT_COLORS, getActiveEvents, cancelsLessons } from '@/lib/utils/eventColors'
import { getWeekStart } from '@/lib/utils/schedule'
import type { LessonSlot, SchoolEvent } from '@/types/database'

interface Props {
  allSlots: LessonSlot[]
  events: SchoolEvent[]
  viewOnly?: boolean
}

const WORK_DAYS = [0, 1, 2, 3, 4]

function formatWeekRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth()
  const startLabel = sameMonth ? `${start.getDate()}` : `${start.getDate()} ${MONTHS_HE[start.getMonth()]}`
  const endLabel = `${end.getDate()} ${MONTHS_HE[end.getMonth()]}`
  return `${startLabel} – ${endLabel}`
}

export default function WeekView({ allSlots, events, viewOnly }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getWeekStart(today))

  const weekStart = selectedWeekStart
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const lastWorkDay = new Date(weekStart)
  lastWorkDay.setDate(weekStart.getDate() + WORK_DAYS[WORK_DAYS.length - 1])

  function changeWeek(delta: number) {
    const d = new Date(selectedWeekStart)
    d.setDate(d.getDate() + delta * 7)
    setSelectedWeekStart(d)
  }

  const isCurrentWeek = weekStart.getTime() === getWeekStart(today).getTime()
  const weekStartTime = weekStart.getTime()
  const weekEndTime = weekEnd.getTime()

  const byDay = useMemo(() => {
    const map = new Map<number, LessonSlot[]>()
    for (const slot of allSlots) {
      const t = slot.date.getTime()
      if (t < weekStartTime || t > weekEndTime) continue
      const arr = map.get(slot.dayOfWeek) ?? []
      arr.push(slot)
      map.set(slot.dayOfWeek, arr)
    }
    for (const [key, arr] of map) {
      map.set(key, arr.sort((a, b) => a.startTime.localeCompare(b.startTime)))
    }
    return map
  }, [allSlots, weekStartTime, weekEndTime])

  const weekHasContent = WORK_DAYS.some(day => {
    if ((byDay.get(day) ?? []).length > 0) return true
    const dayDate = new Date(weekStart)
    dayDate.setDate(weekStart.getDate() + day)
    return getActiveEvents(events, dayDate).length > 0
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Week navigator */}
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => changeWeek(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white shadow-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <span className="text-sm font-bold text-gray-700">
          {isCurrentWeek ? 'השבוע' : formatWeekRange(weekStart, lastWorkDay)}
        </span>
        <button
          onClick={() => changeWeek(1)}
          className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white shadow-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {WORK_DAYS.map(day => {
        const slots = byDay.get(day) ?? []
        const dayDate = new Date(weekStart)
        dayDate.setDate(weekStart.getDate() + day)
        const dayEvents = getActiveEvents(events, dayDate)
        if (slots.length === 0 && dayEvents.length === 0) return null
        // Only holiday/vacation events cancel lessons — other event types are informational.
        const visibleSlots = cancelsLessons(dayEvents) ? [] : slots
        const isToday = isCurrentWeek && today.getDay() === day
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
              {visibleSlots.map(slot => (
                <LessonCard
                  key={`${slot.groupId}-${slot.startTime}`}
                  slot={slot}
                  viewOnly={viewOnly}
                />
              ))}
            </div>
          </div>
        )
      })}
      {!weekHasContent && (
        <div className="text-center py-16 text-gray-400 text-sm">
          אין שיעורים השבוע
        </div>
      )}
    </div>
  )
}
