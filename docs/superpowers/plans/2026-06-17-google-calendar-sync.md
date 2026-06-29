# Google Calendar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync school events and teacher lessons to each user's personal Google Calendar automatically, with a manual pull to detect deletions made in Google Calendar.

**Architecture:** Each user connects their Google account once via OAuth; refresh token stored in Supabase. Existing server actions push changes to Google Calendar immediately after DB writes (fire-and-forget). A "Sync from Google" button pulls event IDs and creates admin alerts for lessons deleted in Google Calendar.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase, TypeScript, Tailwind CSS v4, Google Calendar REST API (direct fetch — no SDK)

## Global Constraints

- Before writing any Next.js file, check `node_modules/next/dist/docs/` for breaking changes in Next.js 16
- All server actions: `'use server'` at top of file. All client components: `'use client'` at top
- Hebrew UI text only, RTL layout
- All Google API calls are fire-and-forget: log failures with `console.error`, never throw to caller
- Google Calendar all-day events: `{ date: "YYYY-MM-DD" }`. Timed events: `{ dateTime, timeZone: "Asia/Jerusalem" }`
- Required env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`
- Migration files: `supabase/migrations/YYYYMMDD_name.sql`
- No test framework in project — verify with `npx tsc --noEmit` and `npm run build` after each task

---

### Task 1: DB Schema + TypeScript Types

**Files:**
- Create: `supabase/migrations/20260617_google_calendar.sql`
- Modify: `src/types/database.ts`

**Interfaces:**
- Produces: `GoogleToken`, `GoogleEventAssignment`, `GoogleSyncAlert` types; `google_event_id` field on `SchoolEvent` and `Lesson`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260617_google_calendar.sql`:

```sql
-- One Google OAuth token per user
CREATE TABLE IF NOT EXISTS google_tokens (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  calendar_id   text NOT NULL DEFAULT 'primary',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- GCal event ID for school events per teacher (school_events.google_event_id = admin's copy only)
CREATE TABLE IF NOT EXISTS google_event_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_event_id uuid NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
  teacher_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(school_event_id, teacher_id)
);

-- Alerts created when a lesson is missing from teacher's Google Calendar during pull
CREATE TABLE IF NOT EXISTS google_sync_alerts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id  uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'deleted_in_google',
  resolved   boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(teacher_id, lesson_id)
);

ALTER TABLE school_events ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE lessons        ADD COLUMN IF NOT EXISTS google_event_id text;

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_token" ON google_tokens FOR ALL USING (auth.uid() = user_id);

ALTER TABLE google_event_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_assignments" ON google_event_assignments
  FOR SELECT USING (auth.uid() = teacher_id);

ALTER TABLE google_sync_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_alerts" ON google_sync_alerts FOR ALL
  USING (EXISTS (SELECT 1 FROM teachers WHERE id = auth.uid() AND role = 'admin'));
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```
Expected: completes without errors.

- [ ] **Step 3: Update TypeScript types in `src/types/database.ts`**

Add these types after `VacationRequestWithTeacher`:

```typescript
export type GoogleToken = {
  user_id: string
  refresh_token: string
  calendar_id: string
  created_at: string
  updated_at: string
}

export type GoogleEventAssignment = {
  id: string
  school_event_id: string
  teacher_id: string
  google_event_id: string
  created_at: string
}

export type GoogleSyncAlert = {
  id: string
  teacher_id: string
  lesson_id: string
  type: 'deleted_in_google'
  resolved: boolean
  created_at: string
}
```

Update `SchoolEvent` — add `google_event_id: string | null` as the last field before the closing brace.

Update `Lesson` — add `google_event_id: string | null` as the last field before the closing brace.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260617_google_calendar.sql src/types/database.ts
git commit -m "feat: google calendar DB schema and types"
```

---

### Task 2: Google Calendar API Client

**Files:**
- Create: `src/lib/googleCalendar.ts`

**Interfaces:**
- Produces:
  - `getAccessToken(userId: string): Promise<{ accessToken: string; calendarId: string } | null>`
  - `pushSchoolEvent(userId: string, p: SchoolEventPayload): Promise<string | null>` → google_event_id
  - `updateSchoolEvent(userId: string, googleEventId: string, p: SchoolEventPayload): Promise<void>`
  - `deleteGCalEvent(userId: string, googleEventId: string): Promise<void>`
  - `pushLesson(userId: string, p: LessonPayload): Promise<string | null>` → google_event_id
  - `listAppEventIds(userId: string): Promise<string[]>`

- [ ] **Step 1: Create `src/lib/googleCalendar.ts`**

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export type SchoolEventPayload = {
  id: string
  name: string
  startDate: string  // "YYYY-MM-DD"
  endDate: string    // "YYYY-MM-DD"
}

export type LessonPayload = {
  id: string
  groupName: string
  date: string       // "YYYY-MM-DD"
  startTime: string  // "HH:MM:SS"
  endTime: string    // "HH:MM:SS"
}

function nextDay(date: string): string {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export async function getAccessToken(
  userId: string
): Promise<{ accessToken: string; calendarId: string } | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('google_tokens')
    .select('refresh_token, calendar_id')
    .eq('user_id', userId)
    .single()
  if (!data) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    console.error('googleCalendar: token refresh failed', await res.text())
    return null
  }
  const { access_token } = await res.json() as { access_token: string }
  return { accessToken: access_token, calendarId: data.calendar_id }
}

async function calendarFetch(
  userId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response | null> {
  const token = await getAccessToken(userId)
  if (!token) return null
  return fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(token.calendarId)}${path}`,
    { ...options, headers: { Authorization: `Bearer ${token.accessToken}`, ...(options.headers ?? {}) } }
  )
}

export async function pushSchoolEvent(
  userId: string,
  p: SchoolEventPayload
): Promise<string | null> {
  const res = await calendarFetch(userId, '/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: p.name,
      start: { date: p.startDate },
      end: { date: nextDay(p.endDate) },
      extendedProperties: { private: { source: 'teacher-app', appEventId: p.id } },
    }),
  })
  if (!res || !res.ok) { console.error('googleCalendar: pushSchoolEvent failed', await res?.text()); return null }
  return ((await res.json()) as { id: string }).id
}

export async function updateSchoolEvent(
  userId: string,
  googleEventId: string,
  p: SchoolEventPayload
): Promise<void> {
  const res = await calendarFetch(userId, `/events/${googleEventId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: p.name,
      start: { date: p.startDate },
      end: { date: nextDay(p.endDate) },
    }),
  })
  if (!res || !res.ok) console.error('googleCalendar: updateSchoolEvent failed', await res?.text())
}

export async function deleteGCalEvent(
  userId: string,
  googleEventId: string
): Promise<void> {
  const res = await calendarFetch(userId, `/events/${googleEventId}`, { method: 'DELETE' })
  if (res && !res.ok && res.status !== 410) {
    console.error('googleCalendar: deleteGCalEvent failed', await res.text())
  }
}

export async function pushLesson(
  userId: string,
  p: LessonPayload
): Promise<string | null> {
  const res = await calendarFetch(userId, '/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: p.groupName,
      start: { dateTime: `${p.date}T${p.startTime.slice(0, 5)}:00`, timeZone: 'Asia/Jerusalem' },
      end:   { dateTime: `${p.date}T${p.endTime.slice(0, 5)}:00`,   timeZone: 'Asia/Jerusalem' },
      extendedProperties: { private: { source: 'teacher-app', appLessonId: p.id } },
    }),
  })
  if (!res || !res.ok) { console.error('googleCalendar: pushLesson failed', await res?.text()); return null }
  return ((await res.json()) as { id: string }).id
}

export async function listAppEventIds(userId: string): Promise<string[]> {
  const token = await getAccessToken(userId)
  if (!token) return []
  const params = new URLSearchParams({
    privateExtendedProperty: 'source=teacher-app',
    maxResults: '2500',
    singleEvents: 'true',
    timeMin: new Date().toISOString(),
  })
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(token.calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token.accessToken}` } }
  )
  if (!res.ok) { console.error('googleCalendar: listAppEventIds failed', await res.text()); return [] }
  return ((await res.json()) as { items: { id: string }[] }).items?.map(e => e.id) ?? []
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/googleCalendar.ts
git commit -m "feat: google calendar API client"
```

---

### Task 3: OAuth Callback Route

**Files:**
- Create: `src/app/api/auth/google/callback/route.ts`

**Interfaces:**
- Consumes: `pushSchoolEvent`, `pushLesson` from `src/lib/googleCalendar.ts`
- Produces: saves `google_tokens` row, then redirects to `/settings?connected=1`

- [ ] **Step 1: Set up Google Cloud credentials**

In `.env.local` (create if missing):
```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

In Google Cloud Console:
1. APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)
2. Add Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
3. Enable "Google Calendar API" in the project
4. Copy credentials to `.env.local`

- [ ] **Step 2: Create `src/app/api/auth/google/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushSchoolEvent, pushLesson } from '@/lib/googleCalendar'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/settings?error=no_code', request.url))

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) {
    console.error('google callback: token exchange failed', await tokenRes.text())
    return NextResponse.redirect(new URL('/settings?error=token_exchange', request.url))
  }
  const { refresh_token } = await tokenRes.json() as { refresh_token?: string }
  if (!refresh_token) return NextResponse.redirect(new URL('/settings?error=no_refresh_token', request.url))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const admin = createAdminClient()
  await admin.from('google_tokens').upsert({
    user_id: user.id,
    refresh_token,
    calendar_id: 'primary',
    updated_at: new Date().toISOString(),
  })

  // Retroactive sync — push all upcoming school events and lessons for this teacher
  void retroactiveSync(user.id)

  return NextResponse.redirect(new URL('/settings?connected=1', request.url))
}

async function retroactiveSync(userId: string) {
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  // School events: auto-sync types (holiday/vacation) + explicitly assigned
  const { data: autoEvents } = await admin
    .from('school_events')
    .select('id, name, start_date, end_date, event_type')
    .in('event_type', ['holiday', 'vacation'])
    .gte('end_date', today)

  const { data: assignedRows } = await admin
    .from('school_event_assignments')
    .select('event_id')
    .eq('teacher_id', userId)

  const assignedIds = (assignedRows ?? []).map(r => r.event_id)
  let assignedEvents: { id: string; name: string; start_date: string; end_date: string }[] = []
  if (assignedIds.length > 0) {
    const { data } = await admin
      .from('school_events')
      .select('id, name, start_date, end_date')
      .in('id', assignedIds)
      .gte('end_date', today)
    assignedEvents = data ?? []
  }

  const seen = new Set<string>()
  const allEvents = [...(autoEvents ?? []), ...assignedEvents].filter(e => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  for (const ev of allEvents) {
    // Skip if already pushed (check google_event_assignments)
    const { data: existing } = await admin
      .from('google_event_assignments')
      .select('id')
      .eq('school_event_id', ev.id)
      .eq('teacher_id', userId)
      .single()
    if (existing) continue

    const gcalId = await pushSchoolEvent(userId, {
      id: ev.id, name: ev.name, startDate: ev.start_date, endDate: ev.end_date,
    })
    if (gcalId) {
      await admin.from('google_event_assignments').insert({
        school_event_id: ev.id, teacher_id: userId, google_event_id: gcalId,
      })
    }
  }

  // Upcoming lessons for this teacher
  const { data: groups } = await admin
    .from('groups')
    .select('id, name, group_schedules(end_time)')
    .eq('teacher_id', userId)

  if (!groups || groups.length === 0) return

  for (const group of groups) {
    const endTime = (group.group_schedules as { end_time: string | null }[])?.[0]?.end_time ?? null

    const { data: lessons } = await admin
      .from('lessons')
      .select('id, date, start_time, google_event_id')
      .eq('group_id', group.id)
      .eq('status', 'scheduled')
      .gte('date', today)
      .is('google_event_id', null)

    for (const lesson of lessons ?? []) {
      const computedEnd = endTime ?? addMinutesToTime(lesson.start_time, 60)
      const gcalId = await pushLesson(userId, {
        id: lesson.id,
        groupName: group.name,
        date: lesson.date,
        startTime: lesson.start_time,
        endTime: computedEnd,
      })
      if (gcalId) {
        await admin.from('lessons').update({ google_event_id: gcalId }).eq('id', lesson.id)
      }
    }
  }
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/google/callback/route.ts
git commit -m "feat: google OAuth callback route with retroactive sync"
```

---

### Task 4: Teacher Settings Page

**Files:**
- Create: `src/app/settings/googleActions.ts`
- Create: `src/app/settings/SyncButton.tsx`
- Create: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `listAppEventIds` from `src/lib/googleCalendar.ts`
- Produces: `/settings` route, `initiateGoogleConnect()`, `disconnectGoogle()`, `syncFromGoogle()`

- [ ] **Step 1: Create `src/app/settings/googleActions.ts`**

```typescript
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listAppEventIds } from '@/lib/googleCalendar'

export async function initiateGoogleConnect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!)
  url.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  redirect(url.toString())
}

export async function disconnectGoogle(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  await admin.from('google_tokens').delete().eq('user_id', user.id)
  await admin.from('google_event_assignments').delete().eq('teacher_id', user.id)

  const { data: groups } = await admin.from('groups').select('id').eq('teacher_id', user.id)
  if (groups && groups.length > 0) {
    await admin.from('lessons')
      .update({ google_event_id: null })
      .in('group_id', groups.map(g => g.id))
  }
}

export async function syncFromGoogle(): Promise<{ alertsCreated: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: groups } = await admin.from('groups').select('id').eq('teacher_id', user.id)
  if (!groups || groups.length === 0) return { alertsCreated: 0 }

  const { data: lessons } = await admin
    .from('lessons')
    .select('id, google_event_id')
    .in('group_id', groups.map(g => g.id))
    .gte('date', today)
    .eq('status', 'scheduled')
    .not('google_event_id', 'is', null)

  if (!lessons || lessons.length === 0) return { alertsCreated: 0 }

  const gcalIds = new Set(await listAppEventIds(user.id))
  const missing = lessons.filter(l => l.google_event_id && !gcalIds.has(l.google_event_id))
  if (missing.length === 0) return { alertsCreated: 0 }

  await admin.from('google_sync_alerts').upsert(
    missing.map(l => ({ teacher_id: user.id, lesson_id: l.id, type: 'deleted_in_google' })),
    { onConflict: 'teacher_id,lesson_id', ignoreDuplicates: true }
  )

  return { alertsCreated: missing.length }
}
```

- [ ] **Step 2: Create `src/app/settings/SyncButton.tsx`**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { syncFromGoogle } from './googleActions'

export default function SyncButton() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<number | null>(null)

  function handleSync() {
    startTransition(async () => {
      const { alertsCreated } = await syncFromGoogle()
      setResult(alertsCreated)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSync}
        disabled={isPending}
        className="w-full py-3 bg-teal-500 text-white font-bold rounded-2xl text-sm hover:bg-teal-600 transition-colors disabled:opacity-60"
      >
        {isPending ? 'מסנכרן...' : 'סנכרן מגוגל עכשיו'}
      </button>
      {result !== null && (
        <p className="text-xs text-center font-semibold text-gray-500">
          {result === 0 ? 'הכל מסונכרן ✓' : `נמצאו ${result} שיעורים שנמחקו ביומן גוגל`}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/settings/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { initiateGoogleConnect, disconnectGoogle } from './googleActions'
import SyncButton from './SyncButton'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const admin = createAdminClient()
  const { data: token } = await admin
    .from('google_tokens').select('calendar_id').eq('user_id', user.id).single()

  const isConnected = !!token

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">הגדרות</p>
            <h1 className="text-xl font-bold">יומן גוגל</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-4">
        {params.connected === '1' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm font-semibold text-emerald-700">
            יומן גוגל חובר בהצלחה ✓
          </div>
        )}
        {params.error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm font-semibold text-red-700">
            שגיאה בחיבור יומן גוגל. נסי שוב.
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConnected ? 'bg-emerald-100' : 'bg-gray-100'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isConnected ? '#10b981' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800">יומן גוגל</p>
              <p className={`text-xs font-semibold ${isConnected ? 'text-emerald-600' : 'text-gray-400'}`}>
                {isConnected ? 'מחובר ✓' : 'לא מחובר'}
              </p>
            </div>
          </div>

          {!isConnected ? (
            <form action={initiateGoogleConnect}>
              <button type="submit" className="w-full py-3 bg-teal-500 text-white font-bold rounded-2xl text-sm hover:bg-teal-600 transition-colors">
                חבר יומן גוגל
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-2">
              <SyncButton />
              <form action={disconnectGoogle}>
                <button type="submit" className="w-full py-2.5 bg-gray-100 text-gray-500 font-semibold rounded-2xl text-sm hover:bg-gray-200 transition-colors">
                  נתק יומן גוגל
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/
git commit -m "feat: teacher settings page with google connect/disconnect/sync"
```

---

### Task 5: Bottom Nav — Settings Link

**Files:**
- Modify: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Add Settings to the `items` array**

In `src/components/layout/BottomNav.tsx`, add this object to the `items` array (after the 'דוחות' item):

```typescript
{
  href: '/settings',
  label: 'הגדרות',
  icon: (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#14b8a6' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
},
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/BottomNav.tsx
git commit -m "feat: add settings link to bottom nav"
```

---

### Task 6: Push School Events

**Files:**
- Modify: `src/app/admin/calendar/calendarActions.ts`
- Modify: `src/app/admin/calendar/CalendarClient.tsx`
- Modify: `src/app/admin/calendar/page.tsx`
- Create: `src/app/admin/calendar/repushAction.ts`

- [ ] **Step 1: Modify `createEvent` in `src/app/admin/calendar/calendarActions.ts`**

Add these imports at the top:
```typescript
import { pushSchoolEvent } from '@/lib/googleCalendar'
import type { SchoolEventType } from '@/types/database'
```

After `revalidatePath('/')` in `createEvent`, add:

```typescript
  // Push to admin's Google Calendar
  void (async () => {
    try {
      const gcalId = await pushSchoolEvent(userId, {
        id: event.id,
        name: name!,
        startDate: startDate!,
        endDate: endDate!,
      })
      if (gcalId) {
        await supabase.from('school_events').update({ google_event_id: gcalId }).eq('id', event.id)
      }

      // Push to teachers' Google Calendars
      let teacherIdsToPush: string[] = teacherIds
      if (AUTO_SYNC_TYPES.includes(eventType as SchoolEventType)) {
        const { data: allTeachers } = await supabase
          .from('teachers').select('id').eq('role', 'teacher')
        teacherIdsToPush = (allTeachers ?? []).map(t => t.id)
      }

      for (const tid of teacherIdsToPush) {
        const tGcalId = await pushSchoolEvent(tid, {
          id: event.id,
          name: name!,
          startDate: startDate!,
          endDate: endDate!,
        })
        if (tGcalId) {
          await supabase.from('google_event_assignments').insert({
            school_event_id: event.id,
            teacher_id: tid,
            google_event_id: tGcalId,
          })
        }
      }
    } catch (e) {
      console.error('createEvent: google push failed', e)
    }
  })()
```

- [ ] **Step 2: Modify `deleteEvent` in `calendarActions.ts`**

Add import at top:
```typescript
import { deleteGCalEvent } from '@/lib/googleCalendar'
```

Before `revalidatePath` calls in `deleteEvent`, add:

```typescript
  // Delete from Google Calendars
  void (async () => {
    try {
      // Admin's copy
      const { data: ev } = await supabase
        .from('school_events').select('google_event_id').eq('id', eventId).single()
      if (ev?.google_event_id) await deleteGCalEvent(userId, ev.google_event_id)

      // Teachers' copies
      const { data: assignments } = await supabase
        .from('google_event_assignments')
        .select('teacher_id, google_event_id')
        .eq('school_event_id', eventId)
      for (const a of assignments ?? []) {
        await deleteGCalEvent(a.teacher_id, a.google_event_id)
      }
    } catch (e) {
      console.error('deleteEvent: google delete failed', e)
    }
  })()
```

- [ ] **Step 3: Create `src/app/admin/calendar/repushAction.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushSchoolEvent, updateSchoolEvent } from '@/lib/googleCalendar'

export async function repushAllEvents(): Promise<{ count: number }> {
  const { user } = await _requireAdmin('/admin')
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: events } = await admin
    .from('school_events')
    .select('id, name, start_date, end_date, google_event_id')
    .gte('end_date', today)

  let count = 0
  for (const ev of events ?? []) {
    if (ev.google_event_id) {
      await updateSchoolEvent(user.id, ev.google_event_id, {
        id: ev.id, name: ev.name, startDate: ev.start_date, endDate: ev.end_date,
      })
    } else {
      const gcalId = await pushSchoolEvent(user.id, {
        id: ev.id, name: ev.name, startDate: ev.start_date, endDate: ev.end_date,
      })
      if (gcalId) {
        await admin.from('school_events').update({ google_event_id: gcalId }).eq('id', ev.id)
      }
    }
    count++
  }

  revalidatePath('/admin/calendar')
  return { count }
}
```

- [ ] **Step 4: Add re-push button to `CalendarClient.tsx`**

Add a `RepushButton` client component inline at the top of `CalendarClient.tsx` (before the `export default` line):

```typescript
'use client'  // already present

import { repushAllEvents } from './repushAction'  // add to existing imports

// Add this component before CalendarClient:
function RepushButton() {
  const [isPending, startTransition] = useTransition()  // useTransition already imported
  const [done, setDone] = useState(false)  // useState already imported

  return (
    <button
      onClick={() => startTransition(async () => { await repushAllEvents(); setDone(true) })}
      disabled={isPending}
      className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors disabled:opacity-50"
    >
      {isPending ? 'שולח...' : done ? 'נשלח ✓' : 'סנכרן עם גוגל'}
    </button>
  )
}
```

In the JSX return of `CalendarClient`, find the legend `<div className="flex flex-wrap gap-2">` and add `<RepushButton />` after the legend div.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/calendar/
git commit -m "feat: push school events to google calendar on create/delete"
```

---

### Task 7: Push Lessons on Cancel / Restore

**Files:**
- Modify: `src/app/groups/[id]/attendance/lessonActions.ts`

- [ ] **Step 1: Add Google push to `cancelLesson`**

Add imports at top of `lessonActions.ts`:
```typescript
import { deleteGCalEvent } from '@/lib/googleCalendar'
import { createAdminClient } from '@/lib/supabase/admin'
```

After the `if (error)` throw in `cancelLesson`, add:

```typescript
  // Remove from teacher's Google Calendar
  void (async () => {
    try {
      const admin = createAdminClient()
      const { data: lesson } = await admin
        .from('lessons').select('google_event_id').eq('id', lessonId).single()
      if (lesson?.google_event_id) {
        await deleteGCalEvent(user.id, lesson.google_event_id)
        await admin.from('lessons').update({ google_event_id: null }).eq('id', lessonId)
      }
    } catch (e) {
      console.error('cancelLesson: google delete failed', e)
    }
  })()
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/groups/[id]/attendance/lessonActions.ts
git commit -m "feat: delete google calendar event when lesson is canceled"
```

---

### Task 8: Push Approved Vacation to Teacher's Calendar

**Files:**
- Modify: `src/app/admin/messages/vacationActions.ts`

- [ ] **Step 1: Modify `decideVacationRequest`**

Add imports at top:
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { pushSchoolEvent } from '@/lib/googleCalendar'
```

After the `if (error)` return in `decideVacationRequest`, add:

```typescript
  if (status === 'approved') {
    void (async () => {
      try {
        const admin = createAdminClient()
        const { data: req } = await admin
          .from('vacation_requests')
          .select('teacher_id, start_date, end_date')
          .eq('id', id)
          .single()
        if (req) {
          await pushSchoolEvent(req.teacher_id, {
            id: `vacation-${id}`,
            name: 'חופשה מאושרת',
            startDate: req.start_date,
            endDate: req.end_date,
          })
        }
      } catch (e) {
        console.error('decideVacationRequest: google push failed', e)
      }
    })()
  }
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add src/app/admin/messages/vacationActions.ts
git commit -m "feat: push approved vacation to teacher's google calendar"
```

---

### Task 9: Admin Teachers — Google Connection Status

**Files:**
- Modify: `src/app/admin/teachers/[id]/page.tsx`

- [ ] **Step 1: Query google_tokens for the teacher**

In `TeacherDetailPage`, add to the existing `Promise.all` block a query for the teacher's token:

```typescript
  const [{ data: groupsRaw }, { data: rangesRaw }, { data: googleToken }] = await Promise.all([
    supabase.from('groups').select('*, group_schedules(*), students(*)').eq('teacher_id', id).order('created_at', { ascending: true }),
    supabase.from('teacher_availability_ranges').select('*').eq('teacher_id', id).order('day_of_week').order('start_time'),
    supabase.from('google_tokens').select('calendar_id').eq('user_id', id).single(),
  ])
```

- [ ] **Step 2: Show status in JSX**

After the `<EditTeacherForm>` component and before `<AdminTeacherTabs>`, add:

```typescript
        <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${googleToken ? 'bg-emerald-100' : 'bg-gray-100'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={googleToken ? '#10b981' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500">יומן גוגל</p>
            <p className={`text-sm font-semibold ${googleToken ? 'text-emerald-600' : 'text-gray-400'}`}>
              {googleToken ? 'מחובר' : 'לא מחובר'}
            </p>
          </div>
        </div>
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/app/admin/teachers/[id]/page.tsx
git commit -m "feat: show google calendar connection status on teacher admin page"
```

---

### Task 10: Admin Google Alerts Page + Home Card

**Files:**
- Create: `src/app/admin/google-alerts/alertActions.ts`
- Create: `src/app/admin/google-alerts/page.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Create `src/app/admin/google-alerts/alertActions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin as _requireAdmin } from '@/lib/auth'

export async function resolveAlert(alertId: string): Promise<void> {
  const { supabase } = await _requireAdmin('/admin')
  await supabase.from('google_sync_alerts').update({ resolved: true }).eq('id', alertId)
  revalidatePath('/admin/google-alerts')
  revalidatePath('/admin')
}
```

- [ ] **Step 2: Create `src/app/admin/google-alerts/page.tsx`**

```typescript
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { resolveAlert } from './alertActions'

export const dynamic = 'force-dynamic'

export default async function GoogleAlertsPage() {
  await requireAdmin()
  const admin = createAdminClient()

  const { data: alerts } = await admin
    .from('google_sync_alerts')
    .select(`
      id, type, created_at, resolved,
      teachers:teacher_id ( name ),
      lessons:lesson_id ( date, start_time, group_id )
    `)
    .eq('resolved', false)
    .order('created_at', { ascending: false })

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
            <h1 className="text-xl font-bold">התראות יומן גוגל</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-3">
        {(!alerts || alerts.length === 0) && (
          <div className="bg-white rounded-2xl shadow-sm px-4 py-6 text-center text-sm text-gray-400 font-semibold">
            אין התראות פתוחות ✓
          </div>
        )}
        {(alerts ?? []).map(alert => {
          const teacher = alert.teachers as { name: string } | null
          const lesson = alert.lessons as { date: string; start_time: string } | null
          return (
            <div key={alert.id} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{teacher?.name ?? '—'}</p>
                <p className="text-xs text-gray-400">
                  שיעור ב-{lesson?.date ?? '—'} — נמחק ביומן גוגל
                </p>
              </div>
              <form action={resolveAlert.bind(null, alert.id)}>
                <button type="submit" className="text-xs font-bold text-teal-500 px-3 py-1.5 bg-teal-50 rounded-xl hover:bg-teal-100 transition-colors whitespace-nowrap">
                  סמן כטופל
                </button>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add alerts card to `src/app/admin/page.tsx`**

Add to the `Promise.all` block:
```typescript
    supabase.from('google_sync_alerts').select('*', { count: 'exact', head: true }).eq('resolved', false),
```

Destructure it:
```typescript
  const [{ count: teacherCount }, { count: pendingCount }, { count: pendingMessagesCount }, { count: googleAlertsCount }] = await Promise.all([...])
```

Add this card after `<PendingMessagesCard>`:
```typescript
        {(googleAlertsCount ?? 0) > 0 && (
          <a href="/admin/google-alerts" className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-700">{googleAlertsCount} שיעורים נמחקו ביומן גוגל</p>
              <p className="text-xs text-blue-400">לחצי לטיפול</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </a>
        )}
```

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
npm run build
git add src/app/admin/google-alerts/ src/app/admin/page.tsx
git commit -m "feat: admin google alerts page and home card"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| OAuth per user, refresh token stored | Task 3 |
| Push school events on create | Task 6 |
| Push school events on delete | Task 6 |
| Push lesson on cancel | Task 7 |
| Push vacation on approval | Task 8 |
| Retroactive sync on first connect | Task 3 (callback) |
| Pull: detect deleted lessons | Task 4 (syncFromGoogle) |
| Admin alerts for deletions | Task 10 |
| Teacher settings page | Task 4 |
| Admin teachers Google status | Task 9 |
| Admin calendar re-push button | Task 6 |
| Admin home alerts card | Task 10 |
| BottomNav settings link | Task 5 |
| Rate limiting note | Addressed in calendarActions (sequential loops) |
| Retroactive sync date limit (today onwards) | Task 3 callback (`gte('end_date', today)`) |
| extendedProperties.source = 'teacher-app' | Task 2 (googleCalendar.ts) |

**Placeholder scan:** No TBDs found.

**Type consistency:** `SchoolEventPayload`, `LessonPayload`, `getAccessToken`, `pushSchoolEvent`, `deleteGCalEvent`, `pushLesson`, `listAppEventIds` — all defined in Task 2 and consumed consistently in Tasks 3, 6, 7, 8.
