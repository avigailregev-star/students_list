# Design: Calendar Events in Views & Attendance Report

**Date:** 2026-05-10  
**Status:** Approved

## Overview

Two features to integrate `SchoolEvent` data (from the admin calendar at `/admin/calendar`) into more parts of the app:

1. **Events in attendance report** — school events appear in each student's lesson history timeline, on days where a lesson was scheduled.
2. **Events in day/week views** — when a school event falls on the displayed day or week, a colored banner appears above the lessons.

---

## Feature 1: Events in Attendance Report

### Goal
In the attendance report (`/reports`), each student's history shows past lessons with statuses (present, absent, etc.). School events (holidays, vacations, concerts, etc.) should also appear in this timeline — but only on days when a lesson was scheduled for that group.

### Data flow

**Current:**
- `reports/page.tsx` fetches `groups`, `lessons`, `attendance` per group
- Builds `history[]` from lessons + teacher-canceled lessons

**After:**
- Also fetch `group_schedules` per group (joined into groups query)
- Call `getEventsForTeacher()` once to get all relevant `SchoolEvent[]`
- For each group: iterate events, expand date ranges, check if any date falls on a scheduled `day_of_week` for that group, and is ≤ today (same cutoff used for lessons)
- Add matching event dates to `history[]` with:
  - `status: 'school_event'`
  - `eventType: SchoolEventType` (for color)
  - `eventName: string` (e.g. "פסח", "קונצרט אביב")

### Changes required

**`reports/page.tsx`:**
- Update groups query: `.select('*, group_schedules(*)')` to get schedules inline
- Import and call `getEventsForTeacher()`
- After building `history` for each student, merge in event entries computed from the group's schedule days × event date ranges
- Sort merged history by date descending (already done)

**`reports/page.tsx` (local type):**
- Extend the local `history` entry type to include optional `eventType?: SchoolEventType` and `eventName?: string` fields

**`ReportGroup.tsx`:**
- Add `eventType` and `eventName` to the `history` item type
- When `status === 'school_event'`: render colored badge with `eventName` instead of the text status label
- Add color mapping per `SchoolEventType` (matches existing `EVENT_COLORS` in `MonthView.tsx`)
- Add `STATUS_DOT` entry for `school_event` (use a neutral dot; badge carries the color)

### Visual
- Background: colored per event type (amber=holiday, blue=vacation, pink=concert, etc.)
- Right border: 3px solid in the event's accent color
- Badge: `eventName` with colored background, replaces the "הגיע"/"חסר" label

---

## Feature 2: Events in Day/Week Views

### Goal
The `MonthView` already receives `events: SchoolEvent[]` and colors cells. `DayView` and `WeekView` should also show a colored banner when the displayed day/period has a school event.

### Changes required

**`DashboardClient.tsx`:**
- Pass `events` prop to `<DayView>` and `<WeekView>` (already passed to `<MonthView>`)

**`DayView.tsx`:**
- Accept `events: SchoolEvent[]` prop
- Compute `activeEvents`: events whose `start_date ≤ selectedDate ≤ end_date`
- If any: render a colored banner (rounded chip) above the lesson list, showing the event dot + name
- Multiple events on same day: show one banner per event, stacked

**`WeekView.tsx`:**
- Accept `events: SchoolEvent[]` prop  
- For each work day rendered, compute events active on that date
- If any: render a small colored strip with event name above that day's lesson cards

### Visual
- Banner: `bg-{color}-100` background, `border-r-4 border-{color}-500`, dot + event name in bold
- Matches the color scheme already used in `MonthView` and `CalendarClient` (`EVENT_COLORS` / `EVENT_CONFIG`)

---

## Shared color mapping

Both features use the same color mapping already defined in `MonthView.tsx` as `EVENT_COLORS`:

| Type | Background | Text | Accent |
|------|-----------|------|--------|
| `holiday` | amber-100 | amber-800 | amber-500 |
| `vacation` | blue-100 | blue-800 | blue-500 |
| `concert` | pink-100 | pink-800 | pink-500 |
| `makeup_day` | emerald-100 | emerald-800 | emerald-500 |
| `school_start` | teal-100 | teal-800 | teal-500 |
| `school_end` | violet-100 | violet-800 | violet-500 |

This mapping can be extracted to a shared utility (e.g., `lib/utils/eventColors.ts`) or duplicated — either is acceptable since it's small.

---

## Out of scope
- No changes to the admin calendar UI
- No changes to how events are created or stored
- No changes to `DayView` navigation or `WeekView` week range
- No new database tables or queries beyond fetching existing `school_events` and `group_schedules`
