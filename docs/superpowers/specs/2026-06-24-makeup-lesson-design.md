# Makeup Lesson Feature — Design Spec
**Date:** 2026-06-24

## Overview

When a teacher cancels a lesson with a "השלמה" reason, they can now pick a makeup date **and time**. The system automatically creates a makeup lesson record, pushes it to Google Calendar, and displays it on the dashboard in purple. If the teacher undoes the cancellation, the makeup lesson is deleted automatically.

---

## Scope

Applies to both cancellation reasons that include "השלמה":
- "העדרות מורה עם השלמה בתלוש נוכחי"
- "העדרות מורה עם השלמה עתידית"

---

## DB Changes (migration)

Three new nullable columns on the `lessons` table:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `is_makeup` | `boolean` | `false` | Marks this lesson as a makeup |
| `makeup_lesson_id` | `uuid references lessons(id)` | `null` | On the canceled lesson — points to the makeup lesson |
| `makeup_start_time` | `text` | `null` | Start time of the makeup lesson (`HH:MM`) |

`cancellation_notes` continues to hold the makeup **date** string (`YYYY-MM-DD`) as it does today.

---

## Types (`src/types/database.ts`)

Add to `Lesson`:
```ts
is_makeup: boolean
makeup_lesson_id: string | null
makeup_start_time: string | null
```

---

## UI — `CancelLessonButton.tsx`

When the selected reason includes `'השלמה'`, show two inputs side by side (replacing the current single date input):

```
[ תאריך ההשלמה (date) ]  [ שעה (time) ]
```

The time value is stored in local state as `makeupTime` (string `HH:MM`, default `''`).

FormData additions:
- `makeup_start_time` — the chosen time string

---

## Server Action — `cancelLesson`

**New logic when reason includes "השלמה" and a date + time are provided:**

1. Read `makeup_start_time` from FormData.
2. Insert a new `lessons` row:
   - `group_id` — same as the original lesson
   - `date` — the makeup date (from `cancellation_notes` / FormData)
   - `start_time` — `makeup_start_time` + `:00`
   - `status` — `'scheduled'`
   - `is_makeup` — `true`
3. Update the original lesson with `makeup_lesson_id` = new lesson ID and `makeup_start_time`.
4. Push the makeup lesson to Google Calendar (fire-and-forget, same pattern as the existing delete block). Store the returned `google_event_id` on the makeup lesson.

**No change** to the existing sick-leave or advance-notice flows.

---

## Server Action — `restoreLesson`

**New logic:**

1. Fetch `makeup_lesson_id` from the original lesson.
2. If it exists:
   - Fetch `google_event_id` from the makeup lesson.
   - Delete the Google Calendar event (fire-and-forget).
   - Delete the makeup lesson row from the DB.
3. Clear `makeup_lesson_id` and `makeup_start_time` on the original lesson (in addition to existing fields that are already cleared).

---

## Dashboard — `LessonCard.tsx`

When `lesson.is_makeup === true`, apply purple color scheme:
- Card background: `bg-purple-50`, border: `border-purple-200`
- Dot color: purple
- Tag: `השלמה` badge in purple

No other behavior changes — clicking navigates to the attendance page as normal.

---

## Attendance Page — `page.tsx` + `CancelLessonButton.tsx`

When the lesson has `is_makeup === true`:
- Show a purple banner: **"שיעור השלמה"** with the original lesson date. The original lesson is found via a reverse-lookup query: `select * from lessons where makeup_lesson_id = <current lesson id>`.
- Hide the "ביטול שיעור" button (makeup lessons cannot themselves be canceled through this flow).

---

## Error Handling

- If the DB insert for the makeup lesson fails, throw and surface the error — do not silently skip.
- Google Calendar push is fire-and-forget (same as existing pattern); failure is logged, not thrown.
- If `restoreLesson` cannot find the makeup lesson (already deleted), skip gracefully.

---

## Payroll Logic (`src/app/reports/payroll/page.tsx`)

The `cancelLesson` action copies the `reason` string onto the makeup lesson row (`teacher_absence_reason`) so payroll can distinguish between the two makeup types without a join.

Four rules applied when building `dayCounts`:

| Lesson row | Action |
|-----------|--------|
| `status = teacher_canceled` + reason = "תלוש נוכחי" | Count in its regular type column (no deduction) |
| `status = teacher_canceled` + any other reason | Skip (deduct — existing behaviour) |
| `is_makeup = true` + reason contains "עתידית" | Count in `makeup` column |
| `is_makeup = true` + reason contains "תלוש נוכחי" | Skip (original already counted) |

The query must now fetch all non-holiday lessons (removing the `neq('status','teacher_canceled')` filter) and include `status`, `teacher_absence_reason`, and `is_makeup` in the select.

The sick-day counting loop (`sickDates`) is unchanged.

---

## Out of Scope

- Editing the makeup lesson's date/time after creation (future feature).
- Makeup lessons for sick-leave or advance-notice cancellations.
- Cascading cancellation of the makeup lesson itself.
