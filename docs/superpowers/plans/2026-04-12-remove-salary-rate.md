# Remove Salary & Rate Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** הסרה מלאה של כל קוד הקשור לשכר, תעריף שעתי ודוחות שכר מהאפליקציה.

**Architecture:** מחיקת תיקיית payroll כולה, ועריכה של 6 קבצים נוספים להסרת כל רפרנס ל-`hourly_rate`, תשלום ותעריף. אין נגיעה ב-DB.

**Tech Stack:** Next.js (App Router), TypeScript, Supabase, Tailwind CSS

---

### Task 1: מחיקת תיקיית payroll

**Files:**
- Delete: `src/app/admin/payroll/PayrollClient.tsx`
- Delete: `src/app/admin/payroll/page.tsx`

- [ ] **Step 1: מחק את שני קבצי ה-payroll**

```bash
rm src/app/admin/payroll/PayrollClient.tsx
rm src/app/admin/payroll/page.tsx
rmdir src/app/admin/payroll
```

- [ ] **Step 2: ודא שהתיקייה נמחקה**

```bash
ls src/app/admin/
```

Expected: תיקיית `payroll` לא מופיעה.

---

### Task 2: הסרת hourly_rate מהטיפוסים

**Files:**
- Modify: `src/types/database.ts:7`

- [ ] **Step 1: הסר את שדה hourly_rate מ-Teacher type**

ב-`src/types/database.ts`, שנה את:
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
```
ל:
```typescript
export type Teacher = {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'admin' | 'teacher'
  created_at: string
}
```

---

### Task 3: עדכון server action של updateTeacher

**Files:**
- Modify: `src/app/admin/teachers/actions.ts`

- [ ] **Step 1: הסר את hourly_rate מה-action**

שנה את הפונקציה `updateTeacher` מ:
```typescript
export async function updateTeacher(formData: FormData) {
  const supabase = await requireAdmin()

  const teacherId = formData.get('teacher_id') as string
  const hourlyRate = parseFloat(formData.get('hourly_rate') as string) || 0
  const name = formData.get('name') as string

  const { error } = await supabase
    .from('teachers')
    .update({ hourly_rate: hourlyRate, name })
    .eq('id', teacherId)

  if (error) throw new Error('שגיאה בעדכון המורה')
  revalidatePath('/admin/teachers')
}
```
ל:
```typescript
export async function updateTeacher(formData: FormData) {
  const supabase = await requireAdmin()

  const teacherId = formData.get('teacher_id') as string
  const name = formData.get('name') as string

  const { error } = await supabase
    .from('teachers')
    .update({ name })
    .eq('id', teacherId)

  if (error) throw new Error('שגיאה בעדכון המורה')
  revalidatePath('/admin/teachers')
}
```

---

### Task 4: עדכון EditTeacherForm

**Files:**
- Modify: `src/app/admin/teachers/[id]/EditTeacherForm.tsx`

- [ ] **Step 1: החלף את כל תוכן הקובץ**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { updateTeacher } from '../actions'

interface Props {
  teacherId: string
  initialName: string
}

export default function EditTeacherForm({ teacherId, initialName }: Props) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(initialName)

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full bg-teal-500 text-white font-bold text-sm py-3 rounded-2xl hover:bg-teal-600 transition-colors"
      >
        עריכת פרטים
      </button>
    )
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        const fd = new FormData()
        fd.set('teacher_id', teacherId)
        fd.set('name', name)
        startTransition(async () => {
          await updateTeacher(fd)
          setEditing(false)
        })
      }}
      className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3"
    >
      <p className="text-sm font-bold text-gray-700">עריכת מורה</p>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">שם מלא</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-teal-500 text-white font-bold text-sm py-2.5 rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-60"
        >
          {isPending ? 'שומר...' : 'שמור'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex-1 bg-gray-100 text-gray-600 font-bold text-sm py-2.5 rounded-xl hover:bg-gray-200 transition-colors"
        >
          ביטול
        </button>
      </div>
    </form>
  )
}
```

---

### Task 5: עדכון דף פרטי מורה

**Files:**
- Modify: `src/app/admin/teachers/[id]/page.tsx`

- [ ] **Step 1: הסר hourly_rate מה-select, totalPay ותיבת השכר, ועדכן את props של EditTeacherForm**

החלף את כל תוכן הקובץ ב:
```typescript
import { notFound } from 'next/navigation'
import Link from 'next/link'
import EditTeacherForm from './EditTeacherForm'
import { requireAdmin } from '@/lib/auth'

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

  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, lesson_type, is_mangan_school, school_name, grade')
    .eq('teacher_id', id)
    .order('created_at', { ascending: true })

  const { count: completedLessons } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .in('group_id', (groups ?? []).map(g => g.id))
    .eq('status', 'completed')

  const { count: canceledLessons } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .in('group_id', (groups ?? []).map(g => g.id))
    .eq('status', 'teacher_canceled')

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/admin/teachers" className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
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

      <div className="px-4 py-5 flex flex-col gap-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'קבוצות', value: groups?.length ?? 0, color: 'text-teal-600' },
            { label: 'שיעורים', value: completedLessons ?? 0, color: 'text-emerald-500' },
            { label: 'ביטולים', value: canceledLessons ?? 0, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl shadow-sm py-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Edit form */}
        <EditTeacherForm
          teacherId={teacher.id}
          initialName={teacher.name}
        />

        {/* Groups */}
        {(groups ?? []).length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">קבוצות</p>
            <div className="flex flex-col gap-2">
              {(groups ?? []).map(g => (
                <div key={g.id} className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                    g.lesson_type === 'group' ? 'bg-teal-500' : 'bg-violet-500'
                  }`}>
                    {g.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{g.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {g.lesson_type === 'group' ? 'קבוצה' : 'יחיד'}
                      {g.is_mangan_school && g.school_name && ` · ${g.school_name}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

### Task 6: עדכון דף הבית של Admin

**Files:**
- Modify: `src/app/admin/page.tsx:62-64`

- [ ] **Step 1: הסר payroll מרשימת quick links ושנה תווית מורים**

מצא את מערך quick links (שורות 61-77 בערך) והחלף אותו מ:
```typescript
{[
  { href: '/admin/teachers', label: 'ניהול מורים ושכר', color: 'bg-teal-500', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { href: '/admin/calendar', label: 'לוח שנה שנתי וחגים', color: 'bg-violet-500', icon: 'M3 4h18v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4zM16 2v4M8 2v4M3 10h18' },
  { href: '/admin/payroll', label: 'דוחות שכר חודשיים', color: 'bg-emerald-500', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
].map(item => (
```
ל:
```typescript
{[
  { href: '/admin/teachers', label: 'ניהול מורים', color: 'bg-teal-500', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { href: '/admin/calendar', label: 'לוח שנה שנתי וחגים', color: 'bg-violet-500', icon: 'M3 4h18v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4zM16 2v4M8 2v4M3 10h18' },
].map(item => (
```

---

### Task 7: הסרת "שכר" מניווט Admin

**Files:**
- Modify: `src/components/layout/AdminNav.tsx`

- [ ] **Step 1: הסר את פריט הניווט "שכר" ממערך NAV_ITEMS**

מצא את הקטע הזה ב-`NAV_ITEMS` והסר אותו לחלוטין:
```typescript
  {
    href: '/admin/payroll',
    label: 'שכר',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
```

---

### Task 8: בדיקת TypeScript ו-build

- [ ] **Step 1: הרץ type check**

```bash
npx tsc --noEmit
```

Expected: אין שגיאות TypeScript.

- [ ] **Step 2: הרץ build**

```bash
npm run build
```

Expected: build מצליח ללא שגיאות.
