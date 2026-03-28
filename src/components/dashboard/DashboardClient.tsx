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
    return getLessonSlotsForWeek(groups, getWeekStart())
  }, [groups])

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-500 to-purple-600 text-white">
        <div className="px-4 pt-5 pb-0 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">שלום, {teacherName} 👋</h1>
            <p className="text-sm opacity-80 mt-0.5">
              {groups.length > 0
                ? `${groups.length} קבוצות פעילות`
                : 'אין קבוצות עדיין'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg">
            🎵
          </div>
        </div>

        {/* View toggle tabs */}
        <div className="flex mt-3 bg-white/15 rounded-t-xl overflow-hidden mx-2">
          <button
            onClick={() => setView('day')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
              view === 'day'
                ? 'bg-white text-indigo-600 rounded-tl-xl'
                : 'text-white/70 hover:text-white'
            }`}
          >
            📅 יום
          </button>
          <button
            onClick={() => setView('week')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
              view === 'week'
                ? 'bg-white text-indigo-600 rounded-tr-xl'
                : 'text-white/70 hover:text-white'
            }`}
          >
            🗓 שבוע
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 pb-24 overflow-y-auto">
        {view === 'day'
          ? <DayView allSlots={weekSlots} />
          : <WeekView allSlots={weekSlots} />
        }
      </div>

      <BottomNav />
    </div>
  )
}
