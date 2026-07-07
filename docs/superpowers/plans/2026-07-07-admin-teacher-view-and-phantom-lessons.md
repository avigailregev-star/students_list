# Admin "View as Teacher" + Phantom Lesson Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop phantom (never-attended) lesson rows from inflating teacher attendance reports and payroll counts, and give the admin a read-only screen that shows exactly what a given teacher's dashboard/reports/group screens look like.

**Architecture:** A lesson only counts as "held" (for display and payroll) if it has at least one `attendance` row in any status. This filter is applied at three existing read sites — never at the point lessons are created — so the interactive attendance-marking flow (`/groups/[id]/attendance` and its child components) is untouched. The admin view screens are new routes under `/admin/teachers/[id]/view/*` that reuse the teacher-facing presentational components (`DashboardClient`, `ReportGroup`, `StudentList`), fed by admin-client queries scoped to the `id` route param instead of the logged-in session — the same pattern already used by `/admin/teachers/[id]/reports`.

**Tech Stack:** Next.js 16 (App Router, Server Components), Supabase (`@supabase/supabase-js`, `@supabase/ssr`), TypeScript, Tailwind CSS. No test runner is configured in this project — verification is `npx tsc --noEmit`, `npm run lint`, and manual checks via `npm run dev`.

## Global Constraints

- No automated test suite exists. Do not introduce one as part of this plan — verify with type-checking, lint, and manual dev-server checks as specified per task.
- Do not modify `getOrCreateLesson`, `AttendanceSection`, `AttendanceToggle`, `CancelLessonButton`, or `DeleteMakeupButton` — the interactive attendance-marking flow is explicitly out of scope (see spec's "Rejected fix" section).
- Every new admin route must call `requireAdmin()` (from `@/lib/auth`) as its first async action, matching the existing convention in `src/app/admin/**`.
- Hebrew is the UI language throughout — match existing copy style (see files read below) rather than inventing new phrasing conventions.
- All Supabase queries in admin routes use `createAdminClient()` from `@/lib/supabase/admin`, never `createClient()` from `@/lib/supabase/server` (which is session/RLS-scoped and would return empty results for a teacher who isn't the logged-in admin).

---

### Task 1: Shared helper — `getLessonIdsWithAttendance`

**Files:**
- Modify: `src/lib/queries/attendance.ts`

**Interfaces:**
- Produces: `getLessonIdsWithAttendance(supabase: SupabaseClient, lessonIds: string[]): Promise<Set<string>>` — used by Tasks 3 and 4 to filter lessons before counting them in payroll.

- [ ] **Step 1: Add the helper function**

Add this import at the top of `src/lib/queries/attendance.ts` (after the existing imports):

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
```

Add this function at the end of the file (after `upsertAttendance`):

```ts
export async function getLessonIdsWithAttendance(
  supabase: SupabaseClient,
  lessonIds: string[]
): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('attendance')
    .select('lesson_id')
    .in('lesson_id', lessonIds)
  if (error) throw error
  return new Set((data ?? []).map((row: { lesson_id: string }) => row.lesson_id))
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors mentioning `attendance.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/attendance.ts
git commit -m "Add getLessonIdsWithAttendance helper for phantom-lesson filtering"
```

---

### Task 2: Filter phantom lessons out of the teacher's attendance reports

**Files:**
- Modify: `src/app/reports/page.tsx:89-153`

**Interfaces:**
- Consumes: nothing new (attendance rows are already fetched in this file at line 106).

- [ ] **Step 1: Insert the filter and use it for history + counts**

In `src/app/reports/page.tsx`, find this block (around lines 104-128):

```ts
    let attendanceRows: Attendance[] = []
    if (lessonIds.length > 0) {
      const { data: att } = await supabase.from('attendance').select('*').in('lesson_id', lessonIds)
      attendanceRows = (att ?? []) as Attendance[]
    }

    const studentsWithStats = studentList.map(student => {
      const studentAtt = attendanceRows.filter(a => a.student_id === student.id)
      const history = [
        ...lessonList.map(lesson => {
          const att = studentAtt.find(a => a.lesson_id === lesson.id)
          return { date: lesson.date, status: att?.status ?? 'no_data', brought: att?.brought_instrument ?? false, isMakeup: lesson.is_makeup }
        }),
        ...canceledList.map(lesson => ({ date: lesson.date, status: 'teacher_canceled', brought: false, cancelReason: lesson.teacher_absence_reason ?? undefined })),
      ].sort((a, b) => b.date.localeCompare(a.date))

      return {
        ...student,
        total_lessons: lessonList.length,
        lessons_attended: studentAtt.filter(a => a.status === 'present' || a.status === 'late').length,
        lessons_absent: studentAtt.filter(a => a.status === 'absent').length,
        brought_instrument: studentAtt.filter(a => a.brought_instrument).length,
        history,
      }
    })
```

Replace it with:

```ts
    let attendanceRows: Attendance[] = []
    if (lessonIds.length > 0) {
      const { data: att } = await supabase.from('attendance').select('*').in('lesson_id', lessonIds)
      attendanceRows = (att ?? []) as Attendance[]
    }

    // A lesson only counts as held if at least one attendance row (any status) was recorded.
    // Lessons with zero attendance rows are "phantom" — created just by opening the attendance
    // page — and must not be shown or counted anywhere.
    const lessonIdsWithAttendance = new Set(attendanceRows.map(a => a.lesson_id))
    const heldLessonList = lessonList.filter(l => lessonIdsWithAttendance.has(l.id))

    const studentsWithStats = studentList.map(student => {
      const studentAtt = attendanceRows.filter(a => a.student_id === student.id)
      const history = [
        ...heldLessonList.map(lesson => {
          const att = studentAtt.find(a => a.lesson_id === lesson.id)
          return { date: lesson.date, status: att?.status ?? 'no_data', brought: att?.brought_instrument ?? false, isMakeup: lesson.is_makeup }
        }),
        ...canceledList.map(lesson => ({ date: lesson.date, status: 'teacher_canceled', brought: false, cancelReason: lesson.teacher_absence_reason ?? undefined })),
      ].sort((a, b) => b.date.localeCompare(a.date))

      return {
        ...student,
        total_lessons: heldLessonList.length,
        lessons_attended: studentAtt.filter(a => a.status === 'present' || a.status === 'late').length,
        lessons_absent: studentAtt.filter(a => a.status === 'absent').length,
        brought_instrument: studentAtt.filter(a => a.brought_instrument).length,
        history,
      }
    })
```

Then find this line (around line 153):

```ts
    reportData.push({ ...group, students: studentsWithEventHistory, total_lessons: lessonList.length, canceled_lessons: canceledList.length })
```

Replace `lessonList.length` with `heldLessonList.length`:

```ts
    reportData.push({ ...group, students: studentsWithEventHistory, total_lessons: heldLessonList.length, canceled_lessons: canceledList.length })
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors mentioning `reports/page.tsx`.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, then in Supabase (SQL editor or table view) confirm there is at least one `lessons` row with no matching `attendance` rows for a group you can view as a teacher (or create one by opening `/groups/[id]/attendance?date=<a past date>` for a group and navigating away without marking anyone).

Open `/reports` as that teacher and expand the group's "היסטוריית שיעורים": the phantom date must NOT appear. Mark attendance for one student on a different date and confirm that date DOES appear with the correct "X הגיעו" count.

- [ ] **Step 4: Commit**

```bash
git add src/app/reports/page.tsx
git commit -m "Exclude lessons with no attendance rows from the teacher reports screen"
```

---

### Task 3: Filter phantom lessons out of the teacher's own payroll view

**Files:**
- Modify: `src/app/reports/payroll/page.tsx:72-152`

**Interfaces:**
- Consumes: `getLessonIdsWithAttendance` from Task 1 (`@/lib/queries/attendance`).

- [ ] **Step 1: Add the import**

At the top of `src/app/reports/payroll/page.tsx`, add:

```ts
import { getLessonIdsWithAttendance } from '@/lib/queries/attendance'
```

- [ ] **Step 2: Select lesson `id` and filter before the counting loop**

Find this block (around lines 72-86):

```ts
  const [{ data: lessons }, { data: canceledLessons }] = await Promise.all([
    supabase.from('lessons')
      .select('group_id, date, status, teacher_absence_reason, is_makeup')
      .in('group_id', groupIds)
      .eq('is_holiday', false)
      .lte('date', todayStr)
      .order('date'),
    supabase.from('lessons')
      .select('date, teacher_absence_reason')
      .in('group_id', groupIds)
      .eq('status', 'teacher_canceled')
      .eq('is_holiday', false)
      .lte('date', todayStr)
      .order('date'),
  ])
```

Replace with (note `id` added to the first `select`, plus the new filter):

```ts
  const [{ data: lessons }, { data: canceledLessons }] = await Promise.all([
    supabase.from('lessons')
      .select('id, group_id, date, status, teacher_absence_reason, is_makeup')
      .in('group_id', groupIds)
      .eq('is_holiday', false)
      .lte('date', todayStr)
      .order('date'),
    supabase.from('lessons')
      .select('date, teacher_absence_reason')
      .in('group_id', groupIds)
      .eq('status', 'teacher_canceled')
      .eq('is_holiday', false)
      .lte('date', todayStr)
      .order('date'),
  ])

  // A lesson only counts toward payroll if at least one attendance row (any status) was
  // recorded — otherwise it's a phantom row created just by opening the attendance page.
  const lessonIdsWithAttendance = await getLessonIdsWithAttendance(supabase, (lessons ?? []).map(l => l.id))
  const heldLessons = (lessons ?? []).filter(l => lessonIdsWithAttendance.has(l.id))
```

- [ ] **Step 3: Use the filtered list in the counting loop**

Find (around line 116):

```ts
  for (const lesson of (lessons ?? [])) {
```

Replace with:

```ts
  for (const lesson of heldLessons) {
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors mentioning `reports/payroll/page.tsx`.

- [ ] **Step 5: Manual verification**

Using the same phantom lesson from Task 2's verification, open `/reports/payroll` as that teacher: the phantom date's lesson type column must NOT be incremented for that day. Confirm a day with real marked attendance still counts correctly.

- [ ] **Step 6: Commit**

```bash
git add src/app/reports/payroll/page.tsx
git commit -m "Exclude phantom lessons from the teacher's own payroll calculation"
```

---

### Task 4: Filter phantom lessons out of the admin's payroll view for a teacher

**Files:**
- Modify: `src/app/admin/teachers/[id]/reports/page.tsx:26-64`

**Interfaces:**
- Consumes: `getLessonIdsWithAttendance` from Task 1 (`@/lib/queries/attendance`).

- [ ] **Step 1: Add the import**

At the top of `src/app/admin/teachers/[id]/reports/page.tsx`, add:

```ts
import { getLessonIdsWithAttendance } from '@/lib/queries/attendance'
```

- [ ] **Step 2: Select lesson `id` and filter before the counting loop**

Find (around lines 50-64):

```ts
  const [{ data: lessons }, { data: canceledLessons }] = await Promise.all([
    supabase.from('lessons')
      .select('group_id, date, status, teacher_absence_reason, is_makeup')
      .in('group_id', groupIds)
      .eq('is_holiday', false)
      .lte('date', todayStr)
      .order('date'),
    supabase.from('lessons')
      .select('date, teacher_absence_reason')
      .in('group_id', groupIds)
      .eq('status', 'teacher_canceled')
      .eq('is_holiday', false)
      .lte('date', todayStr)
      .order('date'),
  ])
```

Replace with:

```ts
  const [{ data: lessons }, { data: canceledLessons }] = await Promise.all([
    supabase.from('lessons')
      .select('id, group_id, date, status, teacher_absence_reason, is_makeup')
      .in('group_id', groupIds)
      .eq('is_holiday', false)
      .lte('date', todayStr)
      .order('date'),
    supabase.from('lessons')
      .select('date, teacher_absence_reason')
      .in('group_id', groupIds)
      .eq('status', 'teacher_canceled')
      .eq('is_holiday', false)
      .lte('date', todayStr)
      .order('date'),
  ])

  // A lesson only counts toward payroll if at least one attendance row (any status) was
  // recorded — otherwise it's a phantom row created just by opening the attendance page.
  const lessonIdsWithAttendance = await getLessonIdsWithAttendance(supabase, (lessons ?? []).map(l => l.id))
  const heldLessons = (lessons ?? []).filter(l => lessonIdsWithAttendance.has(l.id))
```

- [ ] **Step 3: Use the filtered list in the counting loop**

Find (around line 94):

```ts
  for (const lesson of (lessons ?? [])) {
```

Replace with:

```ts
  for (const lesson of heldLessons) {
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors mentioning `admin/teachers/[id]/reports/page.tsx`.

- [ ] **Step 5: Manual verification**

As an admin, open `/admin/teachers/[id]/reports` for the same teacher used in Tasks 2-3 and confirm the totals match the teacher's own `/reports/payroll` view (both now exclude the phantom lesson).

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/teachers/[id]/reports/page.tsx"
git commit -m "Exclude phantom lessons from the admin payroll view"
```

---

### Task 5: Thread a `viewOnly` prop through the dashboard so lesson links can be disabled

**Files:**
- Modify: `src/components/dashboard/LessonCard.tsx`
- Modify: `src/components/dashboard/DayView.tsx`
- Modify: `src/components/dashboard/WeekView.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Interfaces:**
- Produces: `DashboardClient` gains an optional `viewOnly?: boolean` prop. When true: lesson cards are not clickable, and `BottomNav` is not rendered (the admin view pages in Task 7 render their own nav instead).

- [ ] **Step 1: Rewrite `LessonCard.tsx` to support `viewOnly`**

Replace the full contents of `src/components/dashboard/LessonCard.tsx` with:

```tsx
import Link from 'next/link'
import type { LessonSlot } from '@/types/database'

interface Props {
  slot: LessonSlot
  isNext?: boolean
  hideTime?: boolean
  viewOnly?: boolean
}

export default function LessonCard({ slot, isNext, hideTime, viewOnly }: Props) {
  const isMakeup = slot.isMakeup === true

  const dateStr = `${slot.date.getFullYear()}-${String(slot.date.getMonth() + 1).padStart(2, '0')}-${String(slot.date.getDate()).padStart(2, '0')}`
  const href = isMakeup
    ? `/groups/${slot.groupId}/attendance?date=${dateStr}&time=${slot.startTime}`
    : `/groups/${slot.groupId}/attendance?date=${dateStr}`

  const avatarBg = isMakeup
    ? 'bg-purple-500'
    : slot.lessonType === 'group' ? 'bg-teal-500' : 'bg-violet-500'

  const ringClass = isNext
    ? (isMakeup ? 'ring-2 ring-purple-400' : 'ring-2 ring-teal-400')
    : ''

  const className = `bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm ${viewOnly ? '' : 'active:opacity-80 transition-opacity'} ${ringClass} ${isMakeup ? 'border border-purple-100' : ''}`

  const content = (
    <>
      {/* Avatar */}
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-base shrink-0 ${avatarBg}`}>
        {slot.groupName.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{slot.groupName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {!hideTime && <span className="text-xs text-gray-400 font-medium">{slot.startTime}</span>}
          {isMakeup ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
              השלמה
            </span>
          ) : (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              slot.lessonType === 'group'
                ? 'bg-teal-50 text-teal-600'
                : 'bg-violet-50 text-violet-600'
            }`}>
              {slot.lessonType === 'group' ? 'קבוצה' : 'יחיד'}
            </span>
          )}
          {slot.isMangan && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
              מנגן
            </span>
          )}
        </div>
        {slot.isMangan && slot.schoolName && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
            {slot.schoolName}{slot.grade ? ` · כיתה ${slot.grade}` : ''}
          </p>
        )}
      </div>

      {/* Attendance indicator */}
      <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${
        isNext ? (isMakeup ? 'bg-purple-500' : 'bg-teal-500') : 'bg-gray-100'
      }`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isNext ? 'white' : '#6b7280'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </>
  )

  if (viewOnly) {
    return <div className={className}>{content}</div>
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  )
}
```

- [ ] **Step 2: Thread `viewOnly` through `DayView.tsx`**

In `src/components/dashboard/DayView.tsx`, update the `Props` interface (around line 9-14):

```ts
interface Props {
  allSlots: LessonSlot[]
  /** Only read at mount. Safe because the component is conditionally rendered and remounts on each tab switch. */
  initialDate?: Date
  events: SchoolEvent[]
  viewOnly?: boolean
}
```

Update the function signature (around line 16):

```ts
export default function DayView({ allSlots, initialDate, events, viewOnly }: Props) {
```

Find the `<LessonCard>` usage (around line 123):

```tsx
                  <LessonCard slot={slot} isNext={isNext} hideTime />
```

Replace with:

```tsx
                  <LessonCard slot={slot} isNext={isNext} hideTime viewOnly={viewOnly} />
```

- [ ] **Step 3: Thread `viewOnly` through `WeekView.tsx`**

In `src/components/dashboard/WeekView.tsx`, update the `Props` interface (around line 9-12):

```ts
interface Props {
  allSlots: LessonSlot[]
  events: SchoolEvent[]
  viewOnly?: boolean
}
```

Update the function signature (around line 16):

```ts
export default function WeekView({ allSlots, events, viewOnly }: Props) {
```

Find the `<LessonCard>` usage (around lines 69-74):

```tsx
              {slots.map(slot => (
                <LessonCard
                  key={`${slot.groupId}-${slot.startTime}`}
                  slot={slot}
                />
              ))}
```

Replace with:

```tsx
              {slots.map(slot => (
                <LessonCard
                  key={`${slot.groupId}-${slot.startTime}`}
                  slot={slot}
                  viewOnly={viewOnly}
                />
              ))}
```

- [ ] **Step 4: Thread `viewOnly` through `DashboardClient.tsx` and hide `BottomNav`**

In `src/components/dashboard/DashboardClient.tsx`, update the `Props` interface (around lines 13-20):

```ts
interface Props {
  groups: GroupWithSchedules[]
  teacherName: string
  events: SchoolEvent[]
  isAdmin?: boolean
  makeupSlots: LessonSlot[]
  userId?: string
  viewOnly?: boolean
}
```

Update the function signature (around line 22):

```ts
export default function DashboardClient({ groups, teacherName, events, isAdmin, makeupSlots, userId, viewOnly }: Props) {
```

Find the content section (around lines 85-95):

```tsx
      {/* Content */}
      <div className="flex-1 px-4 py-5 pb-28 overflow-y-auto">
        {view === 'day' && <DayView allSlots={weekSlots} initialDate={dayInitialDate} events={events} />}
        {view === 'week' && <WeekView allSlots={weekSlots} events={events} />}
        {view === 'month' && (
          <MonthView
            groups={groups}
            events={events}
            onDayClick={handleMonthDayClick}
          />
        )}
      </div>

      <BottomNav isAdmin={isAdmin} userId={userId} />
```

Replace with:

```tsx
      {/* Content */}
      <div className="flex-1 px-4 py-5 pb-28 overflow-y-auto">
        {view === 'day' && <DayView allSlots={weekSlots} initialDate={dayInitialDate} events={events} viewOnly={viewOnly} />}
        {view === 'week' && <WeekView allSlots={weekSlots} events={events} viewOnly={viewOnly} />}
        {view === 'month' && (
          <MonthView
            groups={groups}
            events={events}
            onDayClick={handleMonthDayClick}
          />
        )}
      </div>

      {!viewOnly && <BottomNav isAdmin={isAdmin} userId={userId} />}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors in any of the four modified files.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open `/` as a teacher with at least one group. Confirm day/week views look and behave exactly as before (this task only adds an optional prop that defaults to `undefined`/falsy — no visual change when unset).

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/LessonCard.tsx src/components/dashboard/DayView.tsx src/components/dashboard/WeekView.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "Add viewOnly prop to dashboard components for the admin view-as-teacher screen"
```

---

### Task 6: Add `viewOnly` to `VacationSection` to hide the request form

**Files:**
- Modify: `src/app/reports/VacationSection.tsx`

**Interfaces:**
- Produces: `VacationSection` gains an optional `viewOnly?: boolean` prop. When true, the "+ בקשי חופשה" button (and therefore the request form, which only opens via that button) is not rendered; the existing requests list still shows.

- [ ] **Step 1: Add the prop and guard the button**

In `src/app/reports/VacationSection.tsx`, update the `Props` interface (around lines 9-11):

```ts
interface Props {
  initialRequests: VacationRequest[]
  viewOnly?: boolean
}
```

Update the function signature (around line 21):

```ts
export default function VacationSection({ initialRequests, viewOnly }: Props) {
```

Find (around lines 44-51):

```tsx
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 transition-colors"
          >
            + בקשי חופשה
          </button>
        )}
```

Replace with:

```tsx
        {!open && !viewOnly && (
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 transition-colors"
          >
            + בקשי חופשה
          </button>
        )}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors mentioning `VacationSection.tsx`.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `/reports` as a teacher: confirm the "+ בקשי חופשה" button still appears (prop defaults to falsy, no behavior change).

- [ ] **Step 4: Commit**

```bash
git add src/app/reports/VacationSection.tsx
git commit -m "Add viewOnly prop to VacationSection"
```

---

### Task 7: Shared view-mode components + admin dashboard view page

**Files:**
- Create: `src/app/admin/teachers/[id]/view/ViewOnlyBanner.tsx`
- Create: `src/app/admin/teachers/[id]/view/ViewNav.tsx`
- Create: `src/app/admin/teachers/[id]/view/page.tsx`

**Interfaces:**
- Produces: `ViewOnlyBanner({ teacherId: string })` and `ViewNav({ teacherId: string })`, reused by Tasks 8 and 9.
- Consumes: `DashboardClient` (from `@/components/dashboard/DashboardClient`, with the `viewOnly` prop added in Task 5), `getLessonSlotsForWeek`/`getWeekStart` (from `@/lib/utils/schedule`, unchanged pure functions), `requireAdmin` (from `@/lib/auth`), `createAdminClient` (from `@/lib/supabase/admin`).

- [ ] **Step 1: Create `ViewOnlyBanner.tsx`**

```tsx
import Link from 'next/link'

export default function ViewOnlyBanner({ teacherId }: { teacherId: string }) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs font-bold text-amber-700">
      <span>מצב צפייה — קריאה בלבד</span>
      <Link href={`/admin/teachers/${teacherId}`} className="underline hover:text-amber-900">
        חזרה לאדמין
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Create `ViewNav.tsx`**

```tsx
import Link from 'next/link'

export default function ViewNav({ teacherId }: { teacherId: string }) {
  return (
    <nav className="fixed bottom-0 right-0 left-0 bg-white border-t border-gray-100 flex justify-around px-2 py-3 pb-safe z-50">
      <Link
        href={`/admin/teachers/${teacherId}/view`}
        className="flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-2xl hover:bg-teal-50 transition-colors"
      >
        <span className="text-xs font-bold text-gray-600">דשבורד</span>
      </Link>
      <Link
        href={`/admin/teachers/${teacherId}/view/reports`}
        className="flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-2xl hover:bg-teal-50 transition-colors"
      >
        <span className="text-xs font-bold text-gray-600">דוחות</span>
      </Link>
      <Link
        href={`/admin/teachers/${teacherId}`}
        className="flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-2xl hover:bg-teal-50 transition-colors"
      >
        <span className="text-xs font-bold text-teal-600">חזרה לאדמין</span>
      </Link>
    </nav>
  )
}
```

- [ ] **Step 3: Create the dashboard view page**

```tsx
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import DashboardClient from '@/components/dashboard/DashboardClient'
import ViewOnlyBanner from './ViewOnlyBanner'
import ViewNav from './ViewNav'
import type { GroupWithSchedules, LessonSlot, SchoolEvent } from '@/types/database'

interface Props { params: Promise<{ id: string }> }

export default async function AdminTeacherViewDashboardPage({ params }: Props) {
  const { id } = await params
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: teacher } = await supabase.from('teachers').select('name').eq('id', id).single()
  if (!teacher) notFound()

  const [{ data: groupsRaw }, { data: autoEvents }, { data: assignedRows }] = await Promise.all([
    supabase.from('groups').select('*, group_schedules(*)').eq('teacher_id', id).order('created_at', { ascending: true }),
    supabase.from('school_events').select('*').in('event_type', ['holiday', 'vacation']),
    supabase.from('school_event_assignments').select('event_id').eq('teacher_id', id),
  ])

  const groups = (groupsRaw ?? []) as GroupWithSchedules[]

  const assignedIds = (assignedRows ?? []).map((r: { event_id: string }) => r.event_id)
  let assignedEvents: SchoolEvent[] = []
  if (assignedIds.length > 0) {
    const { data } = await supabase.from('school_events').select('*').in('id', assignedIds)
    assignedEvents = (data ?? []) as SchoolEvent[]
  }
  const seenEventIds = new Set<string>()
  const events: SchoolEvent[] = []
  for (const ev of [...((autoEvents ?? []) as SchoolEvent[]), ...assignedEvents]) {
    if (!seenEventIds.has(ev.id)) {
      seenEventIds.add(ev.id)
      events.push(ev)
    }
  }

  const { data: makeupRows } = await supabase
    .from('lessons')
    .select('id, group_id, date, start_time, groups!inner(teacher_id, name, lesson_type, is_mangan_school, school_name, grade)')
    .eq('is_makeup', true)
    .eq('status', 'scheduled')
    .eq('groups.teacher_id', id)

  const makeupSlots: LessonSlot[] = (makeupRows ?? []).map((row: any) => {
    const d = new Date(row.date + 'T12:00:00')
    return {
      groupId: row.group_id,
      groupName: row.groups.name,
      lessonType: row.groups.lesson_type,
      isMangan: row.groups.is_mangan_school,
      schoolName: row.groups.school_name,
      grade: row.groups.grade,
      date: d,
      startTime: row.start_time.slice(0, 5),
      dayOfWeek: d.getDay(),
      isMakeup: true,
    }
  })

  return (
    <>
      <ViewOnlyBanner teacherId={id} />
      <DashboardClient
        groups={groups}
        teacherName={teacher.name}
        events={events}
        makeupSlots={makeupSlots}
        viewOnly
      />
      <ViewNav teacherId={id} />
    </>
  )
}
```

Note: this page intentionally does not replicate `getEventsForTeacher`'s graceful fallback when `school_event_assignments` errors (that table is assumed present, matching every other admin route in this codebase).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning the three new files.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. As an admin, navigate to `/admin/teachers/[id]/view` for a teacher with at least one group. Confirm:
- The amber "מצב צפייה — קריאה בלבד" banner shows at the top with a working "חזרה לאדמין" link.
- The day/week/month views render the same lessons the teacher sees on their own `/`.
- Clicking a lesson card does nothing (no navigation) — confirms `viewOnly` disabled the link.
- The bottom nav shows "דשבורד" / "דוחות" / "חזרה לאדמין" (not the teacher's real bottom nav with sign-out).

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/teachers/[id]/view/ViewOnlyBanner.tsx" "src/app/admin/teachers/[id]/view/ViewNav.tsx" "src/app/admin/teachers/[id]/view/page.tsx"
git commit -m "Add admin view-as-teacher dashboard screen"
```

---

### Task 8: Admin reports view page

**Files:**
- Create: `src/app/admin/teachers/[id]/view/reports/page.tsx`

**Interfaces:**
- Consumes: `ReportGroup` (from `@/app/reports/ReportGroup`, unchanged), `VacationSection` (from `@/app/reports/VacationSection`, with `viewOnly` from Task 6), `ViewOnlyBanner`/`ViewNav` (from Task 7).

- [ ] **Step 1: Create the reports view page**

```tsx
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Group, Student, Lesson, Attendance, SchoolEventType, VacationRequest } from '@/types/database'
import ReportGroup from '@/app/reports/ReportGroup'
import VacationSection from '@/app/reports/VacationSection'
import ViewOnlyBanner from '../ViewOnlyBanner'
import ViewNav from '../ViewNav'

type HistoryEntry = {
  date: string
  status: string
  brought: boolean
  eventType?: SchoolEventType
  eventName?: string
  cancelReason?: string
  isMakeup?: boolean
}

type GroupWithData = Group & {
  students: (Student & {
    lessons_attended: number
    lessons_absent: number
    brought_instrument: number
    total_lessons: number
    history: HistoryEntry[]
  })[]
  total_lessons: number
  canceled_lessons: number
}

interface Props { params: Promise<{ id: string }> }

export default async function AdminTeacherViewReportsPage({ params }: Props) {
  const { id } = await params
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: teacher } = await supabase.from('teachers').select('name').eq('id', id).single()
  if (!teacher) notFound()

  const { data: vacationsRaw } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('teacher_id', id)
    .order('created_at', { ascending: false })
  const vacationRequests = (vacationsRaw ?? []) as VacationRequest[]

  const { data: groups } = await supabase
    .from('groups')
    .select('*, group_schedules(*)')
    .eq('teacher_id', id)
    .order('created_at')

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const reportData: GroupWithData[] = []

  for (const group of (groups ?? []) as Group[]) {
    const [{ data: lessons }, { data: canceled }] = await Promise.all([
      supabase.from('lessons').select('*').eq('group_id', group.id).eq('is_holiday', false).neq('status', 'teacher_canceled').lte('date', todayStr).order('date', { ascending: false }),
      supabase.from('lessons').select('id, date, teacher_absence_reason').eq('group_id', group.id).eq('status', 'teacher_canceled').lte('date', todayStr).order('date', { ascending: false }),
    ])

    const lessonList = (lessons ?? []) as Lesson[]
    const canceledList = (canceled ?? []) as { id: string; date: string; teacher_absence_reason: string | null }[]
    const lessonIds = lessonList.map(l => l.id)

    const { data: students } = await supabase
      .from('students').select('*').eq('group_id', group.id).eq('is_active', true).order('name')

    const studentList = (students ?? []) as Student[]

    let attendanceRows: Attendance[] = []
    if (lessonIds.length > 0) {
      const { data: att } = await supabase.from('attendance').select('*').in('lesson_id', lessonIds)
      attendanceRows = (att ?? []) as Attendance[]
    }

    const lessonIdsWithAttendance = new Set(attendanceRows.map(a => a.lesson_id))
    const heldLessonList = lessonList.filter(l => lessonIdsWithAttendance.has(l.id))

    const studentsWithStats = studentList.map(student => {
      const studentAtt = attendanceRows.filter(a => a.student_id === student.id)
      const history = [
        ...heldLessonList.map(lesson => {
          const att = studentAtt.find(a => a.lesson_id === lesson.id)
          return { date: lesson.date, status: att?.status ?? 'no_data', brought: att?.brought_instrument ?? false, isMakeup: lesson.is_makeup }
        }),
        ...canceledList.map(lesson => ({ date: lesson.date, status: 'teacher_canceled', brought: false, cancelReason: lesson.teacher_absence_reason ?? undefined })),
      ].sort((a, b) => b.date.localeCompare(a.date))

      return {
        ...student,
        total_lessons: heldLessonList.length,
        lessons_attended: studentAtt.filter(a => a.status === 'present' || a.status === 'late').length,
        lessons_absent: studentAtt.filter(a => a.status === 'absent').length,
        brought_instrument: studentAtt.filter(a => a.brought_instrument).length,
        history,
      }
    })

    reportData.push({ ...group, students: studentsWithStats, total_lessons: heldLessonList.length, canceled_lessons: canceledList.length })
  }

  reportData.sort((a, b) => {
    const dayA = (a as GroupWithData & { group_schedules?: { day_of_week: number }[] }).group_schedules?.[0]?.day_of_week ?? 7
    const dayB = (b as GroupWithData & { group_schedules?: { day_of_week: number }[] }).group_schedules?.[0]?.day_of_week ?? 7
    return dayA - dayB
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <ViewOnlyBanner teacherId={id} />
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">סטטיסטיקות</p>
        <h1 className="text-2xl font-bold">דוחות נוכחות — {teacher.name}</h1>
        <p className="text-sm text-teal-100 mt-0.5">{(groups ?? []).length} קבוצות</p>
      </div>

      <div className="px-4 py-5 max-w-md mx-auto w-full flex flex-col gap-4">
        {reportData.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">אין קבוצות</p>
        )}
        {reportData.map(group => (
          <ReportGroup key={group.id} group={group} />
        ))}
      </div>

      <VacationSection initialRequests={vacationRequests} viewOnly />
      <ViewNav teacherId={id} />
    </div>
  )
}
```

Note: school-event history entries (the merged holiday/event banners in the teacher's own `/reports`) are intentionally omitted here to keep this page focused on attendance data — the same simplification decision as the group-detail view in Task 9. This does not affect correctness of what's being verified (phantom lesson filtering, and read-only access to the teacher's real data).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning the new file.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. As an admin, navigate to `/admin/teachers/[id]/view/reports` for the same teacher used in Task 2. Confirm:
- Group cards and per-student stats match what that teacher sees on their own `/reports`.
- The phantom lesson from Task 2 does not appear here either.
- The "+ בקשי חופשה" button is NOT present (existing vacation requests still list, if any).

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/teachers/[id]/view/reports/page.tsx"
git commit -m "Add admin view-as-teacher reports screen"
```

---

### Task 9: Admin group detail view page

**Files:**
- Create: `src/app/admin/teachers/[id]/view/groups/[groupId]/page.tsx`

**Interfaces:**
- Consumes: `StudentList` (from `@/components/students/StudentList`, unchanged — already supports `readOnly`), `ViewOnlyBanner`/`ViewNav` (from Task 7).

- [ ] **Step 1: Create the group detail view page**

```tsx
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import StudentList from '@/components/students/StudentList'
import type { Group, GroupSchedule, Student } from '@/types/database'
import { DAYS_HE } from '@/lib/utils/hebrew'
import ViewOnlyBanner from '../../ViewOnlyBanner'
import ViewNav from '../../ViewNav'

interface Props {
  params: Promise<{ id: string; groupId: string }>
}

export default async function AdminTeacherViewGroupPage({ params }: Props) {
  const { id, groupId } = await params
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: group, error } = await supabase
    .from('groups')
    .select('*, group_schedules(*)')
    .eq('id', groupId)
    .eq('teacher_id', id)
    .single()

  if (error || !group) notFound()

  const typedGroup = group as Group & { group_schedules: GroupSchedule[] }

  const { data: studentsRaw } = await supabase
    .from('students')
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('name')
  const students = (studentsRaw ?? []) as Student[]

  const headerColor = typedGroup.lesson_type === 'group'
    ? 'from-teal-400 to-teal-600 shadow-teal-200'
    : 'from-violet-400 to-violet-600 shadow-violet-200'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <ViewOnlyBanner teacherId={id} />
      <div className={`bg-gradient-to-bl ${headerColor} text-white rounded-b-[36px] shadow-lg px-5 pt-8 pb-6`}>
        <h1 className="text-xl font-bold truncate">{typedGroup.name}</h1>
        <p className="text-sm text-white/70 mt-0.5">
          {typedGroup.lesson_type === 'group' ? 'קבוצה' : 'שיעור יחיד'}
          {typedGroup.is_mangan_school && typedGroup.school_name && (
            <> · {typedGroup.school_name}{typedGroup.grade ? ` כיתה ${typedGroup.grade}` : ''}</>
          )}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {typedGroup.group_schedules.map(s => (
            <span key={s.id} className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-xl">
              {DAYS_HE[s.day_of_week]} · {s.start_time.slice(0, 5)}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 max-w-md mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-sm py-3.5 text-center mb-5">
          <p className="text-2xl font-bold text-teal-500">{students.length}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">תלמידים</p>
        </div>

        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">תלמידים</h2>
        <StudentList students={students} groupId={groupId} readOnly />
      </div>

      <ViewNav teacherId={id} />
    </div>
  )
}
```

Note: there is intentionally no "סמן נוכחות" (mark attendance) link on this page at all — omitted entirely rather than rendered disabled, since it would otherwise be the one remaining path from the view-mode screens into the live mutating attendance flow.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors mentioning the new file.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. From `/admin/teachers/[id]/view`, click a lesson card... note it won't navigate (Task 7 verification already covered this). Instead, directly visit `/admin/teachers/[id]/view/groups/[groupId]` for a real group ID belonging to that teacher. Confirm:
- Group name, schedule badges, and student count match the teacher's own `/groups/[id]` view.
- Student list renders with no delete/edit controls (readOnly).
- There is no "סמן נוכחות" button anywhere on the page.
- Visiting a `groupId` that does NOT belong to teacher `id` returns a 404 (not another teacher's data).

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/teachers/[id]/view/groups/[groupId]/page.tsx"
git commit -m "Add admin view-as-teacher group detail screen"
```

---

### Task 10: Entry point button on the admin teacher page

**Files:**
- Modify: `src/app/admin/teachers/[id]/page.tsx`

**Interfaces:**
- Consumes: the route created in Task 7 (`/admin/teachers/[id]/view`).

- [ ] **Step 1: Add the button**

In `src/app/admin/teachers/[id]/page.tsx`, find the existing "חשבות שכר לפי חודשים" link (around lines 125-134):

```tsx
        <Link
          href={`/admin/teachers/${teacher.id}/reports`}
          className="flex items-center justify-center gap-2 w-full py-3 bg-violet-50 border border-violet-200 text-violet-700 font-bold text-sm rounded-2xl hover:bg-violet-100 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          חשבות שכר לפי חודשים
        </Link>
```

Add this new `Link` directly after it (still before the `{!(teacher.is_pending ?? false) && (` block):

```tsx
        <Link
          href={`/admin/teachers/${teacher.id}/view`}
          className="flex items-center justify-center gap-2 w-full py-3 bg-teal-50 border border-teal-200 text-teal-700 font-bold text-sm rounded-2xl hover:bg-teal-100 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          צפייה כמורה
        </Link>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors mentioning `admin/teachers/[id]/page.tsx`.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. As an admin, open `/admin/teachers/[id]` for any teacher. Confirm the new "צפייה כמורה" button appears below "חשבות שכר לפי חודשים" and navigates to `/admin/teachers/[id]/view`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/teachers/[id]/page.tsx"
git commit -m "Add view-as-teacher entry point to the admin teacher page"
```
