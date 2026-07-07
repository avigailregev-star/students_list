# Admin "View as Teacher" + Phantom Lesson Fixes — Design Spec

## Overview

Triggered by an admin report: teachers' attendance-report screen shows lesson history rows with "0 הגיעו" (0 attended) that don't correspond to any real attendance being taken. This spec covers the fix and a new read-only "view as teacher" admin screen.

## Root cause: phantom lesson rows created on page view

`getOrCreateLesson()` (`src/lib/queries/attendance.ts:4-27`) upserts a row into `lessons` every time the teacher's attendance page for a group/date is rendered — even if no attendance is ever recorded. This silently creates a permanent `lessons` row from a page view alone (e.g. a teacher browsing past dates without marking anyone).

**Rejected fix — true lazy creation:** Deferring row creation until an actual save would require restructuring `AttendanceSection`, `AttendanceToggle`, `CancelLessonButton` (including its sick-leave file upload, which keys storage paths off `lessonId`), and `DeleteMakeupButton` to work without a pre-existing `lessonId`. This app has no automated test suite and is in active use by teachers, so this level of change to the core interactive flow was judged too risky relative to the benefit. Rejected in favor of the filter-based fix below.

**Chosen fix — treat "no attendance recorded" as "not a real lesson," everywhere it's counted:** A lesson counts as having actually happened only if it has **at least one `attendance` row, in any status** (present/absent/late/excused — any explicit mark means the teacher engaged with that lesson; zero attendance rows means nobody ever did). Phantom rows keep getting written to `lessons` (harmless — they're just never counted), but three places that currently count/display *every* non-canceled lesson row must instead only count/display lessons with ≥1 attendance row:

1. **`src/app/reports/page.tsx`** (`ReportGroup.tsx:152-159` display) — the teacher's own attendance-history view. This is what the original screenshot showed.
2. **`src/app/reports/payroll/page.tsx`** — the teacher's own "חשבות שכר" (payroll) calculation. Confirmed this counts every non-canceled `lessons` row via `mapType()` with no attendance check — phantom rows currently inflate paid lesson counts.
3. **`src/app/admin/teachers/[id]/reports/page.tsx`** — the admin's payroll view for a given teacher. Same duplicated counting logic as #2, same bug.

All three need a query for which `lesson_id`s (within the relevant group set and date range) have ≥1 `attendance` row, then filter/skip lessons not in that set before counting/displaying them.

## Feature: Admin "View as Teacher" screen

### Entry point

Button on `/admin/teachers/[id]` (near "עריכת פרטים") labeled "צפייה כמורה", linking to `/admin/teachers/[id]/view`.

### Routes

New route group mirroring the teacher-facing screens, all under `requireAdmin()`:

- `/admin/teachers/[id]/view` — dashboard (reuses `DashboardClient`)
- `/admin/teachers/[id]/view/reports` — attendance reports (reuses `ReportGroup`)
- `/admin/teachers/[id]/view/groups/[groupId]` — group detail (reuses the group detail page's JSX/layout)

Each page:
- Calls `requireAdmin()` for auth.
- Fetches data with `createAdminClient()` (service role) scoped by the `id` param — same pattern already used in `/admin/teachers/[id]/reports/page.tsx`.
- Renders a persistent banner: "מצב צפייה — קריאה בלבד" with a link back to `/admin/teachers/[id]`.
- Has its own small bottom nav (דשבורד / דוחות / קבוצות) scoped to `/admin/teachers/[id]/view/*`.

### Read-only mechanism

A `viewOnly` boolean prop threaded into the reused components, hiding/disabling:
- "סמן נוכחות" (mark attendance) link on group detail — rendered disabled/greyed instead of linking to the live attendance page.
- "+ בקשת חופשה" button in reports.
- `DeleteGroupButton` on group detail.

No server-side mutation blocking beyond this — acceptable given this is an internal admin-only tool with a single admin user, and all mutating actions are already gated behind `requireAdmin()`/session identity, so accidental writes would at most be attributed to the admin's own account, not silently corrupt teacher data.

### Explicitly out of scope

- No read-only variant of the attendance-marking page (`/groups/[id]/attendance`) or the vacation-request form — links to them are simply hidden/disabled in view mode.
- No audit log of admin view-mode access.

## Data Flow (view-as-teacher)

```
Admin clicks "צפייה כמורה" on /admin/teachers/[id]
        ↓
/admin/teachers/[id]/view/* (requireAdmin + createAdminClient, scoped by id param)
        ↓
Same presentational components teachers see (DashboardClient, ReportGroup, group detail),
fed admin-fetched data, viewOnly=true hides mutation controls
```

## Testing

There is no automated test suite in this project (no test runner configured). Verification is manual, via the dev server and `npx tsc --noEmit` / `npm run lint`.

- Phantom lesson filter: a lesson with zero attendance rows (simulating a leftover phantom row) no longer shows in the teacher's reports history, and no longer counts toward either payroll view's totals; a lesson with ≥1 attendance row (any status) still shows/counts correctly in all three places.
- View-as-teacher: admin can navigate to `/admin/teachers/[id]/view` and see the same data a teacher would see for their own dashboard/reports/group; mutation controls are hidden/disabled; a non-admin cannot access these routes.
