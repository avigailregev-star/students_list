'use client'

import { useEffect, useState, useMemo } from 'react'
import DayView from './DayView'
import WeekView from './WeekView'
import MonthView from './MonthView'
import BottomNav from '@/components/layout/BottomNav'
import { getLessonSlotsForWeek, getWeekStart, mergeScheduledAndRecordedSlots, SCHOOL_YEAR_END, SCHOOL_YEAR_START } from '@/lib/utils/schedule'
import type { GroupWithSchedules, LessonSlot, SchoolEvent } from '@/types/database'
import logo from '@/app/icon.png'

const SELECTED_DATE_KEY = 'dashboard-selected-date'

function parseSelectedDate(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function dateParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface Props {
  groups: GroupWithSchedules[]
  teacherName: string
  events: SchoolEvent[]
  isAdmin?: boolean
  recordedSlots: LessonSlot[]
  userId?: string
  viewOnly?: boolean
  viewOnlyTeacherId?: string
  initialDate?: string
}

export default function DashboardClient({ groups, teacherName, events, isAdmin, recordedSlots, userId, viewOnly, viewOnlyTeacherId, initialDate }: Props) {
  const [view, setView] = useState<'day' | 'week' | 'month'>('day')
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    return parseSelectedDate(initialDate) ?? new Date()
  })

  useEffect(() => {
    if (viewOnly) return
    const requestedDate = parseSelectedDate(initialDate)
    if (requestedDate) {
      sessionStorage.setItem(SELECTED_DATE_KEY, dateParam(requestedDate))
      return
    }

    const savedDate = parseSelectedDate(sessionStorage.getItem(SELECTED_DATE_KEY))
    if (!savedDate) return
    window.history.replaceState(null, '', `/?date=${dateParam(savedDate)}`)
    const frame = window.requestAnimationFrame(() => setSelectedDate(savedDate))
    return () => window.cancelAnimationFrame(frame)
  }, [initialDate, viewOnly])

  const calendarSlots: LessonSlot[] = useMemo(() => {
    const slots: LessonSlot[] = []
    const firstWeek = getWeekStart(SCHOOL_YEAR_START)
    const lastWeek = getWeekStart(SCHOOL_YEAR_END)
    for (let weekStart = new Date(firstWeek); weekStart <= lastWeek; weekStart.setDate(weekStart.getDate() + 7)) {
      slots.push(...getLessonSlotsForWeek(groups, weekStart))
    }
    return mergeScheduledAndRecordedSlots(slots, recordedSlots)
  }, [groups, recordedSlots])

  function handleDateChange(date: Date) {
    setSelectedDate(date)

    // Keep the date in the URL so returning from attendance (including via
    // browser back or the home icon) restores the same day.
    if (!viewOnly) {
      const dateStr = dateParam(date)
      sessionStorage.setItem(SELECTED_DATE_KEY, dateStr)
      window.history.replaceState(null, '', `/?date=${dateStr}`)
    }
  }

  function handleMonthDayClick(date: Date) {
    handleDateChange(date)
    setView('day')
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200">
        <div className="px-5 pt-8 pb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest mb-1">לוח שיעורים</p>
            <h1 className="text-2xl font-bold">שלום, {teacherName}</h1>
            <p className="text-sm text-teal-100 mt-0.5">
              {groups.length > 0 ? `${groups.length} קבוצות פעילות` : 'אין קבוצות עדיין'}
            </p>
          </div>
          <div
            className="w-14 h-14 shrink-0 rounded-[22%]"
            style={{backgroundImage:`url(${logo.src})`,backgroundSize:'contain',backgroundPosition:'center',backgroundRepeat:'no-repeat'}}
          />
        </div>

        {/* View toggle */}
        <div className="flex mx-5 mb-5 bg-white/20 rounded-2xl p-1 gap-1">
          {(['day', 'week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                view === v ? 'bg-white text-teal-600 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              {v === 'day' ? 'יום' : v === 'week' ? 'שבוע' : 'חודש'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 pb-28 overflow-y-auto">
        {view === 'day' && <DayView allSlots={calendarSlots} selectedDate={selectedDate} onDateChange={handleDateChange} events={events} viewOnly={viewOnly} viewOnlyTeacherId={viewOnlyTeacherId} />}
        {view === 'week' && <WeekView allSlots={calendarSlots} events={events} viewOnly={viewOnly} viewOnlyTeacherId={viewOnlyTeacherId} />}
        {view === 'month' && (
          <MonthView
            allSlots={calendarSlots}
            events={events}
            onDayClick={handleMonthDayClick}
          />
        )}
      </div>

      {!viewOnly && <BottomNav isAdmin={isAdmin} userId={userId} />}
    </div>
  )
}
