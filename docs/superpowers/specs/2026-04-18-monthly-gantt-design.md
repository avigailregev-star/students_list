# Monthly Gantt View — Design Spec
**Date:** 2026-04-18  
**Status:** Approved

---

## Overview

Add a third "חודש" tab to the teacher dashboard showing a monthly calendar grid. Days with admin-synced school events (holidays, vacations, concerts, etc.) fill the entire cell with a color. Regular lesson days show small colored dots per group. Clicking a day navigates to the Day View for that date.

The admin gains a teacher-assignment UI in the event creation form, controlling which teachers see non-holiday events.

---

## 1. Database

### New table: `school_event_assignments`

```sql
CREATE TABLE school_event_assignments (
  event_id   uuid NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id)      ON DELETE CASCADE,
  PRIMARY KEY (event_id, teacher_id)
);
```

### Sync rules

| Event type | Visible to |
|---|---|
| `holiday`, `vacation` | All teachers automatically (no row needed) |
| `concert`, `makeup_day`, `school_start`, `school_end` | Only teachers listed in `school_event_assignments` |

---

## 2. Admin UI — Event Creation Form

**File:** `src/app/admin/calendar/CalendarClient.tsx`

When the admin creates or manages an event:

- If `event_type` is `holiday` or `vacation`: hide the teacher picker, show a note: "מסונכרן אוטומטית עם כל המורות"
- Otherwise: show a teacher picker — a list of all active teachers with checkboxes + "בחר הכל" button

On form submit, `calendarActions.ts` inserts rows into `school_event_assignments` for each selected teacher (replaces existing assignments for that event).

**New server action functions in `calendarActions.ts`:**
- `createEvent` — extended to accept `teacher_ids: string[]` and insert into `school_event_assignments`
- `deleteEvent` — already cascades via FK

**New query needed:** fetch all teachers for the picker → `getTeachers()` in `src/lib/queries/` (or reuse existing admin query if one exists).

---

## 3. Teacher Side — MonthView Component

### New file: `src/components/dashboard/MonthView.tsx`

**Props:**
```ts
interface Props {
  allSlots: LessonSlot[]
  events: SchoolEvent[]
  onDayClick: (date: Date) => void
}
```

**Rendering logic per cell:**
1. If date falls within a `SchoolEvent` range → fill entire cell with event color, show event name on first day, no lesson dots
2. Otherwise → show lesson dots (one per group that has a slot on that date), colored by group index
3. Weekends (Fri/Sat) → grey, no interaction
4. Today → teal ring outline

**Month navigation:** `useState<{ year: number; month: number }>` initialized to current month. Prev/next arrows update state.

**Event colors:**
| Type | Background | Text |
|---|---|---|
| `holiday` | `bg-amber-100` | `text-amber-800` |
| `vacation` | `bg-blue-100` | `text-blue-800` |
| `concert` | `bg-pink-100` | `text-pink-800` |
| `makeup_day` | `bg-emerald-100` | `text-emerald-800` |
| `school_start` / `school_end` | `bg-teal-100` | `text-teal-800` |

---

## 4. DashboardClient Changes

**File:** `src/components/dashboard/DashboardClient.tsx`

- Add `events: SchoolEvent[]` prop (passed from the page server component)
- Add `'month'` to the `view` state union: `'day' | 'week' | 'month'`
- Add `selectedDate: Date` state (initialized to today) — used so MonthView can set a specific date before switching to DayView
- When MonthView calls `onDayClick(date)`: set `selectedDate` to that date, set `view` to `'day'`
- Pass `selectedDate` to `DayView` so it scrolls/highlights the correct date

---

## 5. New Query: `getEventsForTeacher`

**File:** `src/lib/queries/events.ts` (new file)

```ts
export async function getEventsForTeacher(): Promise<SchoolEvent[]>
```

- Fetches all `school_events` where:
  - `event_type IN ('holiday', 'vacation')` — always included
  - OR the current user's teacher ID appears in `school_event_assignments` for that event
- Single Supabase query using `.or()` filter

---

## 6. Page-Level Wiring

**File:** `src/app/page.tsx` (teacher dashboard page)

- Call `getEventsForTeacher()` alongside existing `getGroupsWithSchedules()`
- Pass `events` to `DashboardClient`

---

## Out of Scope

- Editing existing event assignments (only on create; future iteration)
- Per-teacher event visibility in the admin list view
- Attendance marking directly from MonthView
