'use client'

import { useState, useTransition, useMemo } from 'react'
import { createEvent, deleteEvent } from './calendarActions'
import type { SchoolEvent, SchoolEventType, Teacher } from '@/types/database'

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const DAYS_HE   = ['א','ב','ג','ד','ה','ו','ש']

const EVENT_CONFIG: Record<SchoolEventType, { label: string; bg: string; dot: string; text: string }> = {
  holiday:     { label: 'חג',         bg: 'bg-amber-100',  dot: 'bg-amber-400',  text: 'text-amber-700'  },
  vacation:    { label: 'חופשה',      bg: 'bg-blue-100',   dot: 'bg-blue-400',   text: 'text-blue-700'   },
  makeup_day:  { label: 'יום השלמה',  bg: 'bg-emerald-100',dot: 'bg-emerald-500',text: 'text-emerald-700'},
  school_start:{ label: 'פתיחת שנה', bg: 'bg-teal-100',   dot: 'bg-teal-500',   text: 'text-teal-700'   },
  school_end:  { label: 'סיום שנה',  bg: 'bg-violet-100', dot: 'bg-violet-500', text: 'text-violet-700' },
  concert:     { label: 'קונצרט',     bg: 'bg-pink-100',   dot: 'bg-pink-500',   text: 'text-pink-700'   },
}

function getSchoolYear() {
  const now = new Date()
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return year // school year starts Sep of `year`
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

interface Props {
  events: SchoolEvent[]
  teachers: Teacher[]
}

export default function CalendarClient({ events, teachers }: Props) {
  const schoolYear = getSchoolYear()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [eventType, setEventType] = useState<SchoolEventType>('holiday')
  const [eventName, setEventName] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isPending, startTransition] = useTransition()
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([])

  // Build a map: dateStr → event
  const eventMap = useMemo(() => {
    const m: Record<string, SchoolEvent> = {}
    for (const ev of events) {
      const start = new Date(ev.start_date + 'T12:00:00')
      const end   = new Date(ev.end_date   + 'T12:00:00')
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        m[toDateStr(d)] = ev
      }
    }
    return m
  }, [events])

  // School year: Sep–Aug (12 months)
  const months = useMemo(() => {
    const result = []
    for (let i = 0; i < 12; i++) {
      const monthIndex = (8 + i) % 12
      const year = i < 4 ? schoolYear : schoolYear + 1
      result.push({ monthIndex, year })
    }
    return result
  }, [schoolYear])

  function openAdd(dateStr: string) {
    setSelectedDate(dateStr)
    setEndDate(dateStr)
    setEventName('')
    setEventType('holiday')
    setSelectedTeacherIds([])
    setAddOpen(true)
  }

  function submitEvent(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('name', eventName || EVENT_CONFIG[eventType].label)
    fd.set('event_type', eventType)
    fd.set('start_date', selectedDate)
    fd.set('end_date', endDate || selectedDate)
    for (const tid of selectedTeacherIds) fd.append('teacher_ids', tid)
    startTransition(async () => {
      await createEvent(fd)
      setAddOpen(false)
      setSelectedTeacherIds([])
    })
  }

  const isAutoSync = eventType === 'holiday' || eventType === 'vacation'
  const allSelected = teachers.length > 0 && selectedTeacherIds.length === teachers.length

  return (
    <div className="px-4 py-5 flex flex-col gap-5">
      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(EVENT_CONFIG) as [SchoolEventType, typeof EVENT_CONFIG[SchoolEventType]][]).map(([type, cfg]) => (
          <span key={type} className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-xl ${cfg.bg} ${cfg.text}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        ))}
      </div>

      {/* Upcoming events list */}
      {events.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">אירועים</p>
          <div className="flex flex-col gap-2">
            {events.map(ev => {
              const cfg = EVENT_CONFIG[ev.event_type]
              const isSame = ev.start_date === ev.end_date
              return (
                <div key={ev.id} className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${cfg.bg}`}>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${cfg.text} truncate`}>{ev.name}</p>
                    <p className={`text-xs ${cfg.text} opacity-70`}>
                      {ev.start_date}{isSame ? '' : ` עד ${ev.end_date}`}
                    </p>
                  </div>
                  <button
                    onClick={() => startTransition(() => deleteEvent(ev.id))}
                    disabled={isPending}
                    className="w-7 h-7 rounded-lg bg-white/50 hover:bg-white/80 flex items-center justify-center transition-colors disabled:opacity-40 shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Monthly grids */}
      {months.map(({ monthIndex, year }) => {
        const firstDay = new Date(year, monthIndex, 1)
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
        // In Israel week starts Sunday (0). getDay() returns 0=Sun
        const startPad = firstDay.getDay()

        return (
          <div key={`${year}-${monthIndex}`} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-bold text-gray-800">{MONTHS_HE[monthIndex]} {year}</p>
            </div>
            <div className="p-3">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_HE.map(d => (
                  <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${year}-${String(monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const ev = eventMap[dateStr]
                  const dow = new Date(year, monthIndex, day).getDay()
                  const isWeekend = dow === 5 || dow === 6
                  const isToday = dateStr === toDateStr(new Date())

                  let cellClass = 'text-gray-700 hover:bg-gray-50'
                  if (isWeekend) cellClass = 'text-gray-300'
                  if (ev) cellClass = `${EVENT_CONFIG[ev.event_type].bg} ${EVENT_CONFIG[ev.event_type].text} font-bold`
                  if (isToday && !ev) cellClass += ' ring-2 ring-teal-400 ring-inset rounded-lg'

                  return (
                    <button
                      key={day}
                      onClick={() => !isWeekend && openAdd(dateStr)}
                      disabled={isWeekend}
                      className={`aspect-square flex items-center justify-center text-xs rounded-lg transition-colors ${cellClass} disabled:cursor-default`}
                      title={ev?.name}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}

      {/* Add event bottom sheet */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setAddOpen(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">הוספת אירוע</h2>
            <p className="text-sm text-gray-400 mb-4">{selectedDate}</p>

            <form onSubmit={submitEvent} className="flex flex-col gap-4">
              {/* Event type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">סוג אירוע</label>
                <div className="flex flex-col gap-2">
                  {(Object.entries(EVENT_CONFIG) as [SchoolEventType, typeof EVENT_CONFIG[SchoolEventType]][]).map(([type, cfg]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEventType(type)}
                      className={`w-full px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-colors text-right flex items-center gap-2 ${
                        eventType === type ? `border-current ${cfg.bg} ${cfg.text}` : 'border-gray-100 bg-gray-50 text-gray-600'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${eventType === type ? cfg.dot : 'bg-gray-300'}`} />
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">שם (אופציונלי)</label>
                <input
                  value={eventName}
                  onChange={e => setEventName(e.target.value)}
                  placeholder={EVENT_CONFIG[eventType].label}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
                />
              </div>

              {/* End date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">תאריך סיום (לטווח)</label>
                <input
                  type="date"
                  value={endDate}
                  min={selectedDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
                  dir="ltr"
                />
              </div>

              {/* Teacher sync */}
              {isAutoSync ? (
                <div className="bg-amber-50 rounded-xl px-4 py-3 text-xs text-amber-700 font-semibold">
                  חגים וחופשות מסונכרנים אוטומטית עם כל המורות
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700">סנכרן עם מורות</label>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTeacherIds(
                          allSelected ? [] : teachers.map(t => t.id)
                        )
                      }
                      className="text-xs font-bold text-teal-500"
                    >
                      {allSelected ? 'בטל הכל' : 'בחר הכל'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 rounded-2xl border border-gray-100 overflow-hidden">
                    {teachers.map(t => {
                      const checked = selectedTeacherIds.includes(t.id)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            setSelectedTeacherIds(prev =>
                              checked ? prev.filter(id => id !== t.id) : [...prev, t.id]
                            )
                          }
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-right border-b border-gray-50 last:border-0"
                        >
                          <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {t.name.charAt(0)}
                          </div>
                          <span className="flex-1 text-sm font-semibold text-gray-700">{t.name}</span>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? 'bg-teal-500 border-teal-500' : 'border-gray-300'}`}>
                            {checked && (
                              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="2 6 5 9 10 3"/>
                              </svg>
                            )}
                          </div>
                        </button>
                      )
                    })}
                    {teachers.length === 0 && (
                      <p className="px-4 py-3 text-xs text-gray-400">אין מורות רשומות</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-teal-500 text-white font-bold py-3 rounded-2xl hover:bg-teal-600 transition-colors disabled:opacity-60 text-sm"
                >
                  {isPending ? 'שומר...' : 'הוסף אירוע'}
                </button>
                <button type="button" onClick={() => setAddOpen(false)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl text-sm">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
