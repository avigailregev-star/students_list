# Phase 1: Database Schema + Role-Based Access Control

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the database schema for multi-teacher/admin use and enforce role-based routing so Admins and Teachers see different dashboards.

**Architecture:** Add `role` and `hourly_rate` to teachers; add absence/status fields to lessons and attendance; add `school_events` table for the Gantt. Update `proxy.ts` to redirect admins to `/admin` and teachers to `/`. Scaffold admin layout with empty pages so routes don't 404.

**Tech Stack:** Next.js 16 App Router, Supabase (SQL Editor), TypeScript, Tailwind CSS, @supabase/ssr

---

## Task 1: Run SQL Migrations in Supabase

**Files:**
- No code files — SQL runs in Supabase Dashboard → SQL Editor

### Step 1: Open Supabase SQL Editor
Go to your Supabase project → SQL Editor → New query.

### Step 2: Run Migration 1 — Extend teachers table
```sql
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'teacher'
    CHECK (role IN ('admin', 'teacher')),
  ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT 0;
```

### Step 3: Run Migration 2 — Extend lessons table
```sql
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','teacher_canceled','holiday')),
  ADD COLUMN IF NOT EXISTS teacher_absence_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_sick_leave BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_approval_status TEXT DEFAULT NULL
    CHECK (admin_approval_status IN ('pending','approved','rejected'));
```

### Step 4: Run Migration 3 — Extend attendance table
```sql
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS student_absence_reason TEXT;
```

### Step 5: Run Migration 4 — Create school_events table (for Gantt)
```sql
CREATE TABLE IF NOT EXISTS school_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type  TEXT NOT NULL
    CHECK (event_type IN ('holiday','vacation','makeup_day','school_start','school_end')),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES teachers(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for school_events: readable by all authenticated teachers, writable only by admins
ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_teachers_read_events" ON school_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "admin_manage_events" ON school_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM teachers WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### Step 6: Make yourself Admin
Replace `your-email@example.com` with your actual login email:
```sql
UPDATE teachers
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### Step 7: Verify
```sql
SELECT id, name, email, role, hourly_rate FROM teachers;
SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'lessons' AND column_name IN ('status','teacher_absence_reason','is_sick_leave','admin_approval_status');
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'attendance' AND column_name = 'student_absence_reason';
SELECT table_name FROM information_schema.tables WHERE table_name = 'school_events';
```
Expected: your row shows `role = 'admin'`; all new columns exist.

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

### Step 1: Replace the file content
```typescript
export type Teacher = {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'admin' | 'teacher'
  hourly_rate: number
  created_at: string
}

export type Holiday = {
  id: string
  name: string
  date: string // ISO date string "YYYY-MM-DD"
  created_at: string
}

export type LessonType = 'group' | 'individual'

export type Group = {
  id: string
  teacher_id: string
  name: string
  lesson_type: LessonType
  is_mangan_school: boolean
  school_name: string | null
  grade: string | null
  created_at: string
}

export type GroupSchedule = {
  id: string
  group_id: string
  day_of_week: number // 0=Sun, 1=Mon, ..., 6=Sat
  start_time: string  // "HH:MM:SS"
  end_time: string | null
  created_at: string
}

export type Student = {
  id: string
  group_id: string
  name: string
  instrument: string | null
  parent_phone: string | null
  is_active: boolean
  created_at: string
}

export type LessonStatus = 'scheduled' | 'completed' | 'teacher_canceled' | 'holiday'
export type AdminApprovalStatus = 'pending' | 'approved' | 'rejected'

export type Lesson = {
  id: string
  group_id: string
  date: string // "YYYY-MM-DD"
  start_time: string // "HH:MM:SS"
  status: LessonStatus
  is_holiday: boolean
  holiday_name: string | null
  teacher_absence_reason: string | null
  is_sick_leave: boolean
  admin_approval_status: AdminApprovalStatus | null
  notes: string | null
  created_at: string
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export type Attendance = {
  id: string
  lesson_id: string
  student_id: string
  status: AttendanceStatus
  brought_instrument: boolean
  student_absence_reason: string | null
  created_at: string
}

export type SchoolEventType = 'holiday' | 'vacation' | 'makeup_day' | 'school_start' | 'school_end'

export type SchoolEvent = {
  id: string
  event_type: SchoolEventType
  start_date: string // "YYYY-MM-DD"
  end_date: string   // "YYYY-MM-DD"
  name: string
  created_by: string | null
  created_at: string
}

// Joined types used in queries
export type GroupWithSchedules = Group & {
  group_schedules: GroupSchedule[]
}

export type LessonSlot = {
  groupId: string
  groupName: string
  lessonType: LessonType
  isMangan: boolean
  schoolName: string | null
  grade: string | null
  date: Date
  startTime: string // "HH:MM"
  dayOfWeek: number
}
```

### Step 2: Run build to verify no type errors
```bash
cd C:\Users\HP\Desktop\list_students\teacher-attendance-app
npm run build
```
Expected: Build succeeds (new fields are optional additions, no breaking changes).

### Step 3: Commit
```bash
git add src/types/database.ts
git commit -m "feat: extend types for RBAC, lesson status, school events"
```

---

## Task 3: Update proxy.ts for Role-Based Routing

**Files:**
- Modify: `src/proxy.ts`

**Logic:**
- After auth check, fetch the teacher's role from the `teachers` table
- Admin users visiting `/` → redirect to `/admin`
- Admin users can access all routes
- Teacher users visiting `/admin/*` → redirect to `/`

### Step 1: Replace proxy.ts
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'
  const isAuthRoute = pathname.startsWith('/auth/')
  const isAdminRoute = pathname.startsWith('/admin')

  // Unauthenticated users → /login
  if (!user && !isLoginPage && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated users on login → redirect based on role
  if (user && isLoginPage) {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('role')
      .eq('id', user.id)
      .single()

    const url = request.nextUrl.clone()
    url.pathname = teacher?.role === 'admin' ? '/admin' : '/'
    return NextResponse.redirect(url)
  }

  // Role-based protection for authenticated users
  if (user && (isAdminRoute || pathname === '/')) {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = teacher?.role ?? 'teacher'

    // Admin visiting teacher home → redirect to admin
    if (role === 'admin' && pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }

    // Teacher trying to access admin → redirect to home
    if (role === 'teacher' && isAdminRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

### Step 2: Commit
```bash
git add src/proxy.ts
git commit -m "feat: role-based routing - admin→/admin, teacher→/"
```

---

## Task 4: Scaffold Admin Layout and Home Page

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/components/layout/AdminNav.tsx`

### Step 1: Create AdminNav component
`src/components/layout/AdminNav.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/admin',
    label: 'לוח בקרה',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: '/admin/teachers',
    label: 'מורים',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/admin/calendar',
    label: 'לוח שנה',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/admin/sick-leave',
    label: 'מחלות',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
  {
    href: '/admin/payroll',
    label: 'שכר',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-50 pb-safe">
      <div className="flex items-center justify-around py-2">
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-colors ${
                isActive ? 'text-teal-600 bg-teal-50' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

### Step 2: Create admin layout
`src/app/admin/layout.tsx`:
```tsx
import AdminNav from '@/components/layout/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <AdminNav />
    </div>
  )
}
```

### Step 3: Create admin home page
`src/app/admin/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify admin role
  const { data: teacher } = await supabase
    .from('teachers')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (teacher?.role !== 'admin') redirect('/')

  // Fetch summary stats
  const [{ count: teacherCount }, { count: groupCount }] = await Promise.all([
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.from('groups').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: 'מורים פעילים', value: teacherCount ?? 0, color: 'text-teal-600' },
    { label: 'קבוצות', value: groupCount ?? 0, color: 'text-violet-600' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-8">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest mb-1">ניהול בית ספר</p>
        <h1 className="text-2xl font-bold">שלום, {teacher?.name ?? 'מנהל'}</h1>
        <p className="text-sm text-teal-100 mt-0.5">לוח בקרה ראשי</p>
      </div>

      {/* Stats */}
      <div className="px-4 py-5 grid grid-cols-2 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending sick leave banner placeholder */}
      <div className="mx-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
        <div>
          <p className="text-sm font-bold text-amber-700">בקשות מחלה ממתינות</p>
          <p className="text-xs text-amber-500">תפעול בקרוב</p>
        </div>
      </div>
    </div>
  )
}
```

### Step 4: Create stub pages so admin nav links don't 404
Create `src/app/admin/teachers/page.tsx`:
```tsx
export default function AdminTeachersPage() {
  return (
    <div className="px-4 pt-10">
      <h1 className="text-xl font-bold text-gray-800">ניהול מורים</h1>
      <p className="text-gray-400 text-sm mt-2">בקרוב</p>
    </div>
  )
}
```

Create `src/app/admin/calendar/page.tsx`:
```tsx
export default function AdminCalendarPage() {
  return (
    <div className="px-4 pt-10">
      <h1 className="text-xl font-bold text-gray-800">לוח שנה שנתי</h1>
      <p className="text-gray-400 text-sm mt-2">בקרוב</p>
    </div>
  )
}
```

Create `src/app/admin/sick-leave/page.tsx`:
```tsx
export default function AdminSickLeavePage() {
  return (
    <div className="px-4 pt-10">
      <h1 className="text-xl font-bold text-gray-800">בקשות מחלה</h1>
      <p className="text-gray-400 text-sm mt-2">בקרוב</p>
    </div>
  )
}
```

Create `src/app/admin/payroll/page.tsx`:
```tsx
export default function AdminPayrollPage() {
  return (
    <div className="px-4 pt-10">
      <h1 className="text-xl font-bold text-gray-800">ניהול שכר</h1>
      <p className="text-gray-400 text-sm mt-2">בקרוב</p>
    </div>
  )
}
```

### Step 5: Build and verify
```bash
npm run build
```
Expected: Build succeeds with no errors.

### Step 6: Commit and deploy
```bash
git add .
git commit -m "feat: admin layout, nav, home page, stub routes"
git push
```

---

## Task 5: Fix getGroupsWithSchedules Security Issue

**Files:**
- Modify: `src/lib/queries/groups.ts`

The current query fetches ALL groups (no teacher_id filter), relying only on RLS. Add explicit filtering.

### Step 1: Update the query
```typescript
import { createClient } from '@/lib/supabase/server'
import type { GroupWithSchedules } from '@/types/database'

export async function getGroupsWithSchedules(): Promise<GroupWithSchedules[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('groups')
    .select('*, group_schedules(*)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as GroupWithSchedules[]
}
```

### Step 2: Commit
```bash
git add src/lib/queries/groups.ts
git commit -m "fix: filter groups by teacher_id (security)"
git push
```

---

## Verification Checklist

After deploying, test in the browser:

- [ ] Log in with your admin account → should land on `/admin`
- [ ] Admin bottom nav shows: לוח בקרה, מורים, לוח שנה, מחלות, שכר
- [ ] Each nav item loads without 404
- [ ] If you create a test teacher account (with role='teacher'), logging in → should land on `/`
- [ ] Teacher cannot access `/admin` (redirected to `/`)
- [ ] Admin stats show correct counts

---

## What Comes Next

| Plan | Content |
|------|---------|
| Phase 2 | Teacher management UI (add/edit teachers, set hourly_rate, assign role) |
| Phase 3 | Absence workflow — teacher cancellation, sick leave submission & admin approval |
| Phase 4 | Payroll calculation + monthly summary reports |
