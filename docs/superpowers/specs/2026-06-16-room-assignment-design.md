# Room Assignment (שיבוץ חדרים) — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admin to assign teachers to rooms by day-of-week, with a weekly board view, in-place editing, conflict blocking, and a live "what's happening now" view. Teachers see the board read-only with their own room highlighted.

**Architecture:** Two new DB tables (`rooms`, `teacher_room_assignments`), one admin page with an interactive board, one teacher read-only page, server actions for mutations, Supabase Realtime for the live view.

**Tech Stack:** Next.js App Router, Supabase (RLS + Realtime), Tailwind CSS, TypeScript, Hebrew RTL UI

---

## Data Model

### Supabase Migration (run in SQL editor)

```sql
create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table teacher_room_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  created_at timestamptz default now(),
  constraint unique_room_day unique(room_id, day_of_week)
);

alter table rooms enable row level security;
create policy "rooms_read_authenticated" on rooms for select using (auth.role() = 'authenticated');
create policy "rooms_admin_all" on rooms for all using (
  exists (select 1 from teachers where id = auth.uid() and role = 'admin')
);

alter table teacher_room_assignments enable row level security;
create policy "assignments_read_authenticated" on teacher_room_assignments for select using (auth.role() = 'authenticated');
create policy "assignments_admin_all" on teacher_room_assignments for all using (
  exists (select 1 from teachers where id = auth.uid() and role = 'admin')
);
```

**Conflict rule:** `unique(room_id, day_of_week)` — one teacher per room per day. Supabase returns error code `23505` on violation.

### TypeScript types (add to `src/types/database.ts`)

```typescript
export type Room = {
  id: string
  name: string
  created_at: string
}

export type TeacherRoomAssignment = {
  id: string
  teacher_id: string
  room_id: string
  day_of_week: number // 0=Sun … 6=Sat
  created_at: string
}
```

---

## File Structure

| File | Create/Modify | Purpose |
|------|--------------|---------|
| `src/types/database.ts` | Modify | Add Room, TeacherRoomAssignment types |
| `src/app/admin/rooms/page.tsx` | Create | Server component: fetch rooms + assignments + teachers |
| `src/app/admin/rooms/RoomBoardClient.tsx` | Create | Client: editable weekly board + mode toggle |
| `src/app/admin/rooms/LiveRoomsClient.tsx` | Create | Client: Supabase Realtime "what's happening now" |
| `src/app/admin/rooms/roomActions.ts` | Create | Server actions: addRoom, deleteRoom, assignRoom, removeAssignment |
| `src/app/rooms/page.tsx` | Create | Teacher read-only board (server component) |
| `src/app/rooms/RoomBoardReadOnly.tsx` | Create | Client: same board, no editing, own room highlighted |
| `src/components/layout/AdminNav.tsx` | Modify | Add "חדרים" nav item → /admin/rooms |
| `src/components/layout/BottomNav.tsx` | Modify | Add "חדרים" nav item → /rooms |

---

## Pages & Components

### 1. `/admin/rooms` — Admin Room Management

**Server component** fetches:
- All rooms (ordered by name)
- All teacher_room_assignments
- All teachers (name + id, non-pending)

Renders:
- Header with "לוח חדרים" title and back link to `/admin`
- `RoomBoardClient` with the data
- Bottom: `AdminNav`

**`RoomBoardClient.tsx`** (client component):

Two sections:
1. **Room list** — add/delete rooms at the top
   - Input + "הוסף" button → calls `addRoom` server action
   - Each room shows a delete button → calls `deleteRoom` (disabled if room has assignments)

2. **Weekly board** with mode toggle buttons:
   - **"לוח שבועי"** (default): editable grid
   - **"עכשיו"**: renders `<LiveRoomsClient>`

**Weekly board grid:**
- Rows = rooms, Columns = days (א׳–ו׳, Sun–Fri, i.e. day_of_week 0–5)
- Each cell shows:
  - If assigned: teacher name (colored chip, clickable)
  - If empty: "+ שבץ" text (visible on hover)
- Clicking any cell (assigned or empty) opens an inline popover:
  - Title: "[day name] · [room name]"
  - List of all teachers (radio-style selection)
  - Currently assigned teacher pre-selected
  - "הסר שיבוץ" option at bottom if currently assigned
  - Clicking a teacher calls `assignRoom` server action immediately (no separate save button)
  - On `23505` error → show inline error: "חדר זה כבר תפוס ביום זה על ידי [teacher name]"
  - Popover closes on outside click or after successful save

### 2. Server Actions (`roomActions.ts`)

```typescript
'use server'
// addRoom(name: string): Promise<{ error?: string }>
// deleteRoom(id: string): Promise<{ error?: string }>
//   — block if room has assignments (return error message)
// assignRoom(roomId, teacherId, dayOfWeek): Promise<{ error?: string }>
//   — upsert by (room_id, day_of_week); catch 23505 and return friendly error
// removeAssignment(roomId, dayOfWeek): Promise<{ error?: string }>
```

All actions use `createAdminClient()` and call `revalidatePath('/admin/rooms')`.

### 3. `LiveRoomsClient.tsx` — "What's Happening Now"

Fetches on mount:
```sql
select lessons.id, lessons.start_time, lessons.group_id,
       groups.teacher_id, groups.lesson_type,
       group_schedules.end_time,
       teachers.name as teacher_name,
       rooms.name as room_name
from lessons
join groups on groups.id = lessons.group_id
join group_schedules on group_schedules.group_id = groups.id
  and group_schedules.day_of_week = extract(dow from now())::int
join teacher_room_assignments tra on tra.teacher_id = groups.teacher_id
  and tra.day_of_week = extract(dow from now())::int
join rooms on rooms.id = tra.room_id
where lessons.date = current_date
  and lessons.status != 'teacher_canceled'
  and lessons.is_holiday = false
```

Subscribes to Supabase Realtime on `lessons` table (filter: `date=eq.${today}`).

Displays cards for each room showing:
- Room name
- Status badge: "תפוס" (green) if current time is within start_time–end_time, else "פנוי" (gray)
- If occupied: teacher name, lesson type, end time
- If free: next lesson time (if any today)

### 4. `/rooms` — Teacher Read-Only View

**Server component** fetches same data as admin page.

Renders `<RoomBoardReadOnly>` with `currentUserId` prop.

**`RoomBoardReadOnly.tsx`:**
- Same weekly grid as admin board, but:
  - No click handlers, no popover
  - No add/delete room UI
  - Cell belonging to current teacher: bold purple border + "⭐ את" label
- Includes the same "עכשיו" toggle → renders `<LiveRoomsClient>` (same component, read-only by nature)

### 5. Navigation Changes

**`AdminNav.tsx`** — add between "לוח שנה" and "מחלות":
```tsx
{
  href: '/admin/rooms',
  label: 'חדרים',
  icon: <DoorIcon />, // simple door SVG
}
```

**`BottomNav.tsx`** — add between "זמינות" and "דוחות":
```tsx
{
  href: '/rooms',
  label: 'חדרים',
  icon: door SVG,
}
```

---

## Conflict Logic

| Scenario | Result |
|----------|--------|
| Assign teacher A to room R on day D (room+day free) | ✅ Success |
| Assign teacher B to room R on day D (already has teacher A) | ❌ Block — "חדר זה תפוס ביום זה על ידי [teacher A]" |
| Delete room with active assignments | ❌ Block — "לא ניתן למחוק חדר עם שיבוצים פעילים" |
| Teacher has same room on two different days | ✅ Allowed |

---

## RLS Summary

- `rooms`: SELECT — any authenticated user. INSERT/UPDATE/DELETE — admin only.
- `teacher_room_assignments`: SELECT — any authenticated user. INSERT/UPDATE/DELETE — admin only.
- Teachers read assignments to show their own room — covered by SELECT policy.
