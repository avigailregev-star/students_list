# Admin "View as Teacher" + Phantom Lesson Fixes — Design Spec

## Overview

Triggered by an admin report: teachers' attendance-report screen shows lesson history rows with "0 הגיעו" (0 attended) that don't correspond to any real attendance being taken. Two bugs cause this, plus the admin currently has no way to see exactly what a teacher's app looks like to verify fixes or diagnose future reports. This spec covers both bug fixes and a new read-only "view as teacher" admin screen.

## Bug 1: Phantom lesson rows created on page view

`getOrCreateLesson()` (`src/lib/queries/attendance.ts:4-27`) upserts a row into `lessons` every time the teacher's attendance page for a group/date is rendered — even if no attendance is ever recorded. This silently creates a permanent `lessons` row from a page view alone.

**Fix**: `getOrCreateLesson` should only be called (or should only insert) when attendance is actually being saved, not on page load. The attendance page needs to read whether a lesson row exists for the date (without creating one) to render the form; the row itself gets created/upserted only inside the save action, alongside the `attendance` rows.

## Bug 2: Reports screen displays lessons with no attendance as "held"

`src/app/reports/page.tsx:91` and `ReportGroup.tsx:152-159` treat every non-canceled `lessons` row as a held lesson — rendering a green dot and "X הגיעו" (defaulting to 0) regardless of whether any `attendance` rows exist for it.

**Fix**: In `reports/page.tsx`, when building `dateSummary` per lesson, check whether the lesson has zero associated `attendance` rows. If so, exclude it from the history list (or, if the date is in the future / today and no attendance is expected yet, that's expected — the check should specifically target *past* lessons with zero attendance rows, which indicates the phantom-creation bug rather than a legitimately empty class). This is a safety net on top of Bug 1's fix, covering already-existing phantom rows in the database.

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

- Bug 1: verify opening the attendance page for a future/untouched date does not create a `lessons` row; verify saving attendance still creates/updates the row correctly.
- Bug 2: verify a lesson with zero attendance rows (simulating a leftover phantom row) no longer shows in the reports history; verify lessons with real attendance still show correctly.
- View-as-teacher: verify admin can navigate to `/admin/teachers/[id]/view` and see the same data a teacher would see for their own dashboard/reports/group; verify mutation controls are hidden/disabled; verify a non-admin cannot access these routes.
