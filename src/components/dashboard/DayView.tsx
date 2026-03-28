'use client'

import { useState, useMemo } from 'react'
import LessonCard from './LessonCard'
import { formatDateHe } from '@/lib/utils/hebrew'
import type { LessonSlot } from '@/types/database'

interface Props {
  allSlots: LessonSlot[]
}

export default function DayView({ allSlots }: Props) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const daySlots = useMemo(() => {
    return allSlots
      .filter(s => s.date.toDateString() === selectedDate.toDateString())
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [allSlots, selectedDate])

  // Find next upcoming slot today
  const now = new Date()
  const nextSlotIndex = daySlots.findIndex(s => {
    const [h, m] = s.startTime.split(':').map(Number)
    const slotTime = new Date(selectedDate)
    slotTime.setHours(h, m, 0, 0)
    return slotTime >= now
  })

  function changeDay(delta: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + delta)
    setSelectedDate(d)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Day navigator */}
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => changeDay(1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-indigo-100 text-gray-600 text-sm"
        >›</button>
        <span className="text-sm font-bold text-gray-800">{formatDateHe(selectedDate)}</span>
        <button
          onClick={() => changeDay(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-indigo-100 text-gray-600 text-sm"
        >‹</button>
      </div>

      {/* Next pill */}
      {nextSlotIndex >= 0 && selectedDate.toDateString() === new Date().toDateString() && (
        <div className="inline-flex items-center gap-1 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full self-start">
          ⚡ הבא — {daySlots[nextSlotIndex].startTime}
        </div>
      )}

      {daySlots.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          אין שיעורים ביום זה
        </div>
      ) : (
        daySlots.map((slot, i) => (
          <LessonCard
            key={`${slot.groupId}-${slot.startTime}`}
            slot={slot}
            isNext={i === nextSlotIndex && selectedDate.toDateString() === new Date().toDateString()}
          />
        ))
      )}
    </div>
  )
}
