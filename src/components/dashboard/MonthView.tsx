'use client'

import { useState, useMemo } from 'react'
import { getLessonSlotsForMonth } from '@/lib/utils/schedule'
import type { GroupWithSchedules, SchoolEvent, SchoolEventType } from '@/types/database'

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const DAYS_HE   = ['א','ב','ג','ד','ה','ו','ש']

const EVENT_COLORS: Record<SchoolEventType, { bg: string; text: string; label: string }> = {
  holiday:      { bg: 'bg-amber-100',   text: 'text-amber-800',   label: 'חג'         },
  vacation:     { bg: 'bg-blue-100',    text: 'text-blue-800',    label: 'חופשה'      },
  concert:      { bg: 'bg-pink-100',    text: 'text-pink-800',    label: 'קונצרט'     },
  makeup_day:   { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'השלמה'      },
  school_start: { bg: 'bg-teal-100',    text: 'text-teal-800',    label: 'פתיחת שנה' },
  school_end:   { bg: 'bg-violet-100',  text: 'text-violet-800',  label: 'סיום שנה'  },
}

const DOT_COLORS = [
  'bg-teal-400', 'bg-indigo-400', 'bg-rose-400', 'bg-amber-400',
  'bg-purple-400', 'bg-cyan-400', 'bg-orange-400',
]

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

interface Props {
  groups: GroupWithSchedules[]
  events: SchoolEvent[]
  onDayClick: (date: Date) => void
}

export default function MonthView({ groups, events, onDayClick }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // Map dateStr → SchoolEvent (first event wins if overlap)
  const eventMap = useMemo(() => {
    const m: Record<string, SchoolEvent> = {}
    for (const ev of events) {
      const start = new Date(ev.start_date + 'T12:00:00')
      const end   = new Date(ev.end_date   + 'T12:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = toDateStr(d)
        if (!m[key]) m[key] = ev
      }
    }
    return m
  }, [events])

  // Map dateStr → groupIds with lessons
  const lessonMap = useMemo(() => {
    const slots = getLessonSlotsForMonth(groups, year, month)
    const sets: Record<string, Set<string>> = {}
    for (const slot of slots) {
      const key = toDateStr(slot.date)
      if (!sets[key]) sets[key] = new Set()
      sets[key].add(slot.groupId)
    }
    const m: Record<string, string[]> = {}
    for (const [key, set] of Object.entries(sets)) m[key] = Array.from(set)
    return m
  }, [groups, year, month])

  // Stable color index per groupId
  const groupColorIndex = useMemo(() => {
    const idx: Record<string, number> = {}
    groups.forEach((g, i) => { idx[g.id] = i % DOT_COLORS.length })
    return idx
  }, [groups])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow    = new Date(year, month, 1).getDay()  // 0=Sun
  const todayStr    = toDateStr(today)

  return (
    <div className="flex flex-col gap-0">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-1 mb-3">
        <button
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white shadow-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <span className="text-sm font-bold text-gray-700">{MONTHS_HE[month]} {year}</span>
        <button
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white shadow-sm text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_HE.map(d => (
          <div key={d} className={`text-center text-[10px] font-bold py-1 ${d === 'ו' || d === 'ש' ? 'text-gray-300' : 'text-gray-400'}`}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day     = i + 1
          const dow     = new Date(year, month, day).getDay()
          const dateStr = toDateStr(new Date(year, month, day))
          const ev      = eventMap[dateStr]
          const groupIds = lessonMap[dateStr] ?? []
          const isWeekend = dow === 5 || dow === 6
          const isToday   = dateStr === todayStr
          const cfg       = ev ? EVENT_COLORS[ev.event_type] : null
          // Shows label on the event's start_date. If start_date is a weekend the label
          // won't appear — acceptable since weekend cells are blank anyway.
          const isFirstOfEvent = ev && ev.start_date === dateStr

          return (
            <button
              key={day}
              disabled={isWeekend}
              onClick={() => onDayClick(new Date(year, month, day))}
              className={[
                'rounded-xl min-h-[52px] p-1 flex flex-col transition-colors disabled:cursor-default',
                isWeekend ? 'bg-transparent' : '',
                ev && cfg ? `${cfg.bg}` : 'bg-gray-50 hover:bg-teal-50',
                isToday && !ev ? 'ring-2 ring-teal-400 ring-inset' : '',
              ].join(' ')}
            >
              <span className={[
                'text-[11px] font-bold leading-none mb-1',
                isWeekend ? 'text-gray-300' : '',
                ev && cfg ? cfg.text : 'text-gray-700',
                isToday && !ev ? 'text-teal-600' : '',
              ].join(' ')}>
                {day}
              </span>

              {/* Event label on first day of range */}
              {isFirstOfEvent && cfg && (
                <span className={`text-[7px] font-bold leading-tight ${cfg.text}`}>
                  {cfg.label}
                </span>
              )}

              {/* Lesson dots — only on non-event days */}
              {!ev && groupIds.length > 0 && (
                <div className="flex gap-0.5 mt-auto flex-wrap">
                  {groupIds.map(gid => (
                    <span
                      key={gid}
                      className={`h-[5px] rounded-sm flex-1 min-w-[6px] ${DOT_COLORS[groupColorIndex[gid] ?? 0]}`}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-4">
        {(Object.entries(EVENT_COLORS) as [SchoolEventType, typeof EVENT_COLORS[SchoolEventType]][])
          .filter(([type]) => events.some(e => e.event_type === type))
          .map(([type, cfg]) => (
            <span key={type} className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-xl ${cfg.bg} ${cfg.text}`}>
              {cfg.label}
            </span>
          ))}
        {groups.length > 0 && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-xl bg-gray-100 text-gray-600">
            ● שיעור
          </span>
        )}
      </div>
    </div>
  )
}
