'use client'

import { useMemo } from 'react'
import LessonCard from './LessonCard'
import { DAYS_HE } from '@/lib/utils/hebrew'
import type { LessonSlot } from '@/types/database'

interface Props {
  allSlots: LessonSlot[]
}

const WORK_DAYS = [0, 1, 2, 3, 4]

export default function WeekView({ allSlots }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Compute current week boundaries (Sun–Sat)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const byDay = useMemo(() => {
    const map = new Map<number, LessonSlot[]>()
    for (const slot of allSlots) {
      // Only include slots that fall within the current week
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
        if (slots.length === 0) return null
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
