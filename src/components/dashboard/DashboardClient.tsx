'use client'

import { useState, useMemo } from 'react'
import DayView from './DayView'
import WeekView from './WeekView'
import BottomNav from '@/components/layout/BottomNav'
import { getLessonSlotsForWeek, getWeekStart } from '@/lib/utils/schedule'
import type { GroupWithSchedules, LessonSlot } from '@/types/database'

interface Props {
  groups: GroupWithSchedules[]
  teacherName: string
}

export default function DashboardClient({ groups, teacherName }: Props) {
  const [view, setView] = useState<'day' | 'week'>('day')

  const weekSlots: LessonSlot[] = useMemo(() => {
    const slots: LessonSlot[] = []
    // Generate slots for 8 weeks: 2 past + current + 5 future
    for (let i = -2; i <= 5; i++) {
      const weekStart = getWeekStart()
      weekStart.setDate(weekStart.getDate() + i * 7)
      slots.push(...getLessonSlotsForWeek(groups, weekStart))
    }
    // Deduplicate: same group on same date (safety guard)
    const seen = new Set<string>()
    return slots.filter(s => {
      const key = `${s.groupId}-${s.date.toDateString()}-${s.startTime}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [groups])

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200">
        <div className="px-5 pt-8 pb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest mb-1">לוח שיעורים</p>
            <h1 className="text-2xl font-bold">שלום, {teacherName}</h1>
            <p className="text-sm text-teal-100 mt-0.5">
              {groups.length > 0
                ? `${groups.length} קבוצות פעילות`
                : 'אין קבוצות עדיין'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex mx-5 mb-5 bg-white/20 rounded-2xl p-1 gap-1">
          <button
            onClick={() => setView('day')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
              view === 'day'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-white/80 hover:text-white'
            }`}
          >
            יום
          </button>
          <button
            onClick={() => setView('week')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
              view === 'week'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-white/80 hover:text-white'
            }`}
          >
            שבוע
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-5 pb-28 overflow-y-auto">
        {view === 'day'
          ? <DayView allSlots={weekSlots} />
          : <WeekView allSlots={weekSlots} />
        }
      </div>

      <BottomNav />
    </div>
  )
}
