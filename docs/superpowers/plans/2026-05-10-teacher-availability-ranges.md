# Teacher Availability Ranges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** החלפת עמוד הזמינות הנוכחי (סלוטים מפורטים) בממשק פשוט של טווחי זמן — יום + שעת התחלה + שעת סיום.

**Architecture:** מחיקת טבלת `teacher_availability` והחלפתה ב-`teacher_availability_ranges`. כתיבה מחדש של ה-server actions, ה-client component, ועדכון הטיפוסים. ה-UI מציג רשימת טווחים מקובצת לפי יום עם טופס הוספה inline.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase (server actions + `createClient` from `@/lib/supabase/server`)

---

## מבנה קבצים

| קובץ | פעולה | תיאור |
|------|--------|--------|
| `src/types/database.ts` | שינוי | הסרת `TeacherAvailability`, הוספת `TeacherAvailabilityRange` |
| `src/app/availability/actions.ts` | כתיבה מחדש | CRUD על `teacher_availability_ranges` |
| `src/app/availability/AvailabilityClient.tsx` | כתיבה מחדש | UI פשוט: רשימה לפי יום + טופס הוספה |
| `src/app/availability/page.tsx` | עדכון | שימוש בטיפוס החדש |

---

## Task 1: SQL Migration בסופאבייס

**Files:**
- Run SQL in Supabase SQL Editor (project `wtiiphuqgxgaqdhxotdd`)

- [ ] **Step 1: הרץ את ה-migration בסופאבייס הנכון**

פתח **Supabase Dashboard → project `wtiiphuqgxgaqdhxotdd` → SQL Editor** והרץ:

```sql
-- מחיקת הטבלה הישנה
DROP TABLE IF EXISTS teacher_availability CASCADE;

-- יצירת הטבלה החדשה
CREATE TABLE teacher_availability_ranges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_range CHECK (end_time > start_time)
);

CREATE INDEX ON teacher_availability_ranges (teacher_id, day_of_week, start_time);

ALTER TABLE teacher_availability_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers manage own ranges"
  ON teacher_availability_ranges FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "service role reads all"
  ON teacher_availability_ranges FOR SELECT
  USING (auth.role() = 'service_role');
```

- [ ] **Step 2: אמת שהמיגרציה הצליחה**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'teacher_availability_ranges';
-- Expected: 1 row
```

---

## Task 2: עדכון טיפוסים ב-database.ts

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: הסר `TeacherAvailability` והוסף `TeacherAvailabilityRange`**

ב-`src/types/database.ts`, מצא את הבלוק:

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

החלף אותו ב:

```typescript
export type TeacherAvailabilityRange = {
  id: string
  teacher_id: string
  day_of_week: number   // 0=ראשון … 6=שבת
  start_time: string    // "HH:MM:SS"
  end_time: string      // "HH:MM:SS"
  created_at: string
}
```

- [ ] **Step 2: בדוק TypeScript**

```bash
cd teacher-attendance-app && npx tsc --noEmit
```

Expected: שגיאות על `TeacherAvailability` בקבצים שעדיין מייבאים אותו — זה תקין, נתקן בשלבים הבאים.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: replace TeacherAvailability type with TeacherAvailabilityRange"
```

---

## Task 3: כתיבה מחדש של actions.ts

**Files:**
- Modify: `src/app/availability/actions.ts`

- [ ] **Step 1: החלף את כל תוכן הקובץ**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TeacherAvailabilityRange } from '@/types/database'

export async function getAvailabilityRanges(): Promise<{ ranges: TeacherAvailabilityRange[]; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ranges: [], error: null }

  const { data, error } = await supabase
    .from('teacher_availability_ranges')
    .select('*')
    .eq('teacher_id', user.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) return { ranges: [], error: error.message }
  return { ranges: (data ?? []) as TeacherAvailabilityRange[], error: null }
}

export async function addAvailabilityRange(formData: FormData): Promise<string | void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const dayOfWeek = parseInt(formData.get('day_of_week') as string, 10)
  const startTime = formData.get('start_time') as string
  const endTime = formData.get('end_time') as string

  if (isNaN(dayOfWeek) || !startTime || !endTime) return 'כל השדות נדרשים'
  if (endTime <= startTime) return 'שעת הסיום חייבת להיות אחרי שעת ההתחלה'

  const { error } = await supabase
    .from('teacher_availability_ranges')
    .insert({ teacher_id: user.id, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime })

  if (error) return `שגיאת DB: ${error.message}`
  revalidatePath('/availability')
}

export async function deleteAvailabilityRange(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase
    .from('teacher_availability_ranges')
    .delete()
    .eq('id', id)
    .eq('teacher_id', user.id)

  revalidatePath('/availability')
}
```

- [ ] **Step 2: בדוק TypeScript**

```bash
npx tsc --noEmit
```

Expected: שגיאה רק ב-`AvailabilityClient.tsx` שעדיין מייבא את הפונקציות הישנות — תקין.

- [ ] **Step 3: Commit**

```bash
git add src/app/availability/actions.ts
git commit -m "feat: rewrite availability actions for ranges table"
```

---

## Task 4: כתיבה מחדש של AvailabilityClient.tsx

**Files:**
- Modify: `src/app/availability/AvailabilityClient.tsx`

- [ ] **Step 1: החלף את כל תוכן הקובץ**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { DAYS_HE } from '@/lib/utils/hebrew'
import { addAvailabilityRange, deleteAvailabilityRange } from './actions'
import type { TeacherAvailabilityRange } from '@/types/database'

function RangeRow({ range, onDeleted }: { range: TeacherAvailabilityRange; onDeleted: () => void }) {
  const [isPending, startTransition] = useTransition()
  const start = range.start_time.slice(0, 5)
  const end = range.end_time.slice(0, 5)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-none">
      <span className="text-sm font-semibold text-gray-800">{start} – {end}</span>
      <button
        disabled={isPending}
        onClick={() => startTransition(async () => { await deleteAvailabilityRange(range.id); onDeleted() })}
        className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors disabled:opacity-40"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

function AddRangeForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3.5 bg-teal-500 hover:bg-teal-600 text-white rounded-2xl font-bold text-sm transition-colors"
      >
        + הוסף טווח זמינות
      </button>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const err = await addAvailabilityRange(formData)
      if (err) { setError(err); return }
      setOpen(false)
      onAdded()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-teal-50 border border-teal-200 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-bold text-teal-800">טווח זמינות חדש</p>

      <div>
        <label className="block text-xs font-semibold text-teal-700 mb-1">יום</label>
        <select name="day_of_week" required className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 font-medium">
          {DAYS_HE.slice(0, 6).map((day, i) => (
            <option key={i} value={i}>יום {day}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-teal-700 mb-1">משעה</label>
          <input name="start_time" type="time" required className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"/>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-teal-700 mb-1">עד שעה</label>
          <input name="end_time" type="time" required className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"/>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors">
          {isPending ? 'שומר...' : 'שמור'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null) }} className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">
          ביטול
        </button>
      </div>
    </form>
  )
}

export default function AvailabilityClient({ initialRanges }: { initialRanges: TeacherAvailabilityRange[] }) {
  const [ranges, setRanges] = useState(initialRanges)

  function refreshFromServer() { window.location.reload() }

  const byDay = DAYS_HE.slice(0, 6).map((day, i) => ({
    day,
    dayIndex: i,
    ranges: ranges.filter(r => r.day_of_week === i),
  })).filter(d => d.ranges.length > 0)

  return (
    <div className="px-4 py-5 max-w-md mx-auto w-full space-y-4">
      {ranges.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          <p className="text-3xl mb-3">📅</p>
          <p>עדיין אין טווחי זמינות</p>
          <p className="text-xs mt-1">הוסיפי ימים ושעות שאת פנויה</p>
        </div>
      )}

      {byDay.map(({ day, dayIndex, ranges: dayRanges }) => (
        <div key={dayIndex} className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-700">יום {day}</span>
            <span className="text-xs text-gray-400">{dayRanges.length} טווח{dayRanges.length !== 1 ? 'ים' : ''}</span>
          </div>
          {dayRanges.map(r => (
            <RangeRow key={r.id} range={r} onDeleted={refreshFromServer}/>
          ))}
        </div>
      ))}

      <AddRangeForm onAdded={refreshFromServer}/>
    </div>
  )
}
```

- [ ] **Step 2: בדוק TypeScript**

```bash
npx tsc --noEmit
```

Expected: שגיאה רק ב-`page.tsx` שעדיין מייבא `getAvailabilitySlots` — תקין.

- [ ] **Step 3: Commit**

```bash
git add src/app/availability/AvailabilityClient.tsx
git commit -m "feat: rewrite availability UI for simple day+time ranges"
```

---

## Task 5: עדכון page.tsx

**Files:**
- Modify: `src/app/availability/page.tsx`

- [ ] **Step 1: החלף את כל תוכן הקובץ**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/layout/BottomNav'
import AvailabilityClient from './AvailabilityClient'
import { getAvailabilityRanges } from './actions'

export default async function AvailabilityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase.from('teachers').select('role').eq('id', user.id).single()
  const isAdmin = teacher?.role === 'admin'

  const { ranges, error } = await getAvailabilityRanges()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-8 pb-6">
        <h1 className="text-xl font-bold">זמינות</h1>
        <p className="text-sm text-white/70 mt-1">ימים ושעות פנויים לרישום</p>
      </div>

      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-xs text-red-700 font-mono break-all">
          שגיאת DB: {error}
        </div>
      )}

      <AvailabilityClient initialRanges={ranges}/>

      <BottomNav isAdmin={isAdmin}/>
    </div>
  )
}
```

- [ ] **Step 2: בדוק TypeScript — חייב להיות נקי**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit ו-Push**

```bash
git add src/app/availability/page.tsx
git commit -m "feat: update availability page to use ranges"
git push
```

---

## Task 6: בדיקה ידנית

- [ ] **Step 1: פתח את Vercel ועבור ל-`/availability`**

צפוי: עמוד ריק עם כפתור "הוסף טווח זמינות" (ללא שגיאת DB)

- [ ] **Step 2: הוסף טווח**

הוסף: יום שני, 15:00 עד 17:00 — לחץ "שמור"

צפוי: הטווח מופיע ב"יום שני · 15:00 – 17:00"

- [ ] **Step 3: נסה ולידציה**

הוסף: יום שלישי, 18:00 עד 16:00 (שעת סיום לפני התחלה) — לחץ "שמור"

צפוי: הודעת שגיאה "שעת הסיום חייבת להיות אחרי שעת ההתחלה"

- [ ] **Step 4: מחק טווח**

לחץ X על הטווח שהוספת

צפוי: הטווח נעלם מהרשימה
