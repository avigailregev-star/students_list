# Admin Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the admin to create, edit, and delete lesson groups for any teacher via a tabbed interface on the teacher detail page, with 8 lesson types.

**Architecture:** Extend `admin/teachers/[id]` with a tab UI (`AdminTeacherTabs`) and a bottom-sheet form (`AdminGroupSheet`). New server actions in `groupActions.ts` accept an explicit `teacher_id` and call `requireAdmin()`. The teacher's `/groups/new` route is guarded to admin-only at the server level.

**Tech Stack:** Next.js 15 App Router, Supabase, Tailwind CSS, React `useTransition`, server actions.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/types/database.ts` | Modify | Expand `LessonType` to 8 values; add `GroupWithSchedulesAndStudents` type |
| `src/lib/utils/lessonTypes.ts` | Create | `LESSON_TYPE_CONFIG` map (label + color per type) |
| `src/app/groups/new/NewGroupForm.tsx` | Create | Extract current client form from `page.tsx` |
| `src/app/groups/new/page.tsx` | Modify | Convert to server component with admin-only guard |
| `src/app/admin/teachers/[id]/groupActions.ts` | Create | Server actions: create/update/delete group, add/remove student |
| `src/app/admin/teachers/[id]/AdminGroupSheet.tsx` | Create | Bottom sheet form (create + edit modes) |
| `src/app/admin/teachers/[id]/AdminTeacherTabs.tsx` | Create | Tab switcher: קבוצות / סטטיסטיקות |
| `src/app/admin/teachers/[id]/page.tsx` | Modify | Fetch groups+schedules+students, pass to `AdminTeacherTabs` |

---

## Task 1: Update TypeScript types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Replace `LessonType` and update `Group` type**

In `src/types/database.ts`, replace:
```ts
export type LessonType = 'group' | 'individual'
```
With:
```ts
export type LessonType =
  | 'individual_45'
  | 'individual_60'
  | 'group'
  | 'theory'
  | 'orchestra'
  | 'choir'
  | 'melodies_individual'
  | 'melodies_group'
```

Add after the `GroupSchedule` type:
```ts
export type GroupWithSchedulesAndStudents = Group & {
  group_schedules: GroupSchedule[]
  students: Student[]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd teacher-attendance-app && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about `lesson_type` usages in existing components — those will be fixed in later tasks. Zero errors is also fine.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: expand LessonType to 8 values"
```

---

## Task 2: Database migration (manual)

**Files:** None (Supabase SQL editor)

- [ ] **Step 1: Run migration in Supabase SQL editor**

Open your Supabase project → SQL Editor. Run this in order:

```sql
-- 1. Migrate existing 'individual' rows to 'individual_45'
UPDATE groups SET lesson_type = 'individual_45' WHERE lesson_type = 'individual';

-- 2. Drop old constraint
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_lesson_type_check;

-- 3. Add new constraint with all 8 values
ALTER TABLE groups ADD CONSTRAINT groups_lesson_type_check
  CHECK (lesson_type IN (
    'individual_45','individual_60','group','theory',
    'orchestra','choir','melodies_individual','melodies_group'
  ));
```

- [ ] **Step 2: Verify migration**

```sql
SELECT lesson_type, count(*) FROM groups GROUP BY lesson_type;
-- Should show no 'individual' rows
```

- [ ] **Step 3: Commit note**

```bash
git commit --allow-empty -m "chore: applied lesson_type DB migration in Supabase"
```

---

## Task 3: Create lesson type config utility

**Files:**
- Create: `src/lib/utils/lessonTypes.ts`

- [ ] **Step 1: Create the config file**

```ts
// src/lib/utils/lessonTypes.ts
import type { LessonType } from '@/types/database'

export const LESSON_TYPE_CONFIG: Record<LessonType, { label: string; color: string; bg: string }> = {
  individual_45:     { label: 'פרטני 45 דק׳',    color: 'text-violet-700', bg: 'bg-violet-500' },
  individual_60:     { label: 'פרטני 60 דק׳',    color: 'text-purple-700', bg: 'bg-purple-500' },
  group:             { label: 'קבוצתי',           color: 'text-teal-700',   bg: 'bg-teal-500'   },
  theory:            { label: 'תיאוריה',          color: 'text-blue-700',   bg: 'bg-blue-500'   },
  orchestra:         { label: 'תזמורת',           color: 'text-amber-700',  bg: 'bg-amber-500'  },
  choir:             { label: 'מקהלה',            color: 'text-pink-700',   bg: 'bg-pink-500'   },
  melodies_individual:{ label: 'מנגינות פרטני',  color: 'text-emerald-700',bg: 'bg-emerald-500'},
  melodies_group:    { label: 'מנגינות קבוצתי',  color: 'text-cyan-700',   bg: 'bg-cyan-500'   },
}

export const LESSON_TYPE_OPTIONS = Object.entries(LESSON_TYPE_CONFIG) as [LessonType, { label: string; color: string; bg: string }][]
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils/lessonTypes.ts
git commit -m "feat: add LESSON_TYPE_CONFIG utility"
```

---

## Task 4: Fix lesson type display in admin teacher detail page

**Files:**
- Modify: `src/app/admin/teachers/[id]/page.tsx` (group badge section only)

- [ ] **Step 1: Update group badge rendering**

In `src/app/admin/teachers/[id]/page.tsx`, replace the group list section (lines 80–102):

```tsx
import { LESSON_TYPE_CONFIG } from '@/lib/utils/lessonTypes'

{/* Groups */}
{(groups ?? []).length > 0 && (
  <div>
    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">קבוצות</p>
    <div className="flex flex-col gap-2">
      {(groups ?? []).map(g => {
        const cfg = LESSON_TYPE_CONFIG[g.lesson_type as keyof typeof LESSON_TYPE_CONFIG]
        return (
          <div key={g.id} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${cfg?.bg ?? 'bg-gray-400'}`}>
              {g.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{g.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {cfg?.label ?? g.lesson_type}
                {g.is_mangan_school && g.school_name && ` · ${g.school_name}`}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/teachers/[id]/page.tsx
git commit -m "fix: update group badge colors for new lesson types"
```

---

## Task 5: Guard /groups/new to admin only

**Files:**
- Create: `src/app/groups/new/NewGroupForm.tsx`
- Modify: `src/app/groups/new/page.tsx`

- [ ] **Step 1: Move client form to NewGroupForm.tsx**

Create `src/app/groups/new/NewGroupForm.tsx` with the entire current content of `src/app/groups/new/page.tsx` (the `'use client'` component), but rename the export to `NewGroupForm`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SchedulePicker from '@/components/groups/SchedulePicker'
import { createGroup } from './actions'
import type { LessonType } from '@/types/database'
import { LESSON_TYPE_OPTIONS } from '@/lib/utils/lessonTypes'

export default function NewGroupForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isMangan, setIsMangan] = useState(false)
  const [hasSecondSlot, setHasSecondSlot] = useState(false)
  const [lessonType, setLessonType] = useState<LessonType>('group')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('is_mangan_school', String(isMangan))
    formData.set('lesson_type', lessonType)
    startTransition(async () => {
      try { await createGroup(formData) }
      catch (err: unknown) { setError(err instanceof Error ? err.message : 'שגיאה בשמירת הקבוצה') }
    })
  }

  const isIndividual = lessonType === 'individual_45' || lessonType === 'individual_60'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-xl font-bold">קבוצה חדשה</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-4 py-5 pb-10 space-y-4 max-w-md mx-auto w-full">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-gray-600 mb-2">שם הקבוצה / תלמיד</label>
          <input name="name" required placeholder="לדוגמה: גיטרה מתחילים" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300 transition-all"/>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-gray-600 mb-2">סוג שיעור</label>
          <select value={lessonType} onChange={e => setLessonType(e.target.value as LessonType)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300">
            {LESSON_TYPE_OPTIONS.map(([value, cfg]) => (
              <option key={value} value={value}>{cfg.label}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <SchedulePicker index={1} required label="מועד שיעור"/>
          {hasSecondSlot ? (
            <div>
              <SchedulePicker index={2} label="מועד שיעור 2 (אופציונלי)"/>
              <button type="button" onClick={() => setHasSecondSlot(false)} className="text-xs text-gray-400 mt-1.5 hover:text-red-500">הסר מועד שני</button>
            </div>
          ) : (
            <button type="button" onClick={() => setHasSecondSlot(true)} className="text-sm text-teal-600 font-bold hover:text-teal-700">+ הוסף מועד שני</button>
          )}
        </div>

        {isIndividual && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-600 mb-2">שם התלמיד</label>
            <input name="student_name" required placeholder="לדוגמה: יובל כהן" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300"/>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">בית ספר מנגן</p>
            <p className="text-xs text-gray-400 mt-0.5">שיעור במסגרת בית ספר מנגן</p>
          </div>
          <button type="button" role="switch" aria-checked={isMangan} onClick={() => setIsMangan(!isMangan)} className={`relative w-12 h-6 rounded-full transition-colors ${isMangan ? 'bg-teal-500' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isMangan ? 'right-0.5' : 'left-0.5'}`}/>
          </button>
        </div>

        {isMangan && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">פרטי בית הספר</p>
            <input name="school_name" required={isMangan} placeholder="שם בית הספר" className="w-full px-4 py-2.5 bg-white border border-amber-100 rounded-xl text-sm"/>
            <input name="grade" placeholder="כיתה" className="w-full px-4 py-2.5 bg-white border border-amber-100 rounded-xl text-sm"/>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl">{error}</div>}

        <button type="submit" disabled={isPending} className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3.5 rounded-2xl font-bold text-sm disabled:opacity-60">
          {isPending ? 'שומר...' : 'שמור קבוצה'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Update actions.ts to handle new lesson types**

In `src/app/groups/new/actions.ts`, replace line 13:
```ts
const lessonType = formData.get('lesson_type') as 'group' | 'individual'
```
With:
```ts
import type { LessonType } from '@/types/database'
// ...
const lessonType = formData.get('lesson_type') as LessonType
```

Also replace the individual auto-student block (lines 52–59):
```ts
const isIndividual = lessonType === 'individual_45' || lessonType === 'individual_60'
if (isIndividual) {
  const studentName = formData.get('student_name') as string
  if (studentName) {
    await supabase.from('students').insert({ group_id: group.id, name: studentName })
  }
}
```

- [ ] **Step 3: Replace page.tsx with admin-guarded server component**

Overwrite `src/app/groups/new/page.tsx` entirely:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NewGroupForm from './NewGroupForm'

export default async function NewGroupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('role')
    .eq('id', user.id)
    .single()

  if (teacher?.role !== 'admin') redirect('/')

  return <NewGroupForm />
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/groups/new/NewGroupForm.tsx src/app/groups/new/page.tsx src/app/groups/new/actions.ts
git commit -m "feat: guard /groups/new to admin only, update lesson types in form"
```

---

## Task 6: Create groupActions.ts server actions

**Files:**
- Create: `src/app/admin/teachers/[id]/groupActions.ts`

- [ ] **Step 1: Create the file**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import type { LessonType } from '@/types/database'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const VALID_TYPES: LessonType[] = [
  'individual_45','individual_60','group','theory','orchestra','choir','melodies_individual','melodies_group',
]

export interface GroupFormData {
  name: string
  lessonType: LessonType
  dayOfWeek: number
  startTime: string
  endTime?: string
  students: { name: string; instrument?: string; parentPhone?: string }[]
}

export async function createGroupForTeacher(teacherId: string, data: GroupFormData) {
  if (!UUID_RE.test(teacherId)) throw new Error('מזהה מורה לא תקין')
  if (!data.name.trim()) throw new Error('שם קבוצה נדרש')
  if (!VALID_TYPES.includes(data.lessonType)) throw new Error('סוג שיעור לא תקין')
  if (data.dayOfWeek < 0 || data.dayOfWeek > 5) throw new Error('יום לא תקין')
  if (!data.startTime) throw new Error('שעת התחלה נדרשת')

  const { supabase } = await requireAdmin()

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      teacher_id: teacherId,
      name: data.name.trim(),
      lesson_type: data.lessonType,
      is_mangan_school: false,
    })
    .select('id')
    .single()

  if (groupError || !group) throw new Error('שגיאה ביצירת הקבוצה')

  const { error: schedError } = await supabase
    .from('group_schedules')
    .insert({
      group_id: group.id,
      day_of_week: data.dayOfWeek,
      start_time: data.startTime,
      end_time: data.endTime ?? null,
    })

  if (schedError) throw new Error('שגיאה בשמירת המועד')

  if (data.students.length > 0) {
    const { error: studError } = await supabase
      .from('students')
      .insert(data.students.map(s => ({
        group_id: group.id,
        name: s.name.trim(),
        instrument: s.instrument?.trim() || null,
        parent_phone: s.parentPhone?.trim() || null,
        is_active: true,
      })))
    if (studError) throw new Error('שגיאה בהוספת תלמידים')
  }

  revalidatePath(`/admin/teachers/${teacherId}`)
}

export async function updateGroup(groupId: string, teacherId: string, data: GroupFormData) {
  if (!UUID_RE.test(groupId)) throw new Error('מזהה קבוצה לא תקין')
  if (!data.name.trim()) throw new Error('שם קבוצה נדרש')
  if (!VALID_TYPES.includes(data.lessonType)) throw new Error('סוג שיעור לא תקין')

  const { supabase } = await requireAdmin()

  const { error: groupError } = await supabase
    .from('groups')
    .update({ name: data.name.trim(), lesson_type: data.lessonType })
    .eq('id', groupId)

  if (groupError) throw new Error('שגיאה בעדכון הקבוצה')

  // Replace schedule: delete existing, insert new
  await supabase.from('group_schedules').delete().eq('group_id', groupId)
  const { error: schedError } = await supabase
    .from('group_schedules')
    .insert({
      group_id: groupId,
      day_of_week: data.dayOfWeek,
      start_time: data.startTime,
      end_time: data.endTime ?? null,
    })

  if (schedError) throw new Error('שגיאה בעדכון המועד')

  revalidatePath(`/admin/teachers/${teacherId}`)
}

export async function deleteGroup(groupId: string, teacherId: string) {
  if (!UUID_RE.test(groupId)) throw new Error('מזהה קבוצה לא תקין')
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) throw new Error('שגיאה במחיקת הקבוצה')
  revalidatePath(`/admin/teachers/${teacherId}`)
}

export async function addStudentToGroup(groupId: string, teacherId: string, student: { name: string; instrument?: string; parentPhone?: string }) {
  if (!UUID_RE.test(groupId)) throw new Error('מזהה קבוצה לא תקין')
  if (!student.name.trim()) throw new Error('שם תלמיד נדרש')
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('students').insert({
    group_id: groupId,
    name: student.name.trim(),
    instrument: student.instrument?.trim() || null,
    parent_phone: student.parentPhone?.trim() || null,
    is_active: true,
  })
  if (error) throw new Error('שגיאה בהוספת תלמיד')
  revalidatePath(`/admin/teachers/${teacherId}`)
}

export async function removeStudentFromGroup(studentId: string, teacherId: string) {
  if (!UUID_RE.test(studentId)) throw new Error('מזהה תלמיד לא תקין')
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from('students').delete().eq('id', studentId)
  if (error) throw new Error('שגיאה במחיקת תלמיד')
  revalidatePath(`/admin/teachers/${teacherId}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/teachers/[id]/groupActions.ts
git commit -m "feat: add admin group CRUD server actions"
```

---

## Task 7: Create AdminGroupSheet component

**Files:**
- Create: `src/app/admin/teachers/[id]/AdminGroupSheet.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { LessonType, GroupWithSchedulesAndStudents } from '@/types/database'
import { LESSON_TYPE_OPTIONS } from '@/lib/utils/lessonTypes'
import { DAYS_HE } from '@/lib/utils/hebrew'
import { createGroupForTeacher, updateGroup, addStudentToGroup, removeStudentFromGroup } from './groupActions'

interface Props {
  teacherId: string
  group?: GroupWithSchedulesAndStudents
  isOpen: boolean
  onClose: () => void
}

interface PendingStudent {
  name: string
  instrument: string
  parentPhone: string
}

export default function AdminGroupSheet({ teacherId, group, isOpen, onClose }: Props) {
  const isEdit = !!group
  const schedule = group?.group_schedules?.[0]

  const [lessonType, setLessonType] = useState<LessonType>(group?.lesson_type ?? 'group')
  const [name, setName] = useState(group?.name ?? '')
  const [dayOfWeek, setDayOfWeek] = useState<number>(schedule?.day_of_week ?? 0)
  const [startTime, setStartTime] = useState(schedule?.start_time?.slice(0, 5) ?? '')
  const [endTime, setEndTime] = useState(schedule?.end_time?.slice(0, 5) ?? '')
  const [pendingStudents, setPendingStudents] = useState<PendingStudent[]>([])
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentInstrument, setNewStudentInstrument] = useState('')
  const [newStudentPhone, setNewStudentPhone] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  function addPendingStudent() {
    if (!newStudentName.trim()) return
    setPendingStudents(prev => [...prev, { name: newStudentName.trim(), instrument: newStudentInstrument.trim(), parentPhone: newStudentPhone.trim() }])
    setNewStudentName('')
    setNewStudentInstrument('')
    setNewStudentPhone('')
  }

  function handleSave() {
    setError(null)
    const data = { name, lessonType, dayOfWeek, startTime, endTime: endTime || undefined, students: pendingStudents }
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateGroup(group.id, teacherId, { ...data, students: [] })
          for (const s of pendingStudents) {
            await addStudentToGroup(group.id, teacherId, s)
          }
        } else {
          await createGroupForTeacher(teacherId, data)
        }
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'שגיאה בשמירה')
      }
    })
  }

  function handleRemoveExistingStudent(studentId: string) {
    startTransition(async () => {
      try { await removeStudentFromGroup(studentId, teacherId) }
      catch (err) { setError(err instanceof Error ? err.message : 'שגיאה במחיקת תלמיד') }
    })
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-[72px] z-[100] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white w-full rounded-t-3xl flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 144px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'עריכת קבוצה' : 'קבוצה חדשה'}</h2>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-4 pb-2">

          {/* Lesson type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">סוג שיעור</label>
            <select
              value={lessonType}
              onChange={e => setLessonType(e.target.value as LessonType)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 bg-white"
            >
              {LESSON_TYPE_OPTIONS.map(([value, cfg]) => (
                <option key={value} value={value}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">שם קבוצה</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="לדוגמה: תזמורת א׳"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
            />
          </div>

          {/* Day */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">יום</label>
            <select
              value={dayOfWeek}
              onChange={e => setDayOfWeek(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 bg-white"
            >
              {DAYS_HE.slice(0, 6).map((day, i) => (
                <option key={i} value={i}>{day}</option>
              ))}
            </select>
          </div>

          {/* Time */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">שעת התחלה</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" dir="ltr"/>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">שעת סיום (אופציונלי)</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400" dir="ltr"/>
            </div>
          </div>

          {/* Students */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">תלמידים</label>

            {/* Existing students (edit mode) */}
            {isEdit && (group.students ?? []).map(s => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl mb-1.5">
                <span className="flex-1 text-sm text-gray-800">{s.name}</span>
                {s.instrument && <span className="text-xs text-gray-400">{s.instrument}</span>}
                <button
                  type="button"
                  onClick={() => handleRemoveExistingStudent(s.id)}
                  disabled={isPending}
                  className="w-6 h-6 rounded-md bg-red-100 hover:bg-red-200 flex items-center justify-center text-red-500 shrink-0"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}

            {/* Pending new students */}
            {pendingStudents.map((s, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-teal-50 rounded-xl mb-1.5">
                <span className="flex-1 text-sm text-teal-800">{s.name}{s.instrument ? ` · ${s.instrument}` : ''}</span>
                <button type="button" onClick={() => setPendingStudents(prev => prev.filter((_, j) => j !== i))} className="w-6 h-6 rounded-md bg-teal-100 hover:bg-teal-200 flex items-center justify-center text-teal-600 shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}

            {/* Add student inline form */}
            <div className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2 mt-1">
              <input value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="שם תלמיד" className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:border-teal-400"/>
              <div className="flex gap-2">
                <input value={newStudentInstrument} onChange={e => setNewStudentInstrument(e.target.value)} placeholder="כלי (אופציונלי)" className="flex-1 px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:border-teal-400"/>
                <input value={newStudentPhone} onChange={e => setNewStudentPhone(e.target.value)} placeholder="טל׳ הורה" className="flex-1 px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:border-teal-400" dir="ltr"/>
              </div>
              <button type="button" onClick={addPendingStudent} disabled={!newStudentName.trim()} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg disabled:opacity-40">
                + הוסף תלמיד
              </button>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pt-3 pb-6 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !name.trim() || !startTime}
            className="flex-1 bg-teal-500 text-white font-bold py-3 rounded-2xl hover:bg-teal-600 transition-colors disabled:opacity-60 text-sm"
          >
            {isPending ? 'שומר...' : 'שמור'}
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl text-sm">
            ביטול
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/teachers/[id]/AdminGroupSheet.tsx
git commit -m "feat: add AdminGroupSheet bottom sheet component"
```

---

## Task 8: Create AdminTeacherTabs component

**Files:**
- Create: `src/app/admin/teachers/[id]/AdminTeacherTabs.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { GroupWithSchedulesAndStudents } from '@/types/database'
import { LESSON_TYPE_CONFIG } from '@/lib/utils/lessonTypes'
import { DAYS_HE } from '@/lib/utils/hebrew'
import { deleteGroup } from './groupActions'
import AdminGroupSheet from './AdminGroupSheet'

interface Props {
  teacherId: string
  groups: GroupWithSchedulesAndStudents[]
  completedLessons: number
  canceledLessons: number
}

export default function AdminTeacherTabs({ teacherId, groups, completedLessons, canceledLessons }: Props) {
  const [activeTab, setActiveTab] = useState<'groups' | 'stats'>('groups')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupWithSchedulesAndStudents | undefined>()
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setEditingGroup(undefined)
    setSheetOpen(true)
  }

  function openEdit(group: GroupWithSchedulesAndStudents) {
    setEditingGroup(group)
    setSheetOpen(true)
  }

  function handleDelete(groupId: string) {
    if (!confirm('למחוק את הקבוצה? הפעולה אינה הפיכה.')) return
    startTransition(async () => {
      try { await deleteGroup(groupId, teacherId) }
      catch { alert('שגיאה במחיקת הקבוצה') }
    })
  }

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-2 bg-gray-100 rounded-2xl p-1">
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
      </div>

      {/* Groups tab */}
      {activeTab === 'groups' && (
        <div className="flex flex-col gap-2">
          {groups.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">אין קבוצות עדיין</p>
          )}
          {groups.map(g => {
            const cfg = LESSON_TYPE_CONFIG[g.lesson_type]
            const schedule = g.group_schedules?.[0]
            return (
              <div key={g.id} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${cfg?.bg ?? 'bg-gray-400'}`}>
                  {g.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{g.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cfg?.label ?? g.lesson_type}
                    {schedule && ` · ${DAYS_HE[schedule.day_of_week]} ${schedule.start_time.slice(0, 5)}`}
                    {` · ${g.students?.length ?? 0} תלמידים`}
                  </p>
                </div>
                <button onClick={() => openEdit(g)} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-teal-50 flex items-center justify-center text-gray-500 hover:text-teal-600 shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button onClick={() => handleDelete(g.id)} disabled={isPending} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 shrink-0 disabled:opacity-40">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            )
          })}
          <button onClick={openCreate} className="w-full py-3 border-2 border-dashed border-teal-300 text-teal-600 font-bold text-sm rounded-2xl hover:border-teal-400 hover:bg-teal-50 transition-colors">
            + הוסף קבוצה
          </button>
        </div>
      )}

      {/* Stats tab */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'שיעורים שהושלמו', value: completedLessons, color: 'text-emerald-500' },
            { label: 'ביטולים', value: canceledLessons, color: 'text-red-400' },
            { label: 'סה״כ קבוצות', value: groups.length, color: 'text-teal-600' },
            { label: 'סה״כ תלמידים', value: groups.reduce((sum, g) => sum + (g.students?.length ?? 0), 0), color: 'text-violet-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl shadow-sm py-4 px-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-gray-400 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <AdminGroupSheet
        key={editingGroup?.id ?? 'new'}
        teacherId={teacherId}
        group={editingGroup}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/teachers/[id]/AdminTeacherTabs.tsx
git commit -m "feat: add AdminTeacherTabs component with group management"
```

---

## Task 9: Update admin teacher detail page

**Files:**
- Modify: `src/app/admin/teachers/[id]/page.tsx`

- [ ] **Step 1: Rewrite the page to fetch full data and use AdminTeacherTabs**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EditTeacherForm from './EditTeacherForm'
import AdminTeacherTabs from './AdminTeacherTabs'
import { requireAdmin } from '@/lib/auth'
import type { GroupWithSchedulesAndStudents } from '@/types/database'

interface Props { params: Promise<{ id: string }> }

export default async function TeacherDetailPage({ params }: Props) {
  const { id } = await params
  const { supabase } = await requireAdmin()

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, name, email, role, created_at')
    .eq('id', id)
    .single()

  if (!teacher) notFound()

  const { data: groupsRaw } = await supabase
    .from('groups')
    .select('*, group_schedules(*), students(*)')
    .eq('teacher_id', id)
    .order('created_at', { ascending: true })

  const groups = (groupsRaw ?? []) as GroupWithSchedulesAndStudents[]

  const groupIds = groups.map(g => g.id)

  const [{ count: completedLessons }, { count: canceledLessons }] = groupIds.length > 0
    ? await Promise.all([
        supabase.from('lessons').select('id', { count: 'exact', head: true })
          .in('group_id', groupIds).eq('status', 'completed'),
        supabase.from('lessons').select('id', { count: 'exact', head: true })
          .in('group_id', groupIds).eq('status', 'teacher_canceled'),
      ])
    : [{ count: 0 }, { count: 0 }]

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/admin/teachers" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold text-xl shrink-0">
            {teacher.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{teacher.name}</h1>
            <p className="text-sm text-teal-100 truncate">{teacher.email}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 flex flex-col gap-4 pb-24">
        <EditTeacherForm teacherId={teacher.id} initialName={teacher.name} />
        <AdminTeacherTabs
          teacherId={teacher.id}
          groups={groups}
          completedLessons={completedLessons ?? 0}
          canceledLessons={canceledLessons ?? 0}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/teachers/[id]/page.tsx
git commit -m "feat: integrate AdminTeacherTabs into teacher detail page"
```

---

## Task 10: Push and verify

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Wait for Vercel deploy (~2 min), then verify**

1. Go to `https://students-list-ochre.vercel.app/admin/teachers`
2. Click a teacher → confirm tabs "קבוצות" / "סטטיסטיקות" appear
3. Click "+ הוסף קבוצה" → bottom sheet opens with 8 lesson type options
4. Fill form and save → group appears in list
5. Click edit (✏️) → sheet opens pre-populated
6. Click delete (🗑️) → confirm dialog → group removed
7. Go to `https://students-list-ochre.vercel.app/groups/new` as a teacher → confirm redirect to `/`

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: post-deploy corrections"
git push
```
