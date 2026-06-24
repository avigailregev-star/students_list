# Makeup Lesson Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a teacher cancels a lesson with a "השלמה" reason, they choose a makeup date + time; the system creates a makeup lesson record, pushes it to Google Calendar, shows it in the dashboard in purple, and deletes it automatically if the cancellation is undone.

**Architecture:** Makeup lessons are regular `lessons` rows flagged with `is_makeup = true`. The canceled lesson holds a foreign-key pointer (`makeup_lesson_id`) to its makeup. The dashboard fetches makeup lessons separately and merges them into the regular slots list. `LessonSlot` gains an `isMakeup` field so components can render them differently.

**Tech Stack:** Next.js App Router (Server Actions, Server Components), Supabase (Postgres + Storage), TypeScript, Tailwind CSS, Google Calendar API.

## Global Constraints

- RTL Hebrew UI — all user-facing strings in Hebrew.
- Tailwind only — no inline styles.
- Server Actions live in `lessonActions.ts`; fire-and-forget Google ops use `void (async () => { ... })()`.
- No new npm packages.
- `pushLesson` from `@/lib/googleCalendar` accepts `endTime` as `"HH:MM"` (`.slice(0,5)` is applied internally).
- The `group_schedules` `end_time` column is nullable; compute a 45-minute default when absent.

---

## File Map

| File | Change |
|------|--------|
| Supabase Dashboard SQL | Add 3 columns to `lessons` |
| `src/app/reports/payroll/page.tsx` | Payroll rules for makeup/current-month cancellations |
| `src/types/database.ts` | Add fields to `Lesson` and `LessonSlot` |
| `src/lib/queries/attendance.ts` | Add `getMakeupLessons()` |
| `src/app/page.tsx` | Fetch makeup slots, pass to `DashboardClient` |
| `src/components/dashboard/DashboardClient.tsx` | Accept + merge `makeupSlots` |
| `src/components/dashboard/LessonCard.tsx` | Purple styling + `?time=` in URL |
| `src/app/groups/[id]/attendance/CancelLessonButton.tsx` | Add time input |
| `src/app/groups/[id]/attendance/lessonActions.ts` | Create/delete makeup lesson + GCal |
| `src/app/groups/[id]/attendance/page.tsx` | Read `?time=`, show purple banner, hide cancel for makeup |

---

## Task 1: DB Migration + Types

**Files:**
- Modify: Supabase Dashboard → SQL Editor (manual)
- Modify: `src/types/database.ts`

**Interfaces:**
- Produces: `Lesson.is_makeup`, `Lesson.makeup_lesson_id`, `Lesson.makeup_start_time`, `LessonSlot.isMakeup`

- [ ] **Step 1: Run SQL migration in Supabase Dashboard**

Open Supabase Dashboard → SQL Editor, run:

```sql
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS is_makeup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS makeup_lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS makeup_start_time text;
```

- [ ] **Step 2: Add fields to `Lesson` type in `src/types/database.ts`**

Find the `Lesson` type (around line 63) and add three fields after `google_event_id`:

```ts
export type Lesson = {
  id: string
  group_id: string
  date: string
  start_time: string
  status: LessonStatus
  is_holiday: boolean
  holiday_name: string | null
  teacher_absence_reason: string | null
  is_sick_leave: boolean
  admin_approval_status: AdminApprovalStatus | null
  sick_leave_document_url: string | null
  cancellation_notes: string | null
  notes: string | null
  created_at: string
  google_event_id: string | null
  is_makeup: boolean
  makeup_lesson_id: string | null
  makeup_start_time: string | null
}
```

- [ ] **Step 3: Add `isMakeup` to `LessonSlot` type in `src/types/database.ts`**

Find `LessonSlot` (around line 192) and add `isMakeup`:

```ts
export type LessonSlot = {
  groupId: string
  groupName: string
  lessonType: LessonType
  isMangan: boolean
  schoolName: string | null
  grade: string | null
  date: Date
  startTime: string
  dayOfWeek: number
  isMakeup?: boolean
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd teacher-attendance-app && npx tsc --noEmit
```

Expected: no errors related to `Lesson` or `LessonSlot`.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add makeup lesson fields to Lesson and LessonSlot types"
```

---

## Task 2: getMakeupLessons + Dashboard Data Flow

**Files:**
- Modify: `src/lib/queries/attendance.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/components/dashboard/DashboardClient.tsx`

**Interfaces:**
- Consumes: `LessonSlot` (with `isMakeup?: boolean` from Task 1)
- Produces: `getMakeupLessons(): Promise<LessonSlot[]>`

- [ ] **Step 1: Add `getMakeupLessons` to `src/lib/queries/attendance.ts`**

Append after `upsertAttendance`:

```ts
export async function getMakeupLessons(): Promise<import('@/types/database').LessonSlot[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('lessons')
    .select('id, group_id, date, start_time, groups!inner(teacher_id, name, lesson_type, is_mangan_school, school_name, grade)')
    .eq('is_makeup', true)
    .eq('status', 'scheduled')
    .eq('groups.teacher_id', user.id)

  if (error || !data) return []

  return data.map((row: any) => {
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
}
```

- [ ] **Step 2: Fetch makeup slots in `src/app/page.tsx`**

Current `page.tsx` has:
```ts
const [groups, events] = await Promise.all([
  getGroupsWithSchedules(),
  getEventsForTeacher(),
])
```

Replace with:
```ts
import { getMakeupLessons } from '@/lib/queries/attendance'

// …inside HomePage:
const [groups, events, makeupSlots] = await Promise.all([
  getGroupsWithSchedules(),
  getEventsForTeacher(),
  getMakeupLessons(),
])
```

And pass to `DashboardClient`:
```tsx
<DashboardClient
  groups={groups}
  teacherName={teacher?.name ?? 'מורה'}
  events={events}
  isAdmin={isAdmin}
  makeupSlots={makeupSlots}
/>
```

- [ ] **Step 3: Accept and merge `makeupSlots` in `src/components/dashboard/DashboardClient.tsx`**

Update `Props`:
```ts
interface Props {
  groups: GroupWithSchedules[]
  teacherName: string
  events: SchoolEvent[]
  isAdmin?: boolean
  makeupSlots: LessonSlot[]
}
```

Update the component signature:
```ts
export default function DashboardClient({ groups, teacherName, events, isAdmin, makeupSlots }: Props) {
```

Merge makeup slots into `weekSlots` inside the `useMemo` (append after the deduplication filter):
```ts
const weekSlots: LessonSlot[] = useMemo(() => {
  const slots: LessonSlot[] = []
  for (let i = -4; i <= 47; i++) {
    const weekStart = getWeekStart()
    weekStart.setDate(weekStart.getDate() + i * 7)
    slots.push(...getLessonSlotsForWeek(groups, weekStart))
  }
  const seen = new Set<string>()
  const deduped = slots.filter(s => {
    const key = `${s.groupId}-${s.date.toDateString()}-${s.startTime}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  // Merge makeup slots (they have unique dates by definition)
  return [...deduped, ...makeupSlots]
}, [groups, makeupSlots])
```

- [ ] **Step 4: Verify the app compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/attendance.ts src/app/page.tsx src/components/dashboard/DashboardClient.tsx
git commit -m "feat: fetch and merge makeup lessons into dashboard slots"
```

---

## Task 3: LessonCard Purple Styling

**Files:**
- Modify: `src/components/dashboard/LessonCard.tsx`

**Interfaces:**
- Consumes: `LessonSlot.isMakeup` (from Task 1)

- [ ] **Step 1: Update `LessonCard.tsx` to style makeup lessons and include `?time=` in URL**

Replace the entire file content:

```tsx
import Link from 'next/link'
import type { LessonSlot } from '@/types/database'

interface Props {
  slot: LessonSlot
  isNext?: boolean
  hideTime?: boolean
}

export default function LessonCard({ slot, isNext, hideTime }: Props) {
  const isMakeup = slot.isMakeup === true

  const dateStr = `${slot.date.getFullYear()}-${String(slot.date.getMonth() + 1).padStart(2, '0')}-${String(slot.date.getDate()).padStart(2, '0')}`
  const href = isMakeup
    ? `/groups/${slot.groupId}/attendance?date=${dateStr}&time=${slot.startTime}`
    : `/groups/${slot.groupId}/attendance?date=${dateStr}`

  const avatarBg = isMakeup
    ? 'bg-purple-500'
    : slot.lessonType === 'group' ? 'bg-teal-500' : 'bg-violet-500'

  const ringClass = isNext ? (isMakeup ? 'ring-2 ring-purple-400' : 'ring-2 ring-teal-400') : ''

  return (
    <Link
      href={href}
      className={`bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm active:opacity-80 transition-opacity ${ringClass} ${isMakeup ? 'border border-purple-100' : ''}`}
    >
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
    </Link>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/LessonCard.tsx
git commit -m "feat: purple styling and makeup badge for makeup lessons in LessonCard"
```

---

## Task 4: CancelLessonButton Time Input

**Files:**
- Modify: `src/app/groups/[id]/attendance/CancelLessonButton.tsx`

**Interfaces:**
- Produces: `makeup_start_time` in FormData (format `"HH:MM"`)

- [ ] **Step 1: Add `makeupTime` state and time input to `CancelLessonButton.tsx`**

Add `makeupTime` state after the existing `makeupDate` state (around line 30):
```ts
const [makeupTime, setMakeupTime] = useState('')
```

Replace the existing makeup date block (the `reason.includes('השלמה')` block, around lines 161–172) with:
```tsx
{reason.includes('השלמה') && (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1">תאריך ושעת השלמה</label>
    <div className="flex gap-2">
      <input
        type="date"
        value={makeupDate}
        onChange={e => setMakeupDate(e.target.value)}
        className="flex-[2] px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
      />
      <input
        type="time"
        value={makeupTime}
        onChange={e => setMakeupTime(e.target.value)}
        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
      />
    </div>
  </div>
)}
```

In `handleSubmit`, add `makeup_start_time` to the FormData (after `fd.set('notes', makeupDate)`):
```ts
fd.set('makeup_start_time', makeupTime)
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/groups/[id]/attendance/CancelLessonButton.tsx
git commit -m "feat: add makeup time picker to cancel lesson form"
```

---

## Task 5: cancelLesson — Create Makeup Lesson + Push to GCal

**Files:**
- Modify: `src/app/groups/[id]/attendance/lessonActions.ts`

**Interfaces:**
- Consumes: `makeup_start_time` from FormData (Task 4), `pushLesson` from `@/lib/googleCalendar`

- [ ] **Step 1: Add `computeMakeupEndTime` helper at the top of `lessonActions.ts`**

Add after the imports:

```ts
function computeMakeupEndTime(makeupStart: string, schedule: { start_time: string; end_time: string | null }): string {
  if (schedule.end_time) {
    const [sh, sm] = schedule.start_time.slice(0, 5).split(':').map(Number)
    const [eh, em] = schedule.end_time.slice(0, 5).split(':').map(Number)
    const durationMin = eh * 60 + em - (sh * 60 + sm)
    const [mh, mm] = makeupStart.split(':').map(Number)
    const endMin = mh * 60 + mm + durationMin
    return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
  }
  const [mh, mm] = makeupStart.split(':').map(Number)
  const endMin = mh * 60 + mm + 45
  return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
}
```

- [ ] **Step 2: Add `pushLesson` import to `lessonActions.ts`**

Update the import from `@/lib/googleCalendar`:
```ts
import { deleteGCalEvent, pushLesson } from '@/lib/googleCalendar'
```

- [ ] **Step 3: Replace `cancelLesson` body in `lessonActions.ts`**

Replace the entire `cancelLesson` function:

```ts
export async function cancelLesson(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const lessonId = formData.get('lesson_id') as string
  const reason = formData.get('reason') as string
  const notes = formData.get('notes') as string          // makeup date "YYYY-MM-DD"
  const makeupStartTime = formData.get('makeup_start_time') as string  // "HH:MM"
  const isSickLeave = formData.get('is_sick_leave') === 'true'
  const documentUrl = formData.get('document_url') as string | null

  const hasMakeup = reason.includes('השלמה') && notes && makeupStartTime

  // Create the makeup lesson record first (so we have its ID for the update)
  let makeupLessonId: string | null = null
  if (hasMakeup) {
    const admin = createAdminClient()
    const { data: orig } = await admin
      .from('lessons')
      .select('group_id')
      .eq('id', lessonId)
      .single()

    if (orig) {
      const { data: makeupLesson, error: mkErr } = await admin
        .from('lessons')
        .insert({
          group_id: orig.group_id,
          date: notes,
          start_time: makeupStartTime + ':00',
          status: 'scheduled',
          is_makeup: true,
          teacher_absence_reason: reason,  // copied so payroll can distinguish makeup types
        })
        .select('id')
        .single()

      if (mkErr) throw new Error('שגיאה ביצירת שיעור ההשלמה')
      makeupLessonId = makeupLesson.id
    }
  }

  const { error } = await supabase
    .from('lessons')
    .update({
      status: 'teacher_canceled',
      teacher_absence_reason: reason,
      cancellation_notes: notes || null,
      makeup_start_time: makeupStartTime || null,
      makeup_lesson_id: makeupLessonId,
      is_sick_leave: isSickLeave,
      admin_approval_status: isSickLeave ? 'pending' : null,
      sick_leave_document_url: documentUrl || null,
    })
    .eq('id', lessonId)

  if (error) throw new Error('שגיאה בביטול השיעור')

  revalidatePath('/')
  revalidatePath('/groups/[id]/attendance', 'page')

  // Google Calendar operations (fire-and-forget)
  void (async () => {
    try {
      const admin = createAdminClient()
      const { data: lesson } = await admin
        .from('lessons')
        .select('google_event_id, group_id, groups(name, group_schedules(start_time, end_time))')
        .eq('id', lessonId)
        .single()

      // Delete original GCal event
      if (lesson?.google_event_id) {
        await deleteGCalEvent(user.id, lesson.google_event_id)
        await admin.from('lessons').update({ google_event_id: null }).eq('id', lessonId)
      }

      // Push makeup lesson to GCal
      if (makeupLessonId && lesson?.groups && hasMakeup) {
        const schedule = (lesson.groups as any).group_schedules?.[0] ?? { start_time: '00:00:00', end_time: null }
        const makeupEndTime = computeMakeupEndTime(makeupStartTime, schedule)
        const gcalEventId = await pushLesson(user.id, {
          id: makeupLessonId,
          groupName: `השלמה: ${(lesson.groups as any).name}`,
          date: notes,
          startTime: makeupStartTime + ':00',
          endTime: makeupEndTime,
        })
        if (gcalEventId) {
          await admin.from('lessons').update({ google_event_id: gcalEventId }).eq('id', makeupLessonId)
        }
      }
    } catch (e) {
      console.error('cancelLesson: google operations failed', e)
    }
  })()
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/groups/[id]/attendance/lessonActions.ts
git commit -m "feat: create makeup lesson record and push to Google Calendar on cancel"
```

---

## Task 6: restoreLesson — Delete Makeup Lesson + GCal Event

**Files:**
- Modify: `src/app/groups/[id]/attendance/lessonActions.ts`

**Interfaces:**
- Consumes: `makeup_lesson_id` on the original lesson row

- [ ] **Step 1: Replace `restoreLesson` body in `lessonActions.ts`**

Replace the entire `restoreLesson` function:

```ts
export async function restoreLesson(lessonId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch makeup_lesson_id before updating
  const { data: origLesson } = await supabase
    .from('lessons')
    .select('makeup_lesson_id')
    .eq('id', lessonId)
    .single()

  const makeupLessonId = origLesson?.makeup_lesson_id ?? null

  const { error } = await supabase
    .from('lessons')
    .update({
      status: 'scheduled',
      teacher_absence_reason: null,
      is_sick_leave: false,
      admin_approval_status: null,
      cancellation_notes: null,
      sick_leave_document_url: null,
      makeup_lesson_id: null,
      makeup_start_time: null,
    })
    .eq('id', lessonId)

  if (error) throw new Error('שגיאה בשחזור השיעור')

  revalidatePath('/')
  revalidatePath('/groups/[id]/attendance', 'page')

  // Delete makeup lesson + its GCal event (fire-and-forget)
  if (makeupLessonId) {
    void (async () => {
      try {
        const admin = createAdminClient()
        const { data: makeupLesson } = await admin
          .from('lessons')
          .select('google_event_id')
          .eq('id', makeupLessonId)
          .single()

        if (makeupLesson?.google_event_id) {
          await deleteGCalEvent(user.id, makeupLesson.google_event_id)
        }

        await admin.from('lessons').delete().eq('id', makeupLessonId)
      } catch (e) {
        console.error('restoreLesson: makeup cleanup failed', e)
      }
    })()
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/groups/[id]/attendance/lessonActions.ts
git commit -m "feat: delete makeup lesson and GCal event on restore"
```

---

## Task 7: Attendance Page — Makeup Lesson Banner + Hide Cancel Button

**Files:**
- Modify: `src/app/groups/[id]/attendance/page.tsx`

**Interfaces:**
- Consumes: `lesson.is_makeup`, `searchParams.time`

- [ ] **Step 1: Update `searchParams` type and read `time` param in `page.tsx`**

Update the `Props` interface (around line 13):
```ts
interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string; time?: string }>
}
```

Update the destructuring (around line 19):
```ts
const { date: dateParam, time: timeParam } = await searchParams
```

Update `startTime` derivation (around line 49) to prefer `timeParam` when provided:
```ts
const startTime = timeParam
  ? timeParam + ':00'
  : (matchingSchedule?.start_time ?? '00:00:00')
```

- [ ] **Step 2: Add reverse-lookup for original lesson date (for the banner)**

After `const isCanceled = lesson.status === 'teacher_canceled'` (around line 53), add:

```ts
let originalLessonDate: string | null = null
if (lesson.is_makeup) {
  const { data: orig } = await supabase
    .from('lessons')
    .select('date')
    .eq('makeup_lesson_id', lesson.id)
    .maybeSingle()
  originalLessonDate = orig?.date ?? null
}
```

- [ ] **Step 3: Add purple header gradient for makeup lessons**

Update `headerGradient` (around line 85):
```ts
const headerGradient = lesson.is_makeup
  ? 'from-purple-400 to-purple-600 shadow-purple-200'
  : holidayCheck.isHoliday
  ? 'from-amber-400 to-orange-500 shadow-amber-200'
  : isCanceled
  ? 'from-red-400 to-red-600 shadow-red-200'
  : 'from-teal-400 to-teal-600 shadow-teal-200'
```

- [ ] **Step 4: Add purple banner and conditionally hide cancel button**

In the JSX, find the `<div className="mb-4">` that wraps `<CancelLessonButton>` (around line 137) and replace it with:

```tsx
{lesson.is_makeup && originalLessonDate && (
  <div className="mb-4 bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3 flex items-center gap-3">
    <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center shrink-0 text-base">
      🔄
    </div>
    <div>
      <p className="text-sm font-bold text-purple-700">שיעור השלמה</p>
      <p className="text-xs text-purple-400">
        השלמה עבור שיעור {formatDateHe(new Date(originalLessonDate + 'T12:00:00'))}
      </p>
    </div>
  </div>
)}

{!lesson.is_makeup && (
  <div className="mb-4">
    <CancelLessonButton
      lessonId={lesson.id}
      isCanceled={isCanceled}
      cancelReason={lesson.teacher_absence_reason}
      cancelNotes={lesson.cancellation_notes}
      isSickLeave={lesson.is_sick_leave}
      advanceNoticeUsed={advanceNoticeUsed ?? 0}
    />
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/groups/[id]/attendance/page.tsx
git commit -m "feat: show makeup banner and hide cancel button for makeup lessons"
```

---

---

## Task 8: Payroll Logic Update

**Files:**
- Modify: `src/app/reports/payroll/page.tsx`

**Interfaces:**
- Consumes: `is_makeup` and `teacher_absence_reason` on lesson rows (Task 1 + Task 5)

- [ ] **Step 1: Update the lessons query in `payroll/page.tsx`**

Replace the current `lessons` query (around line 67) — remove `neq('status', 'teacher_canceled')` and add the needed fields:

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
    .lte('date', todayStr)
    .order('date'),
])
```

- [ ] **Step 2: Replace the lessons counting loop in `payroll/page.tsx`**

Replace the existing `for (const lesson of (lessons ?? []))` loop (around line 104) with:

```ts
for (const lesson of (lessons ?? [])) {
  const parts = lesson.date.split('-')
  const key = `${parts[0]}-${parts[1]}`
  const dayNum = parseInt(parts[2])
  const month = ensureMonth(key)

  // Makeup lesson — only count "future" makeups in the השלמות column
  if (lesson.is_makeup) {
    if (lesson.teacher_absence_reason?.includes('עתידית')) {
      month.dayCounts[dayNum].makeup++
    }
    // "תלוש נוכחי" makeup: original already counted — skip
    continue
  }

  // Canceled lesson
  if (lesson.status === 'teacher_canceled') {
    // "תלוש נוכחי": teacher makes up same month — keep in payroll as normal
    if (lesson.teacher_absence_reason === 'העדרות מורה עם השלמה בתלוש נוכחי') {
      const col = mapType(groupType.get(lesson.group_id) ?? '')
      if (col) month.dayCounts[dayNum][col]++
    }
    // All other cancellation reasons: deduct (skip)
    continue
  }

  // Regular scheduled/completed lesson
  const col = mapType(groupType.get(lesson.group_id) ?? '')
  if (col) month.dayCounts[dayNum][col]++
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual spot-check**

Open `/reports/payroll`. Verify:
- A "תלוש נוכחי" canceled lesson still appears in its type column (not deducted).
- A "עתידית" canceled lesson disappears from the count (deducted).
- A "עתידית" makeup lesson (past date) appears in the "השלמות" column.
- Sick-day count is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/reports/payroll/page.tsx
git commit -m "feat: payroll rules for makeup lessons — keep current-month cancellations, count future makeups in השלמות column"
```

---

## Final Manual Test Checklist

- [ ] Cancel a lesson with "העדרות מורה עם השלמה עתידית", pick a date + time → makeup lesson appears in dashboard in purple
- [ ] Click the makeup lesson card → opens attendance page with purple header and "שיעור השלמה" banner
- [ ] Mark attendance in the makeup lesson → works normally
- [ ] Go back to original canceled lesson → click "בטל ביטול" → makeup lesson disappears from dashboard
- [ ] Google Calendar (if connected): makeup event appears after cancel, disappears after restore
