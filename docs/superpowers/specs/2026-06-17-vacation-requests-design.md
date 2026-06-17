# Teacher Vacation Requests Design

## Goal

Teachers can submit vacation requests (date range + optional note) from the `/reports` page. The secretary sees and approves/rejects requests from `/admin/messages`. Teachers see live status updates.

---

## Data Model

### New table: `vacation_requests`

```sql
create table vacation_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz default now(),
  decided_at timestamptz
);

alter table vacation_requests enable row level security;

create policy "vacation_requests_teacher_read_own" on vacation_requests
  for select using (teacher_id = auth.uid());

create policy "vacation_requests_teacher_insert" on vacation_requests
  for insert with check (teacher_id = auth.uid());

create policy "vacation_requests_admin_all" on vacation_requests
  for all using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );
```

### TypeScript type (add to `src/types/database.ts`)

```typescript
export type VacationRequest = {
  id: string
  teacher_id: string
  start_date: string   // "YYYY-MM-DD"
  end_date: string     // "YYYY-MM-DD"
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  decided_at: string | null
}
```

---

## Pages & Components

### 1. `/reports` — Teacher vacation section

**`src/app/reports/VacationSection.tsx`** (client component):
- Receives `initialRequests: VacationRequest[]` and `userId: string` as props
- Renders existing requests list — each row shows date range, status badge (ממתין / אושר / נדחה), and `admin_note` if status is `rejected`
- "בקשי חופשה" button → toggles inline form open/closed
- Form fields: `start_date` (date input), `end_date` (date input), `note` (textarea, optional)
- Submit calls `submitVacationRequest` server action
- After submit: form closes, list refreshes via `revalidatePath`
- Status badges: amber = pending, green = approved, red = rejected

**`src/app/reports/page.tsx`** (server component, already exists):
- Fetch teacher's vacation requests: `supabase.from('vacation_requests').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false })`
- Pass to `<VacationSection initialRequests={requests} userId={user.id} />`
- Render below existing report content

**`src/app/reports/vacationActions.ts`** (server action):
```typescript
'use server'
// submitVacationRequest(formData: FormData): Promise<{ error?: string }>
// - createClient() + getUser() → return { error: 'unauthorized' } if no user
// - validate start_date <= end_date
// - insert into vacation_requests { teacher_id, start_date, end_date, note }
// - revalidatePath('/reports')
```

---

### 2. `/admin/messages` — Secretary inbox with tabs

**`src/app/admin/messages/page.tsx`** (server component, already exists):
- Also fetch all vacation requests: `supabase.from('vacation_requests').select('*, teachers(name)').order('created_at', { ascending: false })`
- Pass both `messages` and `vacationRequests` to `<MessagesInboxClient>`

**`src/app/admin/messages/MessagesInboxClient.tsx`** (client component, already exists):
- Add tab state: `'messages' | 'vacations'`
- Two tab buttons at the top: "הודעות" and "בקשות חופשה" (with pending count badge on each)
- Vacations tab renders each request: teacher name, date range, note, status badge
- Pending requests show "אשר" / "דחה" buttons
- "דחה" reveals an optional `admin_note` text input before confirming
- Calls `decideVacationRequest` server action on button click
- Per-request pending state (same pattern as existing `pendingIds` Set)

**`src/app/admin/messages/vacationActions.ts`** (server action):
```typescript
'use server'
// decideVacationRequest(id: string, status: 'approved' | 'rejected', adminNote?: string): Promise<{ error?: string }>
// - requireAdmin() wrapper
// - update vacation_requests set status, admin_note, decided_at=now() where id
// - revalidatePath('/admin/messages')
```

---

### 3. AdminNav badge

**`src/app/admin/layout.tsx`**:
- Add fetch for pending vacation count alongside existing messages count:
  `supabase.from('vacation_requests').select('id', { count: 'exact' }).eq('status', 'pending')`
- Pass combined count (`messagesCount + vacationsCount`) as `messagesCount` to `<AdminNav>`

---

## Navigation

No new nav items. The vacation requests feature lives inside:
- `/reports` (teacher submits)
- `/admin/messages` (secretary manages, via new tab)

---

## Migration

File: `supabase/migrations/20260617_vacation_requests.sql`

Contains the full DDL + RLS policies above.

---

## Out of Scope

- Push/toast notification to teacher when request is decided (can be added later)
- Realtime updates on the teacher side (page revalidates on submit; teacher can refresh to see decision)
- Editing or cancelling a submitted request
- Attachment/document upload
