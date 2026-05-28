# Calendar Events in Views & Attendance Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show school calendar events (holidays, vacations, concerts, etc.) as colored banners in the day/week dashboard views, and as entries in each student's attendance history in the report.

**Architecture:** Create a shared `eventColors` utility. Pass the existing `events` prop from `DashboardClient` down to `DayView` and `WeekView`. In the reports page, extend the groups query to include `group_schedules`, fetch school events, compute which event dates fall on each group's scheduled lesson days (≤ today), and inject those entries into the student history timeline. `ReportGroup` renders event entries with a colored style.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Tailwind CSS 4. No test framework is configured — TypeScript compilation (`npx tsc --noEmit`) serves as the verification step.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/utils/eventColors.ts` | **Create** | Shared color/label map for SchoolEventType + `getActiveEvents` helper |
| `src/components/dashboard/DashboardClient.tsx` | **Modify** | Pass `events` prop to DayView and WeekView |
| `src/components/dashboard/DayView.tsx` | **Modify** | Accept `events` prop, show colored banner(s) when event is active |
| `src/components/dashboard/WeekView.tsx` | **Modify** | Accept `events` prop, show per-day colored strip above lessons |
| `src/app/reports/page.tsx` | **Modify** | Fetch group_schedules + school events; compute event history entries |
| `src/app/reports/ReportGroup.tsx` | **Modify** | Render `school_event` history entries with colored style |

---

## Task 1: Shared event-color utility

**Files:**
- Create: `src/lib/utils/eventColors.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/utils/eventColors.ts
import type { SchoolEvent, SchoolEventType } from '@/types/database'

export const EVENT_COLORS: Record<SchoolEventType, { bg: string; text: string; border: string; label: string }> = {
  holiday:      { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-400',   label: 'חג'         },
  vacation:     { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-400',    label: 'חופשה'      },
  concert:      { bg: 'bg-pink-100',    text: 'text-pink-800',    border: 'border-pink-400',    label: 'קונצרט'     },
  makeup_day:   { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-400', label: 'השלמה'      },
  school_start: { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-400',    label: 'פתיחת שנה' },
  school_end:   { bg: 'bg-violet-100',  text: 'text-violet-800',  border: 'border-violet-400',  label: 'סיום שנה'  },
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function getActiveEvents(events: SchoolEvent[], date: Date): SchoolEvent[] {
  const ds = toDateStr(date)
  return events.filter(ev => ev.start_date <= ds && ds <= ev.end_date)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `teacher-attendance-app/`:
```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/eventColors.ts
git commit -m "feat: add shared event color utility"
```

---

## Task 2: DayView — event banner

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx` (line 84)
- Modify: `src/components/dashboard/DayView.tsx`

- [ ] **Step 1: Pass `events` to DayView in DashboardClient**

In `src/components/dashboard/DashboardClient.tsx`, find the line:
```tsx
{view === 'day' && <DayView allSlots={weekSlots} initialDate={dayInitialDate} />}
```
Replace it with:
```tsx
{view === 'day' && <DayView allSlots={weekSlots} initialDate={dayInitialDate} events={events} />}
```

- [ ] **Step 2: Rewrite DayView.tsx**

Replace the entire content of `src/components/dashboard/DayView.tsx` with:

```tsx
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
}

export default function DayView({ allSlots, initialDate, events }: Props) {
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
        return (
          <div key={ev.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border-r-4 ${cfg.bg} ${cfg.border}`}>
            <span className={`text-[11px] font-bold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
            <span className={`text-sm font-bold ${cfg.text}`}>{ev.name}</span>
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`. Open the app → day view. Navigate to a day that has a school event in the admin calendar. Verify a colored banner appears above the lesson cards with the event's type label and name.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx src/components/dashboard/DayView.tsx
git commit -m "feat: show event banner in day view"
```

---

## Task 3: WeekView — event banners

**Files:**
- Modify: `src/components/dashboard/DashboardClient.tsx` (line 85)
- Modify: `src/components/dashboard/WeekView.tsx`

- [ ] **Step 1: Pass `events` to WeekView in DashboardClient**

In `src/components/dashboard/DashboardClient.tsx`, find:
```tsx
{view === 'week' && <WeekView allSlots={weekSlots} />}
```
Replace with:
```tsx
{view === 'week' && <WeekView allSlots={weekSlots} events={events} />}
```

- [ ] **Step 2: Rewrite WeekView.tsx**

Replace the entire content of `src/components/dashboard/WeekView.tsx` with:

```tsx
'use client'

import { useMemo } from 'react'
import LessonCard from './LessonCard'
import { DAYS_HE } from '@/lib/utils/hebrew'
import { EVENT_COLORS, getActiveEvents } from '@/lib/utils/eventColors'
import type { LessonSlot, SchoolEvent } from '@/types/database'

interface Props {
  allSlots: LessonSlot[]
  events: SchoolEvent[]
}

const WORK_DAYS = [0, 1, 2, 3, 4]

export default function WeekView({ allSlots, events }: Props) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const byDay = useMemo(() => {
    const map = new Map<number, LessonSlot[]>()
    for (const slot of allSlots) {
      if (slot.date < weekStart || slot.date > weekEnd) continue
      const arr = map.get(slot.dayOfWeek) ?? []
      arr.push(slot)
      map.set(slot.dayOfWeek, arr)
    }
    for (const [key, arr] of map) {
      map.set(key, arr.sort((a, b) => a.startTime.localeCompare(b.startTime)))
    }
    return map
  }, [allSlots])

  return (
    <div className="flex flex-col gap-5">
      {WORK_DAYS.map(day => {
        const slots = byDay.get(day) ?? []
        const dayDate = new Date(weekStart)
        dayDate.setDate(weekStart.getDate() + day)
        const dayEvents = getActiveEvents(events, dayDate)
        if (slots.length === 0 && dayEvents.length === 0) return null
        const isToday = today.getDay() === day
        return (
          <div key={day}>
            <div className="flex items-center gap-2 mb-2.5">
              <span className={`text-xs font-bold tracking-widest uppercase ${
                isToday ? 'text-teal-500' : 'text-gray-400'
              }`}>
                {DAYS_HE[day]}
              </span>
              {isToday && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />}
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="flex flex-col gap-2">
              {dayEvents.map(ev => {
                const cfg = EVENT_COLORS[ev.event_type]
                return (
                  <div key={ev.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border-r-4 ${cfg.bg} ${cfg.border}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
                    <span className={`text-xs font-bold ${cfg.text}`}>{ev.name}</span>
                  </div>
                )
              })}
              {slots.map(slot => (
                <LessonCard
                  key={`${slot.groupId}-${slot.startTime}`}
                  slot={slot}
                />
              ))}
            </div>
          </div>
        )
      })}
      {allSlots.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          אין שיעורים השבוע
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Switch to the week view. Navigate to a week that has a school event. Verify a colored strip appears above that day's lesson cards. A day with only an event (no lessons) should also appear.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardClient.tsx src/components/dashboard/WeekView.tsx
git commit -m "feat: show event banners in week view"
```

---

## Task 4: Reports page — fetch schedules and compute event entries

**Files:**
- Modify: `src/app/reports/page.tsx`

- [ ] **Step 1: Add imports at the top of the file**

After the existing imports, add:
```tsx
import { getEventsForTeacher } from '@/lib/queries/events'
import type { GroupSchedule, SchoolEventType } from '@/types/database'
```

- [ ] **Step 2: Replace the local type definitions**

Find the `type GroupWithData = ...` block at the top of the file and replace it with:

```tsx
type HistoryEntry = {
  date: string
  status: string
  brought: boolean
  eventType?: SchoolEventType
  eventName?: string
}

type GroupWithData = Group & {
  students: (Student & {
    lessons_attended: number
    lessons_absent: number
    brought_instrument: number
    total_lessons: number
    history: HistoryEntry[]
  })[]
  total_lessons: number
  canceled_lessons: number
}
```

- [ ] **Step 3: Update groups query to include schedules**

Find:
```tsx
const { data: groups } = await supabase
  .from('groups')
  .select('*')
  .eq('teacher_id', user.id)
  .order('created_at')
```
Replace with:
```tsx
const { data: groups } = await supabase
  .from('groups')
  .select('*, group_schedules(*)')
  .eq('teacher_id', user.id)
  .order('created_at')
```

- [ ] **Step 4: Fetch events after the early-return guard**

After the `if (!groups || groups.length === 0) { return (...) }` block, add:
```tsx
const events = await getEventsForTeacher()
```

- [ ] **Step 5: Compute event entries per group**

Inside the `for (const group of groups as Group[])` loop, after the `studentsWithStats` mapping and before `reportData.push(...)`, add:

```tsx
const scheduledDays = ((group as Group & { group_schedules: GroupSchedule[] }).group_schedules ?? [])
  .map((s: GroupSchedule) => s.day_of_week)

const eventEntries: HistoryEntry[] = []
const seenEventDates = new Set<string>()
for (const ev of events) {
  const start = new Date(ev.start_date + 'T12:00:00')
  const end   = new Date(ev.end_date   + 'T12:00:00')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    if (ds > todayStr) continue
    if (scheduledDays.includes(d.getDay()) && !seenEventDates.has(ds)) {
      seenEventDates.add(ds)
      eventEntries.push({ date: ds, status: 'school_event', brought: false, eventType: ev.event_type, eventName: ev.name })
    }
  }
}

const studentsWithEventHistory = studentsWithStats.map(student => ({
  ...student,
  history: [...student.history, ...eventEntries].sort((a, b) => b.date.localeCompare(a.date)),
}))
```

- [ ] **Step 6: Update `reportData.push` to use the new student array**

Find:
```tsx
reportData.push({ ...group, students: studentsWithStats, total_lessons: lessonList.length, canceled_lessons: canceledList.length })
```
Replace with:
```tsx
reportData.push({ ...group, students: studentsWithEventHistory, total_lessons: lessonList.length, canceled_lessons: canceledList.length })
```

- [ ] **Step 7: Verify TypeScript compiles**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/reports/page.tsx
git commit -m "feat: compute school event entries in attendance report"
```

---

## Task 5: ReportGroup — render event entries

**Files:**
- Modify: `src/app/reports/ReportGroup.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/app/reports/ReportGroup.tsx`, add after the existing imports:
```tsx
import { EVENT_COLORS } from '@/lib/utils/eventColors'
import type { SchoolEventType } from '@/types/database'
```

- [ ] **Step 2: Update the local type**

Find:
```tsx
type StudentWithStats = Student & {
  ...
  history: { date: string; status: string; brought: boolean }[]
}
```
Replace the `history` field type with:
```tsx
  history: { date: string; status: string; brought: boolean; eventType?: SchoolEventType; eventName?: string }[]
```

- [ ] **Step 3: Replace the history rendering block**

Find the block that renders each `h` in `student.history.map(...)` (starts around line 122 with `const date = new Date(h.date + 'T12:00:00')`).

Replace the entire `student.history.map((h, i) => { ... })` callback with:

```tsx
{student.history.map((h, i) => {
  const date = new Date(h.date + 'T12:00:00')

  if (h.status === 'school_event' && h.eventType) {
    const cfg = EVENT_COLORS[h.eventType]
    return (
      <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 border-r-4 ${cfg.bg} ${cfg.border} shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]`}>
        <span className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${cfg.text}`}>{cfg.label}</span>
        <span className={`text-xs font-bold flex-1 ${cfg.text}`}>{formatDateHe(date)}</span>
        <span className={`text-xs font-bold ${cfg.text}`}>{h.eventName}</span>
      </div>
    )
  }

  return (
    <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]">
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[h.status] ?? STATUS_DOT.no_data}`} />
      <span className="text-xs font-bold text-gray-700 flex-1">{formatDateHe(date)}</span>
      {h.brought && (
        <span className="text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-lg font-bold">כלי</span>
      )}
      <span className={`text-xs font-bold ${
        h.status === 'present' ? 'text-emerald-500' :
        h.status === 'absent' ? 'text-red-400' :
        h.status === 'late' ? 'text-amber-500' :
        h.status === 'teacher_canceled' ? 'text-orange-500' : 'text-gray-400'
      }`}>
        {h.status === 'present' ? 'הגיע' :
         h.status === 'absent' ? 'חסר' :
         h.status === 'late' ? 'איחר' :
         h.status === 'excused' ? 'מוצדק' :
         h.status === 'teacher_canceled' ? 'ביטול מורה' : '—'}
      </span>
    </div>
  )
})}
```

- [ ] **Step 4: Verify TypeScript compiles**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Open the reports page. Expand a student who has lessons that overlap with school events. Verify:
- Event entries appear with colored left border and event name
- Regular lesson entries (present/absent/etc.) are unchanged
- All entries are sorted newest-first

- [ ] **Step 6: Commit**

```bash
git add src/app/reports/ReportGroup.tsx
git commit -m "feat: render school events in student attendance history"
```
