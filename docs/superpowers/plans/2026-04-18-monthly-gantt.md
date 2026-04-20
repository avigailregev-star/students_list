# Monthly Gantt View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "חודש" tab to the teacher dashboard showing a monthly calendar with lesson dots and admin-synced school events filling full cells; admin gains a teacher-assignment picker when creating non-holiday events.

**Architecture:** New `MonthView` component consumes existing `LessonSlot[]` + new `SchoolEvent[]` prop; a new `school_event_assignments` junction table controls which teachers see non-holiday events; admin's event creation form gains a teacher picker that writes to that table.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase JS v2, Tailwind CSS v4, TypeScript

---

## File Map

| File | Action | Purpose |
|---|---|---|
| Supabase dashboard SQL | Run migration | Create `school_event_assignments` table |
| `src/lib/utils/schedule.ts` | Modify | Add `getLessonSlotsForMonth` |
| `src/lib/queries/events.ts` | Create | `getEventsForTeacher` query |
| `src/lib/queries/teachers.ts` | Create | `getTeachersForAdmin` query |
| `src/components/dashboard/MonthView.tsx` | Create | Monthly calendar grid component |
| `src/components/dashboard/DayView.tsx` | Modify | Accept optional `initialDate` prop |
| `src/components/dashboard/DashboardClient.tsx` | Modify | Add month tab, events prop, selected date |
| `src/app/page.tsx` | Modify | Fetch events, pass to DashboardClient |
| `src/app/admin/calendar/calendarActions.ts` | Modify | Handle teacher assignments on createEvent |
| `src/app/admin/calendar/CalendarClient.tsx` | Modify | Add teacher picker UI |
| `src/app/admin/calendar/page.tsx` | Modify | Fetch teachers, pass to CalendarClient |

---

## Task 1: DB Migration

**Files:**
- Run in: Supabase SQL Editor

- [ ] **Step 1: Run migration SQL**

Go to Supabase dashboard → SQL Editor → New query. Paste and run:

```sql
CREATE TABLE school_event_assignments (
  event_id   uuid NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id)      ON DELETE CASCADE,
  PRIMARY KEY (event_id, teacher_id)
);

-- Allow teachers to read their own assignments
ALTER TABLE school_event_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers can read own assignments"
  ON school_event_assignments FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "admins can manage assignments"
  ON school_event_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teachers WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

- [ ] **Step 2: Verify table exists**

In Supabase → Table Editor, confirm `school_event_assignments` appears with columns `event_id` and `teacher_id`.

---

## Task 2: Add getLessonSlotsForMonth utility

**Files:**
- Modify: `src/lib/utils/schedule.ts`

- [ ] **Step 1: Add function at end of file**

Open `src/lib/utils/schedule.ts` and append:

```ts
/**
 * Returns all lesson slots for every day in the given calendar month.
 */
export function getLessonSlotsForMonth(
  groups: GroupWithSchedules[],
  year: number,
  month: number  // 0-indexed (0=Jan)
): LessonSlot[] {
  const slots: LessonSlot[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dow = date.getDay()
    for (const group of groups) {
      for (const schedule of group.group_schedules) {
        if (schedule.day_of_week === dow) {
          slots.push({
            groupId: group.id,
            groupName: group.name,
            lessonType: group.lesson_type,
            isMangan: group.is_mangan_school,
            schoolName: group.school_name,
            grade: group.grade,
            date: new Date(date),
            startTime: schedule.start_time.slice(0, 5),
            dayOfWeek: dow,
          })
        }
      }
    }
  }

  return slots
}
```

- [ ] **Step 2: Type-check**

```bash
cd teacher-attendance-app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/schedule.ts
git commit -m "feat: add getLessonSlotsForMonth utility"
```

---

## Task 3: Add getEventsForTeacher query

**Files:**
- Create: `src/lib/queries/events.ts`

- [ ] **Step 1: Create file**

```ts
import { createClient } from '@/lib/supabase/server'
import type { SchoolEvent } from '@/types/database'

export async function getEventsForTeacher(): Promise<SchoolEvent[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Always-visible: holidays and vacations
  const { data: autoEvents } = await supabase
    .from('school_events')
    .select('*')
    .in('event_type', ['holiday', 'vacation'])

  // Explicitly assigned: other event types
  const { data: assignedRows } = await supabase
    .from('school_event_assignments')
    .select('event_id')
    .eq('teacher_id', user.id)

  const assignedIds = (assignedRows ?? []).map(r => r.event_id)

  let assignedEvents: SchoolEvent[] = []
  if (assignedIds.length > 0) {
    const { data } = await supabase
      .from('school_events')
      .select('*')
      .in('id', assignedIds)
    assignedEvents = (data ?? []) as SchoolEvent[]
  }

  // Merge, deduplicate by id
  const seen = new Set<string>()
  const all: SchoolEvent[] = []
  for (const ev of [...(autoEvents ?? []), ...assignedEvents]) {
    if (!seen.has(ev.id)) {
      seen.add(ev.id)
      all.push(ev as SchoolEvent)
    }
  }
  return all
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/events.ts
git commit -m "feat: add getEventsForTeacher query"
```

---

## Task 4: Build MonthView component

**Files:**
- Create: `src/components/dashboard/MonthView.tsx`

- [ ] **Step 1: Create component**

```tsx
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
    const m: Record<string, string[]> = {}
    for (const slot of slots) {
      const key = toDateStr(slot.date)
      if (!m[key]) m[key] = []
      if (!m[key].includes(slot.groupId)) m[key].push(slot.groupId)
    }
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
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const ev      = eventMap[dateStr]
          const groupIds = lessonMap[dateStr] ?? []
          const isWeekend = dow === 5 || dow === 6
          const isToday   = dateStr === todayStr
          const cfg       = ev ? EVENT_COLORS[ev.event_type] : null
          const isFirstOfEvent = ev && ev.start_date === dateStr

          return (
            <button
              key={day}
              disabled={isWeekend}
              onClick={() => !isWeekend && onDayClick(new Date(year, month, day))}
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/MonthView.tsx
git commit -m "feat: add MonthView calendar component"
```

---

## Task 5: Update DayView to accept initialDate prop

**Files:**
- Modify: `src/components/dashboard/DayView.tsx`

- [ ] **Step 1: Add initialDate prop**

Replace the Props interface and useState initializer:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DayView.tsx
git commit -m "feat: DayView accepts optional initialDate prop"
```

---

## Task 6: Update DashboardClient — add month tab

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Replace full file content**

```tsx
'use client'

import { useState, useMemo } from 'react'
import DayView from './DayView'
import WeekView from './WeekView'
import MonthView from './MonthView'
import BottomNav from '@/components/layout/BottomNav'
import { getLessonSlotsForWeek, getWeekStart } from '@/lib/utils/schedule'
import type { GroupWithSchedules, LessonSlot, SchoolEvent } from '@/types/database'

interface Props {
  groups: GroupWithSchedules[]
  teacherName: string
  events: SchoolEvent[]
}

export default function DashboardClient({ groups, teacherName, events }: Props) {
  const [view, setView] = useState<'day' | 'week' | 'month'>('day')
  const [dayInitialDate, setDayInitialDate] = useState<Date | undefined>(undefined)

  const weekSlots: LessonSlot[] = useMemo(() => {
    const slots: LessonSlot[] = []
    for (let i = -2; i <= 5; i++) {
      const weekStart = getWeekStart()
      weekStart.setDate(weekStart.getDate() + i * 7)
      slots.push(...getLessonSlotsForWeek(groups, weekStart))
    }
    const seen = new Set<string>()
    return slots.filter(s => {
      const key = `${s.groupId}-${s.date.toDateString()}-${s.startTime}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [groups])

  function handleMonthDayClick(date: Date) {
    setDayInitialDate(date)
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
        {view === 'day' && <DayView allSlots={weekSlots} initialDate={dayInitialDate} />}
        {view === 'week' && <WeekView allSlots={weekSlots} />}
        {view === 'month' && (
          <MonthView
            groups={groups}
            events={events}
            onDayClick={handleMonthDayClick}
          />
        )}
      </div>

      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors (page.tsx will error until Task 7).

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx
git commit -m "feat: add month tab to dashboard with MonthView"
```

---

## Task 7: Update page.tsx to fetch events

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace full file content**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGroupsWithSchedules } from '@/lib/queries/groups'
import { getEventsForTeacher } from '@/lib/queries/events'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (teacher?.role === 'admin') redirect('/admin')

  const [groups, events] = await Promise.all([
    getGroupsWithSchedules(),
    getEventsForTeacher(),
  ])

  return (
    <DashboardClient
      groups={groups}
      teacherName={teacher?.name ?? 'מורה'}
      events={events}
    />
  )
}
```

- [ ] **Step 2: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, open the app as a teacher. Verify:
- Three tabs appear: יום / שבוע / חודש
- Month tab shows the current month grid
- Days with lessons show colored dots
- No admin events yet (table is empty) — all cells show dots only

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: fetch school events for teacher dashboard"
```

---

## Task 8: Add getTeachersForAdmin query + update createEvent action

**Files:**
- Create: `src/lib/queries/teachers.ts`
- Modify: `src/app/admin/calendar/calendarActions.ts`

- [ ] **Step 1: Create teachers query file**

```ts
import { createClient } from '@/lib/supabase/server'
import type { Teacher } from '@/types/database'

export async function getTeachersForAdmin(): Promise<Teacher[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('teachers')
    .select('id, name, email, phone, role, created_at')
    .eq('role', 'teacher')
    .order('name', { ascending: true })
  return (data ?? []) as Teacher[]
}
```

- [ ] **Step 2: Update calendarActions.ts**

Replace the full file:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin as _requireAdmin } from '@/lib/auth'

const AUTO_SYNC_TYPES = ['holiday', 'vacation']

async function requireAdmin() {
  const { supabase, user } = await _requireAdmin('/admin')
  return { supabase, userId: user.id }
}

export async function createEvent(formData: FormData) {
  const { supabase, userId } = await requireAdmin()

  const name       = formData.get('name') as string
  const eventType  = formData.get('event_type') as string
  const startDate  = formData.get('start_date') as string
  const endDate    = formData.get('end_date') as string || startDate
  const teacherIds = formData.getAll('teacher_ids') as string[]

  const { data: event, error } = await supabase
    .from('school_events')
    .insert({ name, event_type: eventType, start_date: startDate, end_date: endDate, created_by: userId })
    .select('id')
    .single()

  if (error || !event) throw new Error('שגיאה ביצירת האירוע')

  // Insert assignments for non-auto-sync event types
  if (!AUTO_SYNC_TYPES.includes(eventType) && teacherIds.length > 0) {
    const rows = teacherIds.map(tid => ({ event_id: event.id, teacher_id: tid }))
    const { error: assignError } = await supabase
      .from('school_event_assignments')
      .insert(rows)
    if (assignError) throw new Error('שגיאה בשיוך המורות')
  }

  revalidatePath('/admin/calendar')
}

export async function deleteEvent(eventId: string) {
  const { supabase } = await requireAdmin()
  // Assignments cascade-delete via FK
  const { error } = await supabase.from('school_events').delete().eq('id', eventId)
  if (error) throw new Error('שגיאה במחיקת האירוע')
  revalidatePath('/admin/calendar')
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries/teachers.ts src/app/admin/calendar/calendarActions.ts
git commit -m "feat: add teacher assignment logic to createEvent action"
```

---

## Task 9: Update admin CalendarClient with teacher picker

**Files:**
- Modify: `src/app/admin/calendar/CalendarClient.tsx`
- Modify: `src/app/admin/calendar/page.tsx`

- [ ] **Step 1: Update page.tsx to pass teachers**

Replace full `src/app/admin/calendar/page.tsx`:

```tsx
import Link from 'next/link'
import CalendarClient from './CalendarClient'
import type { SchoolEvent, Teacher } from '@/types/database'
import { requireAdmin } from '@/lib/auth'
import { getTeachersForAdmin } from '@/lib/queries/teachers'

export default async function AdminCalendarPage() {
  const { supabase } = await requireAdmin()

  const [eventsResult, teachers] = await Promise.all([
    supabase
      .from('school_events')
      .select('*')
      .order('start_date', { ascending: true }),
    getTeachersForAdmin(),
  ])

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">ניהול</p>
            <h1 className="text-xl font-bold">לוח שנה שנתי</h1>
          </div>
        </div>
        <p className="text-sm text-teal-100 mt-2 mr-12">לחצי על יום להוספת אירוע</p>
      </div>

      <CalendarClient
        events={(eventsResult.data ?? []) as SchoolEvent[]}
        teachers={teachers}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update CalendarClient.tsx**

Add `teachers` prop and teacher picker to the form. Replace the Props interface and add the teacher picker section inside the form (after the end date field, before the submit buttons).

Replace the Props interface at the top of `CalendarClient.tsx`:

```tsx
interface Props {
  events: SchoolEvent[]
  teachers: import('@/types/database').Teacher[]
}

export default function CalendarClient({ events, teachers }: Props) {
```

Add `selectedTeacherIds` state inside the component (after the existing state declarations):

```tsx
const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([])
```

Replace the `submitEvent` function:

```tsx
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
```

Add `const isAutoSync = eventType === 'holiday' || eventType === 'vacation'` in the component body, right before the `return` statement (alongside the other derived values).

Then add the teacher picker JSX inside the form, right before the submit buttons `<div className="flex gap-2">`:

```tsx
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
            selectedTeacherIds.length === teachers.length
              ? []
              : teachers.map(t => t.id)
          )
        }
        className="text-xs font-bold text-teal-500"
      >
        {selectedTeacherIds.length === teachers.length ? 'בטל הכל' : 'בחר הכל'}
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
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Manual end-to-end test**

Run `npm run dev`. As admin:
1. Go to `/admin/calendar` → click a date
2. Select "קונצרט" → confirm teacher picker appears with all teachers
3. Select one teacher → submit → event saved
4. Switch to "חג" → confirm teacher picker is replaced with the auto-sync note
5. As the selected teacher, open the app → go to "חודש" tab → confirm the concert date fills the cell in pink with no lesson dots

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/calendar/page.tsx src/app/admin/calendar/CalendarClient.tsx
git commit -m "feat: add teacher assignment picker to admin event creation"
```
