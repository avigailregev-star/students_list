'use client'

import { useState, useMemo } from 'react'
import LessonCard from './LessonCard'
import { formatDateHe } from '@/lib/utils/hebrew'
import { EVENT_COLORS, getActiveEvents } from '@/lib/utils/eventColors'
import type { LessonSlot, SchoolEvent } from '@/types/database'

interface Props {
  allSlots: LessonSlot[]
  /** Only read at mount. Safe because the component is conditionally rendered and remounts on each tab switch. */
  initialDate?: Date
  events: SchoolEvent[]
  viewOnly?: boolean
}

export default function DayView({ allSlots, initialDate, events, viewOnly }: Props) {
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

  const activeEvents = useMemo(() => getActiveEvents(events, selectedDate), [events, selectedDate])

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

      {/* Event banners */}
      {activeEvents.map(ev => {
        const cfg = EVENT_COLORS[ev.event_type]
        const start = ev.start_date.replace(/-/g, '')
        const endD = new Date(ev.end_date + 'T12:00:00Z')
        endD.setUTCDate(endD.getUTCDate() + 1)
        const end = endD.toISOString().slice(0, 10).replace(/-/g, '')
        const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.name)}&dates=${start}/${end}`
        return (
          <div key={ev.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-r-4 ${cfg.bg} ${cfg.border}`}>
            <span className={`text-[11px] font-bold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
            <span className={`flex-1 text-sm font-bold ${cfg.text}`}>{ev.name}</span>
            <a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="הוסף ליומן גוגל"
              className={`shrink-0 opacity-60 hover:opacity-100 transition-opacity ${cfg.text}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </a>
          </div>
        )
      })}

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
        <div className="flex flex-col gap-2">
          {daySlots.map((slot, i) => {
            const isNext = i === nextSlotIndex && selectedDate.toDateString() === new Date().toDateString()
            return (
              <div key={`${slot.groupId}-${slot.date.toDateString()}-${slot.startTime}`} className="flex items-center gap-3">
                <div className="w-14 shrink-0 flex flex-col items-center gap-1">
                  <span className={`text-sm font-bold tabular-nums ${isNext ? 'text-teal-500' : 'text-gray-400'}`}>
                    {slot.startTime}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full ${isNext ? 'bg-teal-400' : 'bg-gray-200'}`} />
                </div>
                <div className="flex-1">
                  <LessonCard slot={slot} isNext={isNext} hideTime viewOnly={viewOnly} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
