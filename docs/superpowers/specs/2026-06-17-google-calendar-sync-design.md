# Google Calendar Sync — Design Spec

**Date:** 2026-06-17
**Status:** Approved

---

## Overview

Add Google Calendar integration to the teacher attendance app. Changes made in the app are pushed to Google Calendar automatically (real-time). Changes made in Google Calendar are pulled back manually via a "Sync from Google" button. Deletions detected during pull surface as admin alerts rather than automatic cancellations.

---

## Scope

**Who uses it:** Admin + all teachers (each connects their own Google account).

**What syncs:**
- School events (holidays, vacations, concerts, makeup days, school start/end)
- Teacher's scheduled lessons
- Teacher's vacation requests (once approved)

**Direction:**
- App → Google Calendar: automatic push on every create/update/delete
- Google Calendar → App: manual pull via "Sync from Google" button

---

## Architecture

```
App (Supabase DB)                    Google Calendar API
─────────────────────────────────────────────────────────
createEvent / deleteEvent       →    insert / delete GCal event
lessonActions (create/cancel)   →    insert / delete GCal event

"Sync from Google" button       →    fetch GCal events
                                ←    compare with DB by google_event_id
                                     → create google_sync_alerts for missing events
```

### OAuth Flow
1. User clicks "חבר יומן גוגל" → redirected to Google OAuth consent screen
2. Google redirects to `/api/auth/google/callback` with auth code
3. App exchanges code for `access_token` + `refresh_token`
4. `refresh_token` and `calendar_id` saved to `google_tokens` table
5. All subsequent API calls use stored `refresh_token` (auto-refreshed)

If a user has not connected Google, push calls are silently skipped.

---

## Data Model

### New table: `google_tokens`
```sql
user_id       uuid  PRIMARY KEY REFERENCES auth.users
refresh_token text  NOT NULL  -- stored encrypted
calendar_id   text  NOT NULL  -- e.g. "primary" or specific calendar id
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

### New column: `google_event_id`
Added to:
- `school_events.google_event_id text` — ID of the event in the admin's Google Calendar
- `lessons.google_event_id text` — ID of the event in the teacher's Google Calendar

Used to update or delete the correct Google Calendar event when the app event changes.

### New table: `google_sync_alerts`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
teacher_id  uuid REFERENCES auth.users
lesson_id   uuid REFERENCES lessons
type        text  -- 'deleted_in_google'
created_at  timestamptz DEFAULT now()
resolved    boolean DEFAULT false
```

Populated during "pull from Google". Admin sees unresolved alerts on `/admin`.

---

## Push Logic (App → Google Calendar)

Integrated into existing server actions:

| Trigger | Action |
|---|---|
| `createEvent` (school event) | Create GCal event in admin's calendar; store `google_event_id` on `school_events`. Also create GCal event in each assigned teacher's calendar. |
| `updateEvent` (school event date/name changed) | Update GCal event by `google_event_id` in admin's calendar and all assigned teachers' calendars. |
| `deleteEvent` (school event) | Delete GCal event by `google_event_id` from admin's calendar and all assigned teachers' calendars. See rate limiting note below. |
| Lesson created (via group schedule) | Create GCal event in teacher's calendar; store `google_event_id` on `lessons`. |
| Lesson rescheduled (time or date changed) | Update GCal event by `google_event_id` in teacher's calendar. |
| Lesson canceled (`teacher_canceled`) | Delete GCal event by `google_event_id` from teacher's calendar. |
| Vacation request approved | Create GCal event in teacher's calendar for the vacation date range. |

All push calls are fire-and-forget (non-blocking). Failures are logged but do not interrupt the main action.

Every event created in Google Calendar includes `extendedProperties.private.source = 'teacher-app'` so the pull logic can identify app-owned events.

**Rate limiting:** When a school event is deleted and assigned to many teachers, the app issues one Google API call per teacher. Google Calendar API enforces a quota of ~10 requests/second per user. For now: calls are made sequentially with basic error handling per teacher (failed teachers are logged, not retried). Future improvement: offload to a background queue (e.g. Supabase Edge Function or a job table) for bulk operations.

**Retroactive sync:** When a teacher connects Google for the first time, a one-time sync is triggered that pushes all school events and lessons with `start_date >= today` into her Google Calendar. Past events are excluded.

---

## Pull Logic (Google Calendar → App)

Triggered by user clicking "סנכרן מגוגל עכשיו".

1. Fetch all events from the user's Google Calendar created by the app (identified by `extendedProperties.private.source = 'teacher-app'`)
2. Compare fetched event IDs with `google_event_id` values stored in DB for that user
3. For each `lesson` where `google_event_id` is missing from Google Calendar result → create a `google_sync_alert` of type `deleted_in_google`
4. Return count of alerts created to the UI

**What is NOT synced back automatically:**
- Event title/time changes in Google Calendar are not reflected in the app
- Only deletions are detected

---

## UI

### Teacher-facing: `/settings` (new page)

- Shows current Google connection status: "מחובר ✓" or "לא מחובר"
- "חבר יומן גוגל" button (OAuth trigger)
- "סנכרן מגוגל עכשיו" button (visible only when connected)
- Link to disconnect

Navigation: added as new item to bottom nav bar.

### Admin-facing: `/admin/teachers/[id]`

- Read-only row showing whether the teacher has connected Google: "יומן גוגל: מחובר / לא מחובר"
- No ability to connect on behalf of the teacher

### Admin-facing: `/admin/calendar`

- "סנכרן עם גוגל עכשיו" button in the header
- Triggers a **re-push** of all school events to Google Calendar (not a pull — admin manages events through the app, not from Google Calendar)

### Admin-facing: `/admin`

- New card "התראות גוגל" showing count of unresolved `google_sync_alerts`
- Clicking navigates to a new page `/admin/google-alerts` listing alerts with teacher name, lesson date, and "סמן כטופל" (mark resolved) button

---

## New Files

| File | Purpose |
|---|---|
| `src/lib/googleCalendar.ts` | Google Calendar API client (OAuth token refresh, create/update/delete event) |
| `src/app/api/auth/google/callback/route.ts` | OAuth callback — exchanges code for tokens, saves to DB |
| `src/app/settings/page.tsx` | Teacher settings page (Google connection status + buttons) |
| `src/app/settings/googleActions.ts` | Server actions: connect, disconnect, pull sync |
| `src/app/admin/google-alerts/page.tsx` | Admin page listing unresolved sync alerts |
| `src/app/admin/google-alerts/alertActions.ts` | Server action: mark alert resolved |

---

## Modified Files

| File | Change |
|---|---|
| `src/app/admin/calendar/calendarActions.ts` | Add GCal push after `createEvent` / `deleteEvent` |
| `src/app/groups/[id]/attendance/lessonActions.ts` | Add GCal push on lesson create/cancel |
| `src/app/admin/teachers/[id]/page.tsx` | Show Google connection status |
| `src/app/admin/page.tsx` | Add Google alerts card |
| `src/components/layout/BottomNav.tsx` | Add Settings link |
| `src/types/database.ts` | Add `google_event_id` fields, `GoogleToken`, `GoogleSyncAlert` types |

---

## Out of Scope

- Google Calendar webhooks / automatic pull (Approach B — future phase)
- Two-way sync of event title or time changes
- Syncing attendance records to Google Calendar
- Admin connecting Google on behalf of teachers
