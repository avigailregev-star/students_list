'use client'

import { useState, useTransition } from 'react'
import type { GroupWithSchedulesAndStudents, TeacherAvailabilityRange } from '@/types/database'
import { LESSON_TYPE_CONFIG } from '@/lib/utils/lessonTypes'
import { DAYS_HE } from '@/lib/utils/hebrew'
import { deleteGroup } from './groupActions'
import AdminGroupSheet from './AdminGroupSheet'

interface Props {
  teacherId: string
  groups: GroupWithSchedulesAndStudents[]
  ranges: TeacherAvailabilityRange[]
  completedLessons: number
  canceledLessons: number
}

export default function AdminTeacherTabs({ teacherId, groups, ranges, completedLessons, canceledLessons }: Props) {
  const [activeTab, setActiveTab] = useState<'groups' | 'availability' | 'stats'>('groups')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupWithSchedulesAndStudents | undefined>()
  const [isPending, startTransition] = useTransition()
  const [sheetDefaults, setSheetDefaults] = useState<{ dayOfWeek?: number; startTime?: string }>({})

  function openCreate(defaults?: { dayOfWeek?: number; startTime?: string }) {
    setEditingGroup(undefined)
    setSheetDefaults(defaults ?? {})
    setSheetOpen(true)
  }

  function openEdit(group: GroupWithSchedulesAndStudents) {
    setEditingGroup(group)
    setSheetDefaults({})
    setSheetOpen(true)
  }

  function handleDelete(groupId: string) {
    if (!confirm('למחוק את הקבוצה? הפעולה אינה הפיכה.')) return
    startTransition(async () => {
      const res = await deleteGroup(groupId, teacherId)
      if (res.error) alert(res.error)
    })
  }

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-2 bg-gray-100 rounded-2xl p-1">
        {(['groups', 'availability', 'stats'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
            }`}
          >
            {tab === 'groups' ? 'קבוצות' : tab === 'availability' ? 'זמינות' : 'סטטיסטיקות'}
          </button>
        ))}
      </div>

      {/* Groups tab */}
      {activeTab === 'groups' && (
        <div className="flex flex-col gap-2">
          {groups.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">אין קבוצות עדיין</p>
          )}
          {groups.map(g => {
            const cfg = LESSON_TYPE_CONFIG[g.lesson_type]
            const schedule = g.group_schedules?.[0]
            return (
              <div key={g.id} onClick={() => openEdit(g)} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer active:bg-gray-50">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${cfg?.bg ?? 'bg-gray-400'}`}>
                  {g.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{g.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cfg?.label ?? g.lesson_type}
                    {schedule && ` · ${DAYS_HE[schedule.day_of_week]} ${schedule.start_time.slice(0, 5)}`}
                    {` · ${g.students?.length ?? 0} תלמידים`}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); openEdit(g) }}
                  aria-label="ערוך קבוצה"
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-teal-50 flex items-center justify-center text-gray-500 hover:text-teal-600 shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(g.id) }}
                  disabled={isPending}
                  aria-label="מחק קבוצה"
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 shrink-0 disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            )
          })}
          <button onClick={() => openCreate()} className="w-full py-3 border-2 border-dashed border-teal-300 text-teal-600 font-bold text-sm rounded-2xl hover:border-teal-400 hover:bg-teal-50 transition-colors">
            + הוסף קבוצה
          </button>
        </div>
      )}

      {/* Availability tab */}
      {activeTab === 'availability' && (
        <div className="flex flex-col gap-3">
          {ranges.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">המורה לא הגדיר טווחי זמינות עדיין.</p>
          )}
          {ranges.map(range => {
            const matched = groups.filter(g => {
              const sched = g.group_schedules?.[0]
              if (!sched) return false
              return (
                sched.day_of_week === range.day_of_week &&
                sched.start_time >= range.start_time &&
                sched.start_time < range.end_time
              )
            })
            return (
              <div key={range.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex justify-between items-center px-4 py-3 bg-green-50 border-b border-green-100">
                  <div>
                    <span className="text-sm font-bold text-green-900">{DAYS_HE[range.day_of_week]}</span>
                    <span className="text-xs text-green-700 ml-2">{range.start_time.slice(0, 5)} – {range.end_time.slice(0, 5)}</span>
                  </div>
                  <button
                    onClick={() => openCreate({ dayOfWeek: range.day_of_week, startTime: range.start_time.slice(0, 5) })}
                    className="bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-teal-600 transition-colors"
                  >
                    + שבץ שיעור
                  </button>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  {matched.length === 0 && (
                    <p className="text-xs text-gray-400 italic">אין שיעורים משובצים בטווח זה</p>
                  )}
                  {matched.map(g => {
                    const cfg = LESSON_TYPE_CONFIG[g.lesson_type]
                    const sched = g.group_schedules[0]
                    return (
                      <div key={g.id} className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg?.bg ?? 'bg-gray-400'}`} />
                        <span className="text-sm font-semibold text-gray-800">{g.name}</span>
                        <span className="text-xs text-gray-400">
                          {sched.start_time.slice(0, 5)}{sched.end_time ? `–${sched.end_time.slice(0, 5)}` : ''} · {g.students?.length ?? 0} תלמידים
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Stats tab */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'שיעורים שהושלמו', value: completedLessons, color: 'text-emerald-500' },
            { label: 'ביטולים', value: canceledLessons, color: 'text-red-400' },
            { label: 'סה״כ קבוצות', value: groups.length, color: 'text-teal-600' },
            { label: 'סה״כ תלמידים', value: groups.reduce((sum, g) => sum + (g.students?.length ?? 0), 0), color: 'text-violet-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl shadow-sm py-4 px-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <AdminGroupSheet
        key={editingGroup?.id ?? 'new'}
        teacherId={teacherId}
        group={editingGroup}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        defaultDayOfWeek={sheetDefaults.dayOfWeek}
        defaultStartTime={sheetDefaults.startTime}
      />
    </>
  )
}
