'use client'

import { useState, useMemo } from 'react'
import LessonCard from './LessonCard'
import { formatDateHe } from '@/lib/utils/hebrew'
import type { LessonSlot } from '@/types/database'

interface Props {
  allSlots: LessonSlot[]
  initialDate?: Date
}

export default function DayView({ allSlots, initialDate }: Props) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = initialDate ? new Date(initialDate) : new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const daySlots = useMemo(() => {
    return allSlots
      .filter(s => s.date.toDateString() === selectedDate.toDateString())
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [allSlots, selectedDate])

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
          onClick={() => changeDay(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white shadow-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <span className="text-sm font-bold text-gray-700">{formatDateHe(selectedDate)}</span>
        <button
          onClick={() => changeDay(1)}
          className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white shadow-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Next pill */}
      {nextSlotIndex >= 0 && selectedDate.toDateString() === new Date().toDateString() && (
        <div className="inline-flex items-center gap-1.5 bg-teal-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-full self-start shadow-sm shadow-teal-200">
          <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
          הבא — {daySlots[nextSlotIndex].startTime}
        </div>
      )}

      {daySlots.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          אין שיעורים ביום זה
        </div>
      ) : (
        daySlots.map((slot, i) => (
          <LessonCard
            key={`${slot.groupId}-${slot.date.toDateString()}-${slot.startTime}`}
            slot={slot}
            isNext={i === nextSlotIndex && selectedDate.toDateString() === new Date().toDateString()}
          />
        ))
      )}
    </div>
  )
}
