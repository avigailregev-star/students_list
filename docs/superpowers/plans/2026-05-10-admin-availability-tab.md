# Admin Availability Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "זמינות" tab to the admin teacher detail page that shows the teacher's availability ranges, which groups are scheduled within each range, and allows the admin to create a new group pre-filled with the range's day and start time.

**Architecture:** Three small, sequential changes — first extend `AdminGroupSheet` to accept optional default values, then add the availability tab UI to `AdminTeacherTabs`, then wire up the data fetch in `page.tsx`. No schema changes required; `teacher_availability_ranges` already exists and `createAdminClient` bypasses RLS.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, Supabase (admin client for server component)

---

## File Map

| File | Change |
|------|--------|
| `src/app/admin/teachers/[id]/AdminGroupSheet.tsx` | Add `defaultDayOfWeek?: number` and `defaultStartTime?: string` props; use as fallback initial state |
| `src/app/admin/teachers/[id]/AdminTeacherTabs.tsx` | Add `ranges: TeacherAvailabilityRange[]` prop; add 'availability' tab with range cards + group matching |
| `src/app/admin/teachers/[id]/page.tsx` | Fetch `teacher_availability_ranges` for the teacher; pass `ranges` to `AdminTeacherTabs` |

---

## Task 1: AdminGroupSheet — accept default day and start time

**Files:**
- Modify: `src/app/admin/teachers/[id]/AdminGroupSheet.tsx`

The sheet is used both for creating and editing a group. When opened from the availability tab, we want day and start time pre-filled. We add two optional props and use them as fallback initial state (only when `group` is undefined, i.e. create mode).

- [ ] **Step 1: Add props and update state initialization**

Replace the `Props` interface and the two `useState` lines for `dayOfWeek` and `startTime`:

```typescript
// Old Props interface (lines 9-14):
interface Props {
  teacherId: string
  group?: GroupWithSchedulesAndStudents
  isOpen: boolean
  onClose: () => void
}

// New Props interface:
interface Props {
  teacherId: string
  group?: GroupWithSchedulesAndStudents
  isOpen: boolean
  onClose: () => void
  defaultDayOfWeek?: number
  defaultStartTime?: string
}
```

Update the component signature to destructure the new props:

```typescript
// Old:
export default function AdminGroupSheet({ teacherId, group, isOpen, onClose }: Props) {

// New:
export default function AdminGroupSheet({ teacherId, group, isOpen, onClose, defaultDayOfWeek, defaultStartTime }: Props) {
```

Update the two `useState` lines that initialize `dayOfWeek` and `startTime`:

```typescript
// Old:
const [dayOfWeek, setDayOfWeek] = useState<number>(schedule?.day_of_week ?? 0)
const [startTime, setStartTime] = useState(schedule?.start_time?.slice(0, 5) ?? '')

// New:
const [dayOfWeek, setDayOfWeek] = useState<number>(schedule?.day_of_week ?? defaultDayOfWeek ?? 0)
const [startTime, setStartTime] = useState(schedule?.start_time?.slice(0, 5) ?? defaultStartTime ?? '')
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd teacher-attendance-app && npx tsc --noEmit
```

Expected: no errors related to AdminGroupSheet.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/teachers/[id]/AdminGroupSheet.tsx
git commit -m "feat: AdminGroupSheet accepts defaultDayOfWeek and defaultStartTime props"
```

---

## Task 2: AdminTeacherTabs — availability tab

**Files:**
- Modify: `src/app/admin/teachers/[id]/AdminTeacherTabs.tsx`

Add a third tab "זמינות" that lists the teacher's availability ranges. Each range card shows its day + hours header, the groups already scheduled within it (matched by day_of_week and start_time falling inside the range), and a "+ שבץ שיעור" button that opens AdminGroupSheet with the range's day and start time pre-filled.

- [ ] **Step 1: Update imports and Props**

At the top of the file, the current import for types is:
```typescript
import type { GroupWithSchedulesAndStudents } from '@/types/database'
```

Replace with:
```typescript
import type { GroupWithSchedulesAndStudents, TeacherAvailabilityRange } from '@/types/database'
```

Replace the `Props` interface:
```typescript
// Old:
interface Props {
  teacherId: string
  groups: GroupWithSchedulesAndStudents[]
  completedLessons: number
  canceledLessons: number
}

// New:
interface Props {
  teacherId: string
  groups: GroupWithSchedulesAndStudents[]
  ranges: TeacherAvailabilityRange[]
  completedLessons: number
  canceledLessons: number
}
```

Update the component signature:
```typescript
// Old:
export default function AdminTeacherTabs({ teacherId, groups, completedLessons, canceledLessons }: Props) {

// New:
export default function AdminTeacherTabs({ teacherId, groups, ranges, completedLessons, canceledLessons }: Props) {
```

- [ ] **Step 2: Update state and openCreate**

Replace the `activeTab` state and `sheetOpen`/`editingGroup` state declarations, and the `openCreate` function:

```typescript
// Old:
const [activeTab, setActiveTab] = useState<'groups' | 'stats'>('groups')
const [sheetOpen, setSheetOpen] = useState(false)
const [editingGroup, setEditingGroup] = useState<GroupWithSchedulesAndStudents | undefined>()

// New:
const [activeTab, setActiveTab] = useState<'groups' | 'availability' | 'stats'>('groups')
const [sheetOpen, setSheetOpen] = useState(false)
const [editingGroup, setEditingGroup] = useState<GroupWithSchedulesAndStudents | undefined>()
const [sheetDefaults, setSheetDefaults] = useState<{ dayOfWeek?: number; startTime?: string }>({})
```

Replace the `openCreate` function:
```typescript
// Old:
function openCreate() {
  setEditingGroup(undefined)
  setSheetOpen(true)
}

// New:
function openCreate(defaults?: { dayOfWeek?: number; startTime?: string }) {
  setEditingGroup(undefined)
  setSheetDefaults(defaults ?? {})
  setSheetOpen(true)
}
```

- [ ] **Step 3: Update tab bar to include 'availability'**

Replace the tab bar `map` call. The current code renders two tabs from `['groups', 'stats']`. Replace with:

```typescript
// Old:
{(['groups', 'stats'] as const).map(tab => (
  <button
    key={tab}
    onClick={() => setActiveTab(tab)}
    className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors ${
      activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
    }`}
  >
    {tab === 'groups' ? 'קבוצות' : 'סטטיסטיקות'}
  </button>
))}

// New:
{(['groups', 'availability', 'stats'] as const).map(tab => (
  <button
    key={tab}
    onClick={() => setActiveTab(tab)}
    className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors ${
      activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
    }`}
  >
    {tab === 'groups' ? 'קבוצות' : tab === 'availability' ? 'זמינות' : 'סטטיסטיקות'}
  </button>
))}
```

- [ ] **Step 4: Add availability tab content**

After the closing `}` of the groups tab block (`{activeTab === 'groups' && ( ... )}`), add the availability tab block. Place it between the groups tab and the stats tab:

```tsx
{/* Availability tab */}
{activeTab === 'availability' && (
  <div className="flex flex-col gap-3">
    {ranges.length === 0 && (
      <p className="text-sm text-gray-400 text-center py-4">המורה לא הגדיר טווחי זמינות עדיין.</p>
    )}
    {ranges.map(range => {
      const matched = groups.filter(g => {
        const sched = g.group_schedules?.[0]
        if (!sched) return false
        return (
          sched.day_of_week === range.day_of_week &&
          sched.start_time >= range.start_time &&
          sched.start_time < range.end_time
        )
      })
      return (
        <div key={range.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 bg-green-50 border-b border-green-100">
            <div>
              <span className="text-sm font-bold text-green-900">{DAYS_HE[range.day_of_week]}</span>
              <span className="text-xs text-green-700 mr-2">{range.start_time.slice(0, 5)} – {range.end_time.slice(0, 5)}</span>
            </div>
            <button
              onClick={() => openCreate({ dayOfWeek: range.day_of_week, startTime: range.start_time.slice(0, 5) })}
              className="bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-teal-600 transition-colors"
            >
              + שבץ שיעור
            </button>
          </div>
          <div className="px-4 py-3 flex flex-col gap-2">
            {matched.length === 0 && (
              <p className="text-xs text-gray-400 italic">אין שיעורים משובצים בטווח זה</p>
            )}
            {matched.map(g => {
              const cfg = LESSON_TYPE_CONFIG[g.lesson_type]
              const sched = g.group_schedules[0]
              return (
                <div key={g.id} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg?.bg ?? 'bg-gray-400'}`} />
                  <span className="text-sm font-semibold text-gray-800">{g.name}</span>
                  <span className="text-xs text-gray-400">
                    {sched.start_time.slice(0, 5)}{sched.end_time ? `–${sched.end_time.slice(0, 5)}` : ''} · {g.students?.length ?? 0} תלמידים
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )
    })}
  </div>
)}
```

- [ ] **Step 5: Pass sheet defaults to AdminGroupSheet**

Find the `<AdminGroupSheet ... />` at the bottom of the component. Add the two new props:

```tsx
// Old:
<AdminGroupSheet
  key={editingGroup?.id ?? 'new'}
  teacherId={teacherId}
  group={editingGroup}
  isOpen={sheetOpen}
  onClose={() => setSheetOpen(false)}
/>

// New:
<AdminGroupSheet
  key={editingGroup?.id ?? 'new'}
  teacherId={teacherId}
  group={editingGroup}
  isOpen={sheetOpen}
  onClose={() => setSheetOpen(false)}
  defaultDayOfWeek={sheetDefaults.dayOfWeek}
  defaultStartTime={sheetDefaults.startTime}
/>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/teachers/[id]/AdminTeacherTabs.tsx
git commit -m "feat: add availability tab to admin teacher detail page"
```

---

## Task 3: page.tsx — fetch and pass availability ranges

**Files:**
- Modify: `src/app/admin/teachers/[id]/page.tsx`

The page already uses `createAdminClient()` (service role, bypasses RLS) to fetch groups. Add a parallel fetch for `teacher_availability_ranges` and pass the result to `AdminTeacherTabs`.

- [ ] **Step 1: Add TeacherAvailabilityRange import**

The current import at the top of the file:
```typescript
import type { GroupWithSchedulesAndStudents } from '@/types/database'
```

Replace with:
```typescript
import type { GroupWithSchedulesAndStudents, TeacherAvailabilityRange } from '@/types/database'
```

- [ ] **Step 2: Fetch availability ranges**

After the existing groups query (after `const groups = (groupsRaw ?? []) as GroupWithSchedulesAndStudents[]`), add:

```typescript
const { data: rangesRaw } = await supabase
  .from('teacher_availability_ranges')
  .select('*')
  .eq('teacher_id', id)
  .order('day_of_week', { ascending: true })
  .order('start_time', { ascending: true })

const ranges = (rangesRaw ?? []) as TeacherAvailabilityRange[]
```

- [ ] **Step 3: Pass ranges to AdminTeacherTabs**

Find the `<AdminTeacherTabs ... />` JSX element and add the `ranges` prop:

```tsx
// Old:
<AdminTeacherTabs
  teacherId={teacher.id}
  groups={groups}
  completedLessons={completedLessons ?? 0}
  canceledLessons={canceledLessons ?? 0}
/>

// New:
<AdminTeacherTabs
  teacherId={teacher.id}
  groups={groups}
  ranges={ranges}
  completedLessons={completedLessons ?? 0}
  canceledLessons={canceledLessons ?? 0}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual verification**

Start the dev server:
```bash
npm run dev
```

1. Log in as admin
2. Navigate to `/admin/teachers` → click any teacher
3. Confirm a third tab "זמינות" appears in the tab bar
4. Click "זמינות" — if the teacher has ranges, cards appear; if not, the empty message appears
5. Click "+ שבץ שיעור" on any range — confirm the sheet opens with the correct day pre-selected and start time pre-filled
6. Complete the form and save — confirm the new group appears in the "קבוצות" tab

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/teachers/[id]/page.tsx
git commit -m "feat: fetch and display teacher availability ranges in admin teacher detail"
```
