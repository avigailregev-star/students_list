# Teacher Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** מורים מגדירים זמינות (ימים/שעות/כלי נגינה) באפליקציה, ואפליקציית הרישום החיצונית קוראת את הנתונים ישירות מ-Supabase המשותף.

**Architecture:** שתי שינויים בבסיס הנתונים: עמודת `max_students` בטבלת `groups` הקיימת + טבלה חדשה `teacher_availability`. ממשק ניהול בעמוד `/availability` (server page + client component). פעולות CRUD דרך server actions בדפוס הקיים באפליקציה.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase (server actions + `createClient` from `@/lib/supabase/server`)

---

## מבנה קבצים

| קובץ | פעולה | תיאור |
|------|--------|--------|
| `src/types/database.ts` | שינוי | הוספת `max_students` ל-`Group` + טיפוס `TeacherAvailability` |
| `src/app/groups/new/NewGroupForm.tsx` | שינוי | הוספת שדה "מקסימום תלמידים" |
| `src/app/groups/new/actions.ts` | שינוי | קריאת `max_students` ב-`createGroup` |
| `src/app/availability/actions.ts` | יצירה | server actions: הוספה, השהיה, מחיקה |
| `src/app/availability/AvailabilityClient.tsx` | יצירה | client component — רשימה + טופס הוספה |
| `src/app/availability/page.tsx` | יצירה | server page — טעינת נתונים + render |
| `src/components/layout/BottomNav.tsx` | שינוי | הוספת קישור "זמינות" |

---

## Task 1: DB Migration

**Files:**
- Run SQL in Supabase SQL Editor

- [ ] **Step 1: הרץ את ה-migration בסופאבייס**

פתח את **Supabase Dashboard → SQL Editor** והרץ:

```sql
-- 1. הוספת max_students לטבלת groups
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS max_students integer;

-- 2. יצירת טבלת teacher_availability
CREATE TABLE IF NOT EXISTS teacher_availability (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  day_of_week      integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       time NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (45, 60)),
  instrument       text NOT NULL,
  lesson_type      text NOT NULL CHECK (lesson_type IN ('individual', 'group')),
  max_students     integer NOT NULL DEFAULT 1,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS
ALTER TABLE teacher_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers manage own availability"
  ON teacher_availability
  FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "service role reads all"
  ON teacher_availability
  FOR SELECT
  USING (auth.role() = 'service_role');
```

- [ ] **Step 2: אמת שהמיגרציה הצליחה**

ב-SQL Editor הרץ:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'groups' AND column_name = 'max_students';
-- Expected: 1 row

SELECT table_name FROM information_schema.tables
WHERE table_name = 'teacher_availability';
-- Expected: 1 row
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "docs: add teacher availability migration SQL"
```

---

## Task 2: עדכון טיפוסים ב-database.ts

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: הוסף `max_students` לטיפוס `Group`**

פתח `src/types/database.ts` ועדכן את `Group`:

```typescript
export type Group = {
  id: string
  teacher_id: string
  name: string
  lesson_type: LessonType
  is_mangan_school: boolean
  school_name: string | null
  grade: string | null
  max_students: number | null
  created_at: string
}
```

- [ ] **Step 2: הוסף טיפוס `TeacherAvailability`**

מיד אחרי טיפוס `SchoolEvent` הוסף:

```typescript
export type TeacherAvailability = {
  id: string
  teacher_id: string
  day_of_week: number        // 0=ראשון … 6=שבת
  start_time: string         // "HH:MM:SS"
  duration_minutes: 45 | 60
  instrument: string
  lesson_type: 'individual' | 'group'
  max_students: number
  is_active: boolean
  created_at: string
}
```

- [ ] **Step 3: בדוק שאין שגיאות TypeScript**

```bash
cd teacher-attendance-app && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add TeacherAvailability type and max_students to Group"
```

---

## Task 3: שדה max_students בטופס קבוצה חדשה

**Files:**
- Modify: `src/app/groups/new/NewGroupForm.tsx`
- Modify: `src/app/groups/new/actions.ts`

- [ ] **Step 1: הוסף שדה בטופס**

ב-`NewGroupForm.tsx`, אחרי הבלוק של `SchedulePicker` (שורה ~68, לפני בלוק `isIndividual`), הוסף:

```tsx
<div className="bg-white rounded-2xl p-4 shadow-sm">
  <label className="block text-sm font-semibold text-gray-600 mb-2">
    מקסימום תלמידים <span className="text-gray-400 font-normal">(לרישום)</span>
  </label>
  <input
    name="max_students"
    type="number"
    min="1"
    placeholder="השאר ריק אם לא פתוח לרישום"
    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300 transition-all"
  />
</div>
```

- [ ] **Step 2: קרא את השדה ב-createGroup**

ב-`src/app/groups/new/actions.ts`, אחרי שורת `const grade = ...` הוסף:

```typescript
const maxStudentsRaw = formData.get('max_students') as string
const maxStudents = maxStudentsRaw && maxStudentsRaw !== '' ? parseInt(maxStudentsRaw, 10) : null
```

ועדכן את ה-insert של הקבוצה:

```typescript
const { data: group, error: groupError } = await supabase
  .from('groups')
  .insert({
    teacher_id: user.id,
    name,
    lesson_type: lessonType,
    is_mangan_school: isMangan,
    school_name: schoolName,
    grade,
    max_students: maxStudents,
  })
  .select()
  .single()
```

- [ ] **Step 3: בדוק TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/app/groups/new/NewGroupForm.tsx src/app/groups/new/actions.ts
git commit -m "feat: add max_students field to new group form"
```

---

## Task 4: Server Actions לזמינות

**Files:**
- Create: `src/app/availability/actions.ts`

- [ ] **Step 1: צור את קובץ ה-actions**

צור `src/app/availability/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TeacherAvailability } from '@/types/database'

export async function addAvailabilitySlot(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dayOfWeek = parseInt(formData.get('day_of_week') as string, 10)
  const startTime = formData.get('start_time') as string
  const durationMinutes = parseInt(formData.get('duration_minutes') as string, 10) as 45 | 60
  const instrument = formData.get('instrument') as string
  const lessonType = formData.get('lesson_type') as 'individual' | 'group'
  const maxStudents = parseInt(formData.get('max_students') as string, 10) || 1

  if (isNaN(dayOfWeek) || !startTime || !instrument) {
    throw new Error('כל השדות נדרשים')
  }

  const { error } = await supabase
    .from('teacher_availability')
    .insert({
      teacher_id: user.id,
      day_of_week: dayOfWeek,
      start_time: startTime,
      duration_minutes: durationMinutes,
      instrument,
      lesson_type: lessonType,
      max_students: maxStudents,
    })

  if (error) throw new Error('שגיאה בשמירת הסלוט')
  revalidatePath('/availability')
}

export async function toggleAvailabilitySlot(id: string, isActive: boolean): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('teacher_availability')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('teacher_id', user.id)

  if (error) throw new Error('שגיאה בעדכון הסלוט')
  revalidatePath('/availability')
}

export async function deleteAvailabilitySlot(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('teacher_availability')
    .delete()
    .eq('id', id)
    .eq('teacher_id', user.id)

  if (error) throw new Error('שגיאה במחיקת הסלוט')
  revalidatePath('/availability')
}

export async function getAvailabilitySlots(): Promise<TeacherAvailability[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('teacher_availability')
    .select('*')
    .eq('teacher_id', user.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw error
  return (data ?? []) as TeacherAvailability[]
}
```

- [ ] **Step 2: בדוק TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/app/availability/actions.ts
git commit -m "feat: add teacher availability server actions"
```

---

## Task 5: עמוד זמינות — UI

**Files:**
- Create: `src/app/availability/AvailabilityClient.tsx`
- Create: `src/app/availability/page.tsx`

- [ ] **Step 1: צור את ה-client component**

צור `src/app/availability/AvailabilityClient.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { DAYS_HE } from '@/lib/utils/hebrew'
import { addAvailabilitySlot, toggleAvailabilitySlot, deleteAvailabilitySlot } from './actions'
import type { TeacherAvailability } from '@/types/database'

const LESSON_TYPE_LABELS: Record<'individual' | 'group', string> = {
  individual: 'פרטי',
  group: 'קבוצתי',
}

function SlotCard({ slot, onDeleted }: { slot: TeacherAvailability; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()
  const endHour = slot.start_time.slice(0, 5)

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 ${!slot.is_active ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800">
          יום {DAYS_HE[slot.day_of_week]} · {endHour}
          <span className="text-gray-400 font-normal"> ({slot.duration_minutes} דק׳)</span>
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {slot.instrument} · {LESSON_TYPE_LABELS[slot.lesson_type as 'individual' | 'group']} · {slot.max_students} מקומות
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={isPending}
          onClick={() => startTransition(() => toggleAvailabilitySlot(slot.id, !slot.is_active))}
          className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${slot.is_active ? 'bg-teal-50 text-teal-600 hover:bg-teal-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          {slot.is_active ? 'פעיל' : 'מושהה'}
        </button>
        <button
          disabled={isPending}
          onClick={() => startTransition(async () => { await deleteAvailabilitySlot(slot.id); onDeleted() })}
          className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function AddSlotForm({ onAdded }: { onAdded: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3.5 rounded-2xl font-bold text-sm transition-colors"
      >
        + הוסף סלוט
      </button>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await addAvailabilitySlot(formData)
        setOpen(false)
        onAdded()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'שגיאה בשמירה')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <p className="text-sm font-bold text-gray-700">סלוט חדש</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">יום</label>
          <select name="day_of_week" required className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300">
            {DAYS_HE.map((day, i) => (
              <option key={i} value={i}>יום {day}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">שעת התחלה</label>
          <input name="start_time" type="time" required className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300"/>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">משך שיעור</label>
        <div className="flex gap-2">
          {([45, 60] as const).map(d => (
            <label key={d} className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 cursor-pointer has-[:checked]:bg-teal-50 has-[:checked]:border-teal-200 transition-colors">
              <input type="radio" name="duration_minutes" value={d} required defaultChecked={d === 45} className="accent-teal-500"/>
              <span className="text-sm font-medium text-gray-700">{d} דק׳</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">כלי נגינה</label>
        <input name="instrument" required placeholder='לדוגמה: גיטרה' className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300"/>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">סוג שיעור</label>
        <div className="flex gap-2">
          {(['individual', 'group'] as const).map(lt => (
            <label key={lt} className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 cursor-pointer has-[:checked]:bg-teal-50 has-[:checked]:border-teal-200 transition-colors">
              <input type="radio" name="lesson_type" value={lt} required defaultChecked={lt === 'individual'} className="accent-teal-500"/>
              <span className="text-sm font-medium text-gray-700">{LESSON_TYPE_LABELS[lt]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">מספר מקומות</label>
        <input name="max_students" type="number" min="1" defaultValue="1" required className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-teal-300"/>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
          ביטול
        </button>
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-60 transition-colors">
          {isPending ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </form>
  )
}

export default function AvailabilityClient({ initialSlots }: { initialSlots: TeacherAvailability[] }) {
  const [slots, setSlots] = useState(initialSlots)
  const [, startTransition] = useTransition()

  function refreshFromServer() {
    startTransition(() => { window.location.reload() })
  }

  const active = slots.filter(s => s.is_active)
  const inactive = slots.filter(s => !s.is_active)

  return (
    <div className="px-4 py-5 max-w-md mx-auto w-full space-y-4">
      {active.length === 0 && inactive.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          <p className="text-3xl mb-3">📅</p>
          <p>עדיין אין סלוטים מוגדרים</p>
          <p className="text-xs mt-1">הוסף סלוט כדי שתלמידים יוכלו להירשם</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">סלוטים פעילים</h2>
          {active.map(s => <SlotCard key={s.id} slot={s} onDeleted={refreshFromServer}/>)}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">מושהים</h2>
          {inactive.map(s => <SlotCard key={s.id} slot={s} onDeleted={refreshFromServer}/>)}
        </div>
      )}

      <AddSlotForm onAdded={refreshFromServer}/>
    </div>
  )
}
```

- [ ] **Step 2: צור את ה-server page**

צור `src/app/availability/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/layout/BottomNav'
import AvailabilityClient from './AvailabilityClient'
import { getAvailabilitySlots } from './actions'

export default async function AvailabilityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase.from('teachers').select('role').eq('id', user.id).single()
  const isAdmin = teacher?.role === 'admin'

  const slots = await getAvailabilitySlots()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6">
        <h1 className="text-xl font-bold">זמינות</h1>
        <p className="text-sm text-white/70 mt-1">ימים ושעות פנויים לרישום</p>
      </div>

      <AvailabilityClient initialSlots={slots}/>

      <BottomNav isAdmin={isAdmin}/>
    </div>
  )
}
```

- [ ] **Step 3: בדוק TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/app/availability/
git commit -m "feat: add availability page and client component"
```

---

## Task 6: הוספת "זמינות" לניווט התחתון

**Files:**
- Modify: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: הוסף את הפריט לרשימת הניווט**

ב-`src/components/layout/BottomNav.tsx`, עדכן את מערך `items` כך שיכלול את קישור הזמינות:

```typescript
const items = [
  {
    href: '/',
    label: 'ראשי',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#14b8a6' : 'none'} stroke={active ? '#14b8a6' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/availability',
    label: 'זמינות',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#14b8a6' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/reports',
    label: 'דוחות',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#14b8a6' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
]
```

- [ ] **Step 2: בדוק TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/BottomNav.tsx
git commit -m "feat: add availability link to bottom nav"
```

---

## בדיקה ידנית לאחר כל המשימות

1. פתח את האפליקציה ועבור ל-`/availability` — צריך להיות עמוד ריק עם כפתור "הוסף סלוט"
2. הוסף סלוט (יום שני, 16:00, 45 דק', גיטרה, פרטי, 1 מקום) — צריך להופיע ברשימה
3. לחץ על "פעיל" לשינוי ל"מושהה" — הכרטיסייה צריכה להיות שקופה
4. לחץ על כפתור המחיקה — הסלוט צריך להיעלם
5. פתח `/groups/new` — צריך להיות שדה "מקסימום תלמידים" לפני כפתור השמירה
6. צור קבוצה עם max_students=5 — בדוק ב-Supabase שהשדה נשמר
