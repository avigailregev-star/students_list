# Bug Reporting System — Design Spec
Date: 2026-05-20

## Overview

When a teacher encounters an error in the app, the system automatically captures it, saves it to the database, sends an email to the admin, and shows the teacher a friendly message with an optional description field.

## Goals

- Admin receives immediate email notification at avigailregev@gmail.com
- Admin can view all bug reports at `/admin/bugs`
- Teacher sees a friendly error page with optional description field
- No external paid services required

---

## Data Model

New table in Supabase: `bug_reports`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `teacher_id` | uuid (nullable) | FK → teachers.id |
| `teacher_name` | text (nullable) | Snapshot of teacher name at report time |
| `page_url` | text | URL where the error occurred |
| `error_message` | text | Error message or type |
| `error_stack` | text (nullable) | Stack trace |
| `user_description` | text (nullable) | Optional text the teacher added |
| `status` | text | `'new'` or `'resolved'` (default: `'new'`) |
| `created_at` | timestamptz | Auto-generated |

RLS policy: insert allowed for authenticated users; select/update restricted to admin role.

---

## Error Capture

### Client-side (UI crashes)
A React Error Boundary wraps the app in `layout.tsx`. When a component throws during render, the boundary catches it and:
1. Shows the teacher the friendly error page
2. Reports the error to `/api/report-error`

### Server-side (server action failures)
A wrapper utility `withErrorReporting(action)` wraps server actions that handle critical operations (attendance saving, lesson creation). On unhandled throw it:
1. Calls `/api/report-error` server-side
2. Re-throws so the existing error UI in forms still works

---

## API Route: `/api/report-error`

**POST** — accepts JSON body:
```json
{
  "errorMessage": "TypeError: ...",
  "errorStack": "...",
  "pageUrl": "/groups/abc/attendance",
  "userDescription": "לחצתי על שמירה..."
}
```

Actions:
1. Reads the current authenticated user from Supabase session
2. Inserts a row into `bug_reports`
3. Sends email via **Resend** to avigailregev@gmail.com
4. Returns `{ ok: true }`

Email uses Resend free tier (3,000 emails/month). Requires `RESEND_API_KEY` env var on Vercel.

---

## Teacher Error Page

Shown by the Error Boundary instead of a blank/broken screen:

- Icon + "אירעה שגיאה" heading
- "הבעיה דווחה אוטומטית. מטפלים בה." subtitle
- Optional textarea: "תרצי להוסיף תיאור קצר של מה עשית?"
- Two buttons: "שלחי דיווח" / "דלגי" (both lead back to home after submission)

---

## Admin Bugs Page: `/admin/bugs`

Accessible only to admin role (same guard as other admin pages).

**Layout:**
- Header with count of new reports
- List of bug report cards, sorted by `created_at DESC`
- New reports: red left border, red "חדש" badge
- Resolved reports: grey, slightly faded
- Each card shows: teacher name, error message, user description, page URL, relative time, "סמן כטופל" button

**Mark as resolved:**
A server action updates `status = 'resolved'` for the given report id.

**Navigation:**
Add "באגים" link to `AdminNav` component with a red dot indicator when there are unresolved reports.

---

## Email Format

**From:** noreply via Resend  
**To:** avigailregev@gmail.com  
**Subject:** `🐛 באג חדש — {teacherName}`

Body includes:
- Error message highlighted in red box
- Table: teacher name, page URL, timestamp, user description
- CTA button linking to `https://students-list-ochre.vercel.app/admin/bugs`

---

## Implementation Order

1. Create `bug_reports` table in Supabase (SQL migration)
2. Add `RESEND_API_KEY` to Vercel env vars
3. Build `/api/report-error` route
4. Build Error Boundary component + teacher error page
5. Wrap `layout.tsx` with Error Boundary
6. Build `/admin/bugs` page + mark-resolved action
7. Add "באגים" link to `AdminNav` with unread indicator
