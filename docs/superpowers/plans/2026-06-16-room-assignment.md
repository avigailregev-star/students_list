# Room Assignment (שיבוץ חדרים) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add room assignment to the conservatory app — admin assigns teachers to rooms by day-of-week via an editable weekly board, teachers see the board read-only with their room highlighted, and a live "what's happening now" view shows current room occupancy.

**Architecture:** Two new Supabase tables (`rooms`, `teacher_room_assignments`), server actions for mutations, an admin page with an editable grid + Realtime live view, and a teacher read-only page. All pages follow the existing Next.js App Router server-component + client-component pattern already used throughout the app.

**Tech Stack:** Next.js App Router, Supabase (Postgres + Realtime + RLS), Tailwind CSS, TypeScript, Hebrew RTL UI

---

## Codebase Context (read before starting)

- Admin server components use: `const { supabase } = await requireAdmin()` from `@/lib/auth`
- Admin mutations use: `createAdminClient()` from `@/lib/supabase/admin`
- Regular user pages use: `const supabase = await createClient()` from `@/lib/supabase/server`
- Client components use: `createClient()` from `@/lib/supabase/client`
- Server actions: `'use server'` directive + `revalidatePath()` from `next/cache`
- DB types live in `src/types/database.ts`
- Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday (matches JS `Date.getDay()`)
- Hebrew days displayed as: א׳ ב׳ ג׳ ד׳ ה׳ ו׳ (Sun–Fri = 0–5)
- All UI is RTL (`dir="rtl"`)
- TypeScript check: `npx tsc --noEmit` (zero output = pass)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/types/database.ts` | Modify | Add `Room`, `TeacherRoomAssignment` types |
| `src/app/admin/rooms/page.tsx` | Create | Server component — fetch data, render board |
| `src/app/admin/rooms/roomActions.ts` | Create | Server actions: addRoom, deleteRoom, assignRoom, removeAssignment |
| `src/app/admin/rooms/RoomBoardClient.tsx` | Create | Client — editable grid + room list + mode toggle |
| `src/app/admin/rooms/LiveRoomsClient.tsx` | Create | Client — Supabase Realtime live occupancy view |
| `src/app/rooms/page.tsx` | Create | Teacher read-only server component |
| `src/app/rooms/RoomBoardReadOnly.tsx` | Create | Client — same grid, no editing, own room highlighted |
| `src/components/layout/AdminNav.tsx` | Modify | Add "חדרים" nav item |
| `src/components/layout/BottomNav.tsx` | Modify | Add "חדרים" nav item |

---

## Task 1: Supabase Migration + TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Run migration in Supabase SQL editor**

Open the Supabase dashboard → SQL editor → run:

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
create policy "rooms_read_authenticated" on rooms
  for select using (auth.role() = 'authenticated');
create policy "rooms_admin_all" on rooms
  for all using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );

alter table teacher_room_assignments enable row level security;
create policy "assignments_read_authenticated" on teacher_room_assignments
  for select using (auth.role() = 'authenticated');
create policy "assignments_admin_all" on teacher_room_assignments
  for all using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );
```

Expected: "Success. No rows returned."

- [ ] **Step 2: Add types to `src/types/database.ts`**

Add after the `TeacherAvailabilityRange` type (around line 111):

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
  day_of_week: number // 0=Sun … 5=Fri
  created_at: string
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add Room and TeacherRoomAssignment types"
```

---

## Task 2: Server Actions

**Files:**
- Create: `src/app/admin/rooms/roomActions.ts`

- [ ] **Step 1: Create the server actions file**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addRoom(name: string): Promise<{ error?: string }> {
  if (!name.trim()) return { error: 'שם החדר לא יכול להיות ריק' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('rooms').insert({ name: name.trim() })
  if (error) return { error: error.message }
  revalidatePath('/admin/rooms')
  return {}
}

export async function deleteRoom(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  // Check for active assignments first
  const { count } = await supabase
    .from('teacher_room_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', id)
  if ((count ?? 0) > 0) return { error: 'לא ניתן למחוק חדר עם שיבוצים פעילים. הסירי את השיבוצים תחילה.' }
  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/rooms')
  return {}
}

export async function assignRoom(
  roomId: string,
  teacherId: string,
  dayOfWeek: number
): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  // Upsert: if (room_id, day_of_week) already exists, update teacher_id
  const { error } = await supabase
    .from('teacher_room_assignments')
    .upsert(
      { room_id: roomId, teacher_id: teacherId, day_of_week: dayOfWeek },
      { onConflict: 'room_id,day_of_week' }
    )
  if (error) return { error: error.message }
  revalidatePath('/admin/rooms')
  return {}
}

export async function removeAssignment(
  roomId: string,
  dayOfWeek: number
): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('teacher_room_assignments')
    .delete()
    .eq('room_id', roomId)
    .eq('day_of_week', dayOfWeek)
  if (error) return { error: error.message }
  revalidatePath('/admin/rooms')
  return {}
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/rooms/roomActions.ts
git commit -m "feat: add room server actions"
```

---

## Task 3: Admin Rooms Page (Server Component)

**Files:**
- Create: `src/app/admin/rooms/page.tsx`

- [ ] **Step 1: Create the server component**

```typescript
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'
import RoomBoardClient from './RoomBoardClient'

export default async function AdminRoomsPage() {
  const { supabase } = await requireAdmin()

  const [
    { data: roomsRaw },
    { data: assignmentsRaw },
    { data: teachersRaw },
  ] = await Promise.all([
    supabase.from('rooms').select('*').order('name'),
    supabase.from('teacher_room_assignments').select('*'),
    supabase.from('teachers')
      .select('id, name')
      .eq('is_pending', false)
      .eq('role', 'teacher')
      .order('name'),
  ])

  const rooms = (roomsRaw ?? []) as Room[]
  const assignments = (assignmentsRaw ?? []) as TeacherRoomAssignment[]
  const teachers = (teachersRaw ?? []) as Pick<Teacher, 'id' | 'name'>[]

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">ניהול</p>
            <h1 className="text-xl font-bold">שיבוץ חדרים</h1>
          </div>
        </div>
      </div>
      <RoomBoardClient rooms={rooms} assignments={assignments} teachers={teachers} />
    </div>
  )
}
```

- [ ] **Step 2: Create a placeholder `RoomBoardClient.tsx` so the page compiles**

```typescript
'use client'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'

interface Props {
  rooms: Room[]
  assignments: TeacherRoomAssignment[]
  teachers: Pick<Teacher, 'id' | 'name'>[]
}

export default function RoomBoardClient({ rooms, assignments, teachers }: Props) {
  return <div className="px-4 py-5 text-gray-400 text-sm">טוען...</div>
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/rooms/page.tsx src/app/admin/rooms/RoomBoardClient.tsx
git commit -m "feat: add admin rooms page scaffold"
```

---

## Task 4: Room List UI (Add / Delete)

**Files:**
- Modify: `src/app/admin/rooms/RoomBoardClient.tsx`

This task replaces the placeholder with the full `RoomBoardClient` component. The component has two sections: room management (add/delete) and the weekly board. This task implements the room management section only; the board comes in Task 5.

- [ ] **Step 1: Replace `RoomBoardClient.tsx` with full implementation**

```typescript
'use client'

import { useState, useTransition } from 'react'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'
import { addRoom, deleteRoom, assignRoom, removeAssignment } from './roomActions'
import LiveRoomsClient from './LiveRoomsClient'

const DAYS = [
  { dow: 0, label: "א׳" },
  { dow: 1, label: "ב׳" },
  { dow: 2, label: "ג׳" },
  { dow: 3, label: "ד׳" },
  { dow: 4, label: "ה׳" },
  { dow: 5, label: "ו׳" },
]

// Colors for teachers — cycles through a palette
const TEACHER_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' },
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
]

interface Props {
  rooms: Room[]
  assignments: TeacherRoomAssignment[]
  teachers: Pick<Teacher, 'id' | 'name'>[]
}

export default function RoomBoardClient({ rooms, assignments, teachers }: Props) {
  const [mode, setMode] = useState<'weekly' | 'live'>('weekly')
  const [newRoomName, setNewRoomName] = useState('')
  const [roomError, setRoomError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [activeCell, setActiveCell] = useState<{ roomId: string; dow: number } | null>(null)
  const [cellError, setCellError] = useState('')

  // Map: teacherId → color index
  const teacherColorMap = new Map(
    teachers.map((t, i) => [t.id, TEACHER_COLORS[i % TEACHER_COLORS.length]])
  )

  // Map: `${roomId}-${dow}` → assignment
  const assignmentMap = new Map(
    assignments.map(a => [`${a.room_id}-${a.day_of_week}`, a])
  )

  function getTeacher(teacherId: string) {
    return teachers.find(t => t.id === teacherId)
  }

  function handleAddRoom() {
    if (!newRoomName.trim()) return
    setRoomError('')
    startTransition(async () => {
      const result = await addRoom(newRoomName)
      if (result.error) { setRoomError(result.error); return }
      setNewRoomName('')
    })
  }

  function handleDeleteRoom(id: string) {
    setRoomError('')
    startTransition(async () => {
      const result = await deleteRoom(id)
      if (result.error) setRoomError(result.error)
    })
  }

  function handleCellClick(roomId: string, dow: number) {
    setCellError('')
    if (activeCell?.roomId === roomId && activeCell?.dow === dow) {
      setActiveCell(null)
    } else {
      setActiveCell({ roomId, dow })
    }
  }

  function handleAssign(teacherId: string) {
    if (!activeCell) return
    setCellError('')
    startTransition(async () => {
      const result = await assignRoom(activeCell.roomId, teacherId, activeCell.dow)
      if (result.error) { setCellError(result.error); return }
      setActiveCell(null)
    })
  }

  function handleRemove() {
    if (!activeCell) return
    setCellError('')
    startTransition(async () => {
      const result = await removeAssignment(activeCell.roomId, activeCell.dow)
      if (result.error) { setCellError(result.error); return }
      setActiveCell(null)
    })
  }

  return (
    <div className="px-4 py-5 flex flex-col gap-5" dir="rtl">

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('weekly')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'weekly' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'}`}
        >
          לוח שבועי
        </button>
        <button
          onClick={() => setMode('live')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'live' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}
        >
          ⚡ עכשיו
        </button>
      </div>

      {mode === 'live' && <LiveRoomsClient rooms={rooms} assignments={assignments} teachers={teachers} />}

      {mode === 'weekly' && (
        <>
          {/* Room management */}
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
            <p className="text-sm font-bold text-gray-700">ניהול חדרים</p>
            <div className="flex gap-2">
              <input
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddRoom()}
                placeholder="שם החדר..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                dir="rtl"
              />
              <button
                onClick={handleAddRoom}
                disabled={isPending || !newRoomName.trim()}
                className="px-4 py-2 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 disabled:opacity-40 transition-colors"
              >
                הוסף
              </button>
            </div>
            {roomError && <p className="text-xs text-red-500">{roomError}</p>}
            <div className="flex flex-col gap-1.5">
              {rooms.map(room => {
                const roomAssignments = assignments.filter(a => a.room_id === room.id)
                return (
                  <div key={room.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl text-sm">
                    <span className="font-semibold text-gray-800">{room.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {roomAssignments.length > 0 ? `${roomAssignments.length} שיבוצים` : 'פנוי'}
                      </span>
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        disabled={isPending}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                )
              })}
              {rooms.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">אין חדרים עדיין</p>
              )}
            </div>
          </div>

          {/* Weekly board */}
          {rooms.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-bold text-gray-700">לוח שבועי</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[420px]">
                  <thead>
                    <tr>
                      <th className="p-2 text-xs font-bold text-gray-400 text-right border-b border-gray-100 w-24">חדר</th>
                      {DAYS.map(d => (
                        <th key={d.dow} className="p-2 text-xs font-bold text-gray-400 text-center border-b border-gray-100">{d.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map(room => (
                      <tr key={room.id} className="border-b border-gray-50 last:border-0">
                        <td className="p-2 text-xs font-bold text-gray-700 text-right">{room.name}</td>
                        {DAYS.map(d => {
                          const key = `${room.id}-${d.dow}`
                          const assignment = assignmentMap.get(key)
                          const teacher = assignment ? getTeacher(assignment.teacher_id) : null
                          const color = teacher ? teacherColorMap.get(teacher.id) : null
                          const isActive = activeCell?.roomId === room.id && activeCell?.dow === d.dow

                          return (
                            <td key={d.dow} className="p-1 text-center relative">
                              <button
                                onClick={() => handleCellClick(room.id, d.dow)}
                                className={`w-full rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors border ${
                                  isActive
                                    ? 'ring-2 ring-teal-400 border-teal-300 bg-teal-50'
                                    : teacher && color
                                    ? `${color.bg} ${color.text} ${color.border} hover:opacity-80`
                                    : 'border-dashed border-gray-200 text-gray-300 hover:border-gray-300 hover:text-gray-400'
                                }`}
                              >
                                {teacher ? teacher.name : '+ שבץ'}
                              </button>

                              {/* Popover */}
                              {isActive && (
                                <div
                                  className="absolute z-50 top-full mt-1 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 min-w-[160px] overflow-hidden"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <div className="px-3 py-2 bg-teal-500 text-white text-xs font-bold">
                                    {d.label} · {room.name}
                                  </div>
                                  <div className="py-1">
                                    {teachers.map(t => {
                                      const c = teacherColorMap.get(t.id)!
                                      const isCurrent = assignment?.teacher_id === t.id
                                      return (
                                        <button
                                          key={t.id}
                                          onClick={() => handleAssign(t.id)}
                                          disabled={isPending}
                                          className={`w-full text-right px-3 py-2 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-40 flex items-center gap-2 ${isCurrent ? `${c.bg} ${c.text}` : 'text-gray-700'}`}
                                        >
                                          {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
                                          {t.name}
                                        </button>
                                      )
                                    })}
                                    {assignment && (
                                      <>
                                        <div className="border-t border-gray-100 mt-1 pt-1">
                                          <button
                                            onClick={handleRemove}
                                            disabled={isPending}
                                            className="w-full text-right px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                          >
                                            הסר שיבוץ
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  {cellError && (
                                    <p className="px-3 py-2 text-[10px] text-red-500 border-t border-gray-100">{cellError}</p>
                                  )}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 text-center py-2">לחצי על תא לשיבוץ או החלפה</p>
            </div>
          )}
        </>
      )}

      {/* Close popover on outside click */}
      {activeCell && (
        <div className="fixed inset-0 z-40" onClick={() => setActiveCell(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create a placeholder `LiveRoomsClient.tsx` so it compiles**

```typescript
'use client'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'

interface Props {
  rooms: Room[]
  assignments: TeacherRoomAssignment[]
  teachers: Pick<Teacher, 'id' | 'name'>[]
}

export default function LiveRoomsClient({ rooms }: Props) {
  return <div className="text-sm text-gray-400 text-center py-8">טוען תצוגה חיה...</div>
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/rooms/RoomBoardClient.tsx src/app/admin/rooms/LiveRoomsClient.tsx
git commit -m "feat: add room board client with editable grid"
```

---

## Task 5: Live Rooms View (Supabase Realtime)

**Files:**
- Modify: `src/app/admin/rooms/LiveRoomsClient.tsx`

This replaces the placeholder with the actual live view.

- [ ] **Step 1: Replace `LiveRoomsClient.tsx`**

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'

interface Props {
  rooms: Room[]
  assignments: TeacherRoomAssignment[]
  teachers: Pick<Teacher, 'id' | 'name'>[]
}

interface RoomStatus {
  room: Room
  teacherName: string | null
  lessonType: string | null
  startTime: string | null
  endTime: string | null
  isOccupied: boolean
  nextLessonTime: string | null
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function LiveRoomsClient({ rooms, assignments, teachers }: Props) {
  const [statuses, setStatuses] = useState<RoomStatus[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const teacherMap = new Map(teachers.map(t => [t.id, t.name]))

  // Map: teacher_id → room_id for today's day_of_week
  const todayDow = new Date().getDay()
  const teacherRoomMap = new Map(
    assignments
      .filter(a => a.day_of_week === todayDow)
      .map(a => [a.teacher_id, a.room_id])
  )

  const fetchLiveData = useCallback(async () => {
    const supabase = createClient()
    const today = todayStr()
    const dow = new Date().getDay()

    // Fetch today's active lessons
    const { data: lessons } = await supabase
      .from('lessons')
      .select('id, group_id, start_time, status')
      .eq('date', today)
      .neq('status', 'teacher_canceled')
      .eq('is_holiday', false)

    if (!lessons || lessons.length === 0) {
      setStatuses(rooms.map(room => ({
        room, teacherName: null, lessonType: null,
        startTime: null, endTime: null, isOccupied: false, nextLessonTime: null,
      })))
      setLastUpdated(new Date())
      return
    }

    const groupIds = [...new Set(lessons.map(l => l.group_id))]

    const [{ data: groups }, { data: schedules }] = await Promise.all([
      supabase.from('groups').select('id, teacher_id, lesson_type').in('id', groupIds),
      supabase.from('group_schedules')
        .select('group_id, start_time, end_time')
        .in('group_id', groupIds)
        .eq('day_of_week', dow),
    ])

    const groupMap = new Map((groups ?? []).map(g => [g.id, g]))
    const scheduleMap = new Map((schedules ?? []).map(s => [s.group_id, s]))
    const now = nowMinutes()

    // Build room_id → list of lesson events
    const roomEvents: Map<string, { teacherName: string; lessonType: string; start: number; end: number; startTime: string; endTime: string }[]> = new Map()

    for (const lesson of lessons) {
      const group = groupMap.get(lesson.group_id)
      const schedule = scheduleMap.get(lesson.group_id)
      if (!group || !schedule || !schedule.end_time) continue
      const roomId = teacherRoomMap.get(group.teacher_id)
      if (!roomId) continue
      const start = timeToMinutes(lesson.start_time)
      const end = timeToMinutes(schedule.end_time)
      if (!roomEvents.has(roomId)) roomEvents.set(roomId, [])
      roomEvents.get(roomId)!.push({
        teacherName: teacherMap.get(group.teacher_id) ?? 'מורה לא ידועה',
        lessonType: group.lesson_type,
        start,
        end,
        startTime: lesson.start_time.slice(0, 5),
        endTime: schedule.end_time.slice(0, 5),
      })
    }

    const newStatuses: RoomStatus[] = rooms.map(room => {
      const events = roomEvents.get(room.id) ?? []
      const current = events.find(e => now >= e.start && now < e.end)
      const next = events.filter(e => e.start > now).sort((a, b) => a.start - b.start)[0]
      return {
        room,
        teacherName: current?.teacherName ?? null,
        lessonType: current?.lessonType ?? null,
        startTime: current?.startTime ?? null,
        endTime: current?.endTime ?? null,
        isOccupied: !!current,
        nextLessonTime: next?.startTime ?? null,
      }
    })

    setStatuses(newStatuses)
    setLastUpdated(new Date())
  }, [rooms, assignments, teachers])

  useEffect(() => {
    fetchLiveData()
    const supabase = createClient()
    const today = todayStr()
    const channel = supabase
      .channel('live-rooms')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lessons',
        filter: `date=eq.${today}`,
      }, () => fetchLiveData())
      .subscribe()

    // Also refresh every minute for time-based status changes
    const timer = setInterval(fetchLiveData, 60_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [fetchLiveData])

  if (statuses.length === 0) {
    return <div className="text-sm text-gray-400 text-center py-8">טוען...</div>
  }

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {lastUpdated && (
        <p className="text-[10px] text-gray-400 text-left">
          עודכן {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      {statuses.map(s => (
        <div
          key={s.room.id}
          className={`rounded-2xl px-4 py-3 flex items-center justify-between ${
            s.isOccupied ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100'
          }`}
        >
          <div>
            <p className="font-bold text-sm text-gray-800">{s.room.name}</p>
            {s.isOccupied ? (
              <>
                <p className="text-xs text-emerald-700 font-semibold">{s.teacherName}</p>
                <p className="text-[10px] text-gray-400">{s.startTime} – {s.endTime}</p>
              </>
            ) : (
              <p className="text-xs text-gray-400">
                {s.nextLessonTime ? `שיעור הבא: ${s.nextLessonTime}` : 'פנוי כל היום'}
              </p>
            )}
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            s.isOccupied ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {s.isOccupied ? 'תפוס' : 'פנוי'}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/rooms/LiveRoomsClient.tsx
git commit -m "feat: add live room occupancy view with Supabase Realtime"
```

---

## Task 6: Teacher Read-Only View

**Files:**
- Create: `src/app/rooms/page.tsx`
- Create: `src/app/rooms/RoomBoardReadOnly.tsx`

- [ ] **Step 1: Create teacher rooms page**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'
import RoomBoardReadOnly from './RoomBoardReadOnly'
import BottomNav from '@/components/layout/BottomNav'

export default async function RoomsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: roomsRaw }, { data: assignmentsRaw }, { data: teachersRaw }] = await Promise.all([
    supabase.from('rooms').select('*').order('name'),
    supabase.from('teacher_room_assignments').select('*'),
    supabase.from('teachers').select('id, name').eq('role', 'teacher').eq('is_pending', false).order('name'),
  ])

  const rooms = (roomsRaw ?? []) as Room[]
  const assignments = (assignmentsRaw ?? []) as TeacherRoomAssignment[]
  const teachers = (teachersRaw ?? []) as Pick<Teacher, 'id' | 'name'>[]

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div>
          <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">קונסרבטוריון דימונה</p>
          <h1 className="text-xl font-bold">לוח חדרים</h1>
        </div>
      </div>
      <RoomBoardReadOnly
        rooms={rooms}
        assignments={assignments}
        teachers={teachers}
        currentUserId={user.id}
      />
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 2: Create `RoomBoardReadOnly.tsx`**

```typescript
'use client'

import { useState } from 'react'
import type { Room, TeacherRoomAssignment, Teacher } from '@/types/database'
import LiveRoomsClient from '@/app/admin/rooms/LiveRoomsClient'

const DAYS = [
  { dow: 0, label: "א׳" },
  { dow: 1, label: "ב׳" },
  { dow: 2, label: "ג׳" },
  { dow: 3, label: "ד׳" },
  { dow: 4, label: "ה׳" },
  { dow: 5, label: "ו׳" },
]

const TEACHER_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800' },
  { bg: 'bg-violet-100', text: 'text-violet-800' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-pink-100', text: 'text-pink-800' },
  { bg: 'bg-teal-100', text: 'text-teal-800' },
]

interface Props {
  rooms: Room[]
  assignments: TeacherRoomAssignment[]
  teachers: Pick<Teacher, 'id' | 'name'>[]
  currentUserId: string
}

export default function RoomBoardReadOnly({ rooms, assignments, teachers, currentUserId }: Props) {
  const [mode, setMode] = useState<'weekly' | 'live'>('weekly')

  const teacherColorMap = new Map(
    teachers.map((t, i) => [t.id, TEACHER_COLORS[i % TEACHER_COLORS.length]])
  )
  const assignmentMap = new Map(
    assignments.map(a => [`${a.room_id}-${a.day_of_week}`, a])
  )
  const teacherMap = new Map(teachers.map(t => [t.id, t.name]))

  if (rooms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-20">
        אין חדרים מוגדרים עדיין
      </div>
    )
  }

  return (
    <div className="px-4 py-5 flex flex-col gap-4" dir="rtl">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('weekly')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'weekly' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'}`}
        >
          לוח שבועי
        </button>
        <button
          onClick={() => setMode('live')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${mode === 'live' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}
        >
          ⚡ עכשיו
        </button>
      </div>

      {mode === 'live' && (
        <LiveRoomsClient rooms={rooms} assignments={assignments} teachers={teachers} />
      )}

      {mode === 'weekly' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[380px]">
              <thead>
                <tr>
                  <th className="p-2 text-xs font-bold text-gray-400 text-right border-b border-gray-100 w-24">חדר</th>
                  {DAYS.map(d => (
                    <th key={d.dow} className="p-2 text-xs font-bold text-gray-400 text-center border-b border-gray-100">{d.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.id} className="border-b border-gray-50 last:border-0">
                    <td className="p-2 text-xs font-bold text-gray-700 text-right">{room.name}</td>
                    {DAYS.map(d => {
                      const assignment = assignmentMap.get(`${room.id}-${d.dow}`)
                      const teacherName = assignment ? teacherMap.get(assignment.teacher_id) : null
                      const isMe = assignment?.teacher_id === currentUserId
                      const color = assignment ? teacherColorMap.get(assignment.teacher_id) : null
                      return (
                        <td key={d.dow} className="p-1 text-center">
                          {teacherName ? (
                            <span
                              className={`inline-block w-full rounded-lg px-1 py-2 text-[11px] font-semibold ${
                                isMe
                                  ? 'bg-violet-100 text-violet-800 ring-2 ring-violet-400'
                                  : `${color?.bg} ${color?.text}`
                              }`}
                            >
                              {isMe ? `⭐ ${teacherName}` : teacherName}
                            </span>
                          ) : (
                            <span className="text-gray-200 text-[11px]">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 text-center py-2">תא עם מסגרת סגולה = החדר שלך</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/rooms/page.tsx src/app/rooms/RoomBoardReadOnly.tsx
git commit -m "feat: add teacher read-only room board"
```

---

## Task 7: Navigation Updates

**Files:**
- Modify: `src/components/layout/AdminNav.tsx` (lines 36–93)
- Modify: `src/components/layout/BottomNav.tsx` (lines 7–41)

- [ ] **Step 1: Add "חדרים" to AdminNav**

In `src/components/layout/AdminNav.tsx`, add a new item after the `'/admin/calendar'` item in the `NAV_ITEMS` array:

```typescript
    {
      href: '/admin/rooms',
      label: 'חדרים',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <line x1="9" y1="22" x2="9" y2="12"/><line x1="15" y1="22" x2="15" y2="12"/>
          <rect x="9" y="12" width="6" height="10"/>
        </svg>
      ),
    },
```

- [ ] **Step 2: Add "חדרים" to BottomNav**

In `src/components/layout/BottomNav.tsx`, add a new item after the `'/availability'` item in the `items` array:

```typescript
  {
    href: '/rooms',
    label: 'חדרים',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#14b8a6' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <line x1="9" y1="22" x2="9" y2="12"/><line x1="15" y1="22" x2="15" y2="12"/>
        <rect x="9" y="12" width="6" height="10"/>
      </svg>
    ),
  },
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AdminNav.tsx src/components/layout/BottomNav.tsx
git commit -m "feat: add חדרים nav items to admin and teacher nav"
```

---

## Task 8: Push and Verify

- [ ] **Step 1: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 2: Push to remote (triggers Vercel deploy)**

```bash
git push
```

- [ ] **Step 3: Manual verification — Admin flow**

1. Go to `/admin/rooms`
2. Add a room (e.g., "חדר 1") → should appear in list
3. Click a cell in the weekly board → popover appears with teacher list
4. Select a teacher → cell shows teacher name
5. Click same cell again → popover with current teacher pre-selected + "הסר שיבוץ"
6. Try to assign same teacher to another room on the same day → should work (teacher can be in multiple rooms on same day — only ONE teacher per room per day is blocked)
7. Try to assign a DIFFERENT teacher to the same room+day that already has a teacher → should replace (upsert)
8. Click "עכשיו" tab → shows room occupancy cards
9. Try to delete a room with assignments → should show error "לא ניתן למחוק..."

- [ ] **Step 4: Manual verification — Teacher flow**

1. Log in as a teacher (non-admin)
2. Go to `/rooms` via bottom nav "חדרים"
3. Weekly board visible, no click handlers
4. Teacher's own room highlighted with purple ring and ⭐
5. Toggle "עכשיו" → live cards appear

---

## Self-Review Checklist

**Spec coverage:**
- ✅ rooms table + teacher_room_assignments table with UNIQUE(room_id, day_of_week) — Task 1
- ✅ TypeScript types — Task 1
- ✅ addRoom, deleteRoom, assignRoom, removeAssignment server actions — Task 2
- ✅ Admin page /admin/rooms — Task 3
- ✅ Editable board with in-place popover — Task 4
- ✅ Live view with Supabase Realtime — Task 5
- ✅ Teacher read-only view /rooms — Task 6
- ✅ Teacher's room highlighted — Task 6
- ✅ AdminNav + BottomNav updates — Task 7
- ✅ Conflict blocking (UNIQUE constraint + pre-check in deleteRoom) — Tasks 1+2

**Type consistency:** `Room`, `TeacherRoomAssignment` defined in Task 1 and used consistently throughout Tasks 2–7. `DAYS` array defined inline in both client components (same shape). `TEACHER_COLORS` duplicated in Tasks 4 and 6 — intentional (separate files, YAGNI).
