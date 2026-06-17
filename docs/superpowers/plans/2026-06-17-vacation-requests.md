# Vacation Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teachers submit vacation requests (date range + optional note) from `/reports`; the secretary approves or rejects them from `/admin/messages` via a new tab.

**Architecture:** New `vacation_requests` Supabase table with RLS mirroring the `messages` pattern. Teacher-side: server action + client component added to the reports page. Admin-side: existing `MessagesInboxClient` gains a tab switcher + vacation UI; `AdminLayout` combines pending counts into one badge.

**Tech Stack:** Next.js App Router (server components + server actions + client components), Supabase (RLS + Realtime `postgres_changes`), Tailwind CSS, TypeScript.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260617_vacation_requests.sql` | Create | DDL + RLS for new table |
| `src/types/database.ts` | Modify | Add `VacationRequest` type |
| `src/app/reports/vacationActions.ts` | Create | Teacher server action: `submitVacationRequest` |
| `src/app/reports/VacationSection.tsx` | Create | Teacher client component: request list + form |
| `src/app/reports/page.tsx` | Modify | Fetch vacation requests; render `VacationSection` |
| `src/app/admin/messages/vacationActions.ts` | Create | Admin server action: `decideVacationRequest` |
| `src/app/admin/messages/MessagesInboxClient.tsx` | Modify | Add tabs + vacation requests UI |
| `src/app/admin/messages/page.tsx` | Modify | Fetch vacation requests; pass as prop |
| `src/app/admin/layout.tsx` | Modify | Add vacations pending count to badge |

---

## Task 1: Migration — `vacation_requests` table

**Files:**
- Create: `supabase/migrations/20260617_vacation_requests.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260617_vacation_requests.sql

create table vacation_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz default now(),
  decided_at timestamptz
);

alter table vacation_requests enable row level security;

create policy "vacation_requests_teacher_read_own" on vacation_requests
  for select using (teacher_id = auth.uid());

create policy "vacation_requests_teacher_insert" on vacation_requests
  for insert with check (teacher_id = auth.uid());

create policy "vacation_requests_admin_all" on vacation_requests
  for all using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );
```

- [ ] **Step 2: Run migration in Supabase Dashboard**

Open Supabase Dashboard → SQL Editor → paste and run the file above.

Verify: Table `vacation_requests` appears in Table Editor with 9 columns and 3 RLS policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260617_vacation_requests.sql
git commit -m "feat: add vacation_requests migration"
```

---

## Task 2: TypeScript type

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add `VacationRequest` type**

Add at the end of `src/types/database.ts`, after the `Message` type:

```typescript
export type VacationRequest = {
  id: string
  teacher_id: string
  start_date: string   // "YYYY-MM-DD"
  end_date: string     // "YYYY-MM-DD"
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  decided_at: string | null
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add VacationRequest type"
```

---

## Task 3: Teacher server action

**Files:**
- Create: `src/app/reports/vacationActions.ts`

- [ ] **Step 1: Create the server action file**

```typescript
// src/app/reports/vacationActions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitVacationRequest(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' }

  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string
  const note = (formData.get('note') as string)?.trim() || null

  if (!startDate || !endDate) return { error: 'נא לבחור תאריכים' }
  if (startDate > endDate) return { error: 'תאריך ההתחלה חייב להיות לפני תאריך הסיום' }

  const { error } = await supabase.from('vacation_requests').insert({
    teacher_id: user.id,
    start_date: startDate,
    end_date: endDate,
    note,
  })
  if (error) return { error: 'שגיאה בשליחת הבקשה: ' + error.message }

  revalidatePath('/reports')
  return {}
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/reports/vacationActions.ts
git commit -m "feat: add submitVacationRequest server action"
```

---

## Task 4: `VacationSection` client component

**Files:**
- Create: `src/app/reports/VacationSection.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/app/reports/VacationSection.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { VacationRequest } from '@/types/database'
import { submitVacationRequest } from './vacationActions'

interface Props {
  initialRequests: VacationRequest[]
}

function StatusBadge({ status }: { status: VacationRequest['status'] }) {
  if (status === 'approved')
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">אושר</span>
  if (status === 'rejected')
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">נדחה</span>
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">ממתין</span>
}

export default function VacationSection({ initialRequests }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await submitVacationRequest(formData)
      if (result.error === 'unauthorized') { router.push('/login'); return }
      if (result.error) { setError(result.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="px-4 pb-6 max-w-md mx-auto w-full flex flex-col gap-4 print:hidden" dir="rtl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-700">בקשות חופשה</p>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 transition-colors"
          >
            + בקשי חופשה
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-sm font-bold text-teal-800">בקשת חופשה חדשה</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-teal-700 mb-1">מתאריך</label>
              <input
                name="start_date"
                type="date"
                required
                className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-teal-700 mb-1">עד תאריך</label>
              <input
                name="end_date"
                type="date"
                required
                className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-sm focus:outline-none focus:border-teal-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-teal-700 mb-1">הערה (אופציונלי)</label>
            <textarea
              name="note"
              rows={2}
              placeholder="סיבה או פרטים נוספים..."
              className="w-full border border-teal-200 bg-white rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-400"
              dir="rtl"
            />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors"
            >
              {isPending ? 'שולחת...' : 'שלחי'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError('') }}
              className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      {initialRequests.length === 0 && !open && (
        <p className="text-xs text-gray-400 text-center py-4">אין בקשות חופשה</p>
      )}

      {initialRequests.map(req => (
        <div key={req.id} className="bg-white rounded-2xl shadow-sm px-4 py-3.5">
          <div className="flex items-center justify-between mb-1">
            <StatusBadge status={req.status} />
            <span className="text-[10px] text-gray-400">
              {new Date(req.created_at).toLocaleDateString('he-IL')}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-1">
            {new Date(req.start_date + 'T12:00:00').toLocaleDateString('he-IL')} –{' '}
            {new Date(req.end_date + 'T12:00:00').toLocaleDateString('he-IL')}
          </p>
          {req.note && <p className="text-xs text-gray-500 mt-1">{req.note}</p>}
          {req.status === 'rejected' && req.admin_note && (
            <p className="text-xs text-red-600 mt-1 bg-red-50 rounded-lg px-2 py-1">
              הערת המזכירות: {req.admin_note}
            </p>
          )}
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

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/reports/VacationSection.tsx
git commit -m "feat: add VacationSection client component"
```

---

## Task 5: Integrate `VacationSection` into reports page

**Files:**
- Modify: `src/app/reports/page.tsx`

- [ ] **Step 1: Add imports at the top of `src/app/reports/page.tsx`**

After the existing imports, add:

```typescript
import VacationSection from './VacationSection'
import type { VacationRequest } from '@/types/database'
```

- [ ] **Step 2: Fetch vacation requests**

Inside `ReportsPage()`, right after `const { data: { user } } = await supabase.auth.getUser()` and the redirect, add:

```typescript
const { data: vacationsRaw } = await supabase
  .from('vacation_requests')
  .select('*')
  .eq('teacher_id', user.id)
  .order('created_at', { ascending: false })
const vacationRequests = (vacationsRaw ?? []) as VacationRequest[]
```

- [ ] **Step 3: Render `VacationSection` in the return**

In the main return (the one that renders `reportData.map`), add `<VacationSection>` just before `<BottomNav />`:

```tsx
      <VacationSection initialRequests={vacationRequests} />

      <BottomNav />
```

Also add `<VacationSection>` to the early-return branch (when `groups.length === 0`), just before the closing `</div>`:

```tsx
        <VacationSection initialRequests={vacationRequests} />
      </div>
```

Note: the early-return branch also needs `vacationRequests` — the fetch added in Step 2 runs before the early return, so it is available.

- [ ] **Step 4: Verify and test**

```bash
npx tsc --noEmit
npm run dev
```

Open `/reports` as a teacher. Confirm:
- "בקשות חופשה" section appears below the attendance reports
- "+ בקשי חופשה" button opens the form
- Submit with valid dates → form closes, request appears with "ממתין" badge
- Submit with end_date < start_date → error "תאריך ההתחלה חייב להיות לפני תאריך הסיום"

- [ ] **Step 5: Commit**

```bash
git add src/app/reports/page.tsx
git commit -m "feat: add vacation requests section to reports page"
```

---

## Task 6: Admin server action

**Files:**
- Create: `src/app/admin/messages/vacationActions.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/app/admin/messages/vacationActions.ts
'use server'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const { supabase } = await _requireAdmin('/admin')
  return { supabase }
}

export async function decideVacationRequest(
  id: string,
  status: 'approved' | 'rejected',
  adminNote?: string,
): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('vacation_requests')
    .update({
      status,
      admin_note: adminNote?.trim() || null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: 'שגיאה בעדכון הבקשה: ' + error.message }
  revalidatePath('/admin/messages')
  return {}
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/messages/vacationActions.ts
git commit -m "feat: add decideVacationRequest server action"
```

---

## Task 7: Update `MessagesInboxClient` with tabs

**Files:**
- Modify: `src/app/admin/messages/MessagesInboxClient.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
// src/app/admin/messages/MessagesInboxClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { replyToMessage } from './messageActions'
import { decideVacationRequest } from './vacationActions'

type MessageWithTeacher = {
  id: string
  teacher_id: string
  content: string
  reply: string | null
  status: 'pending' | 'replied'
  created_at: string
  replied_at: string | null
  teachers: { name: string } | null
}

type VacationRequestWithTeacher = {
  id: string
  teacher_id: string
  start_date: string
  end_date: string
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  decided_at: string | null
  teachers: { name: string } | null
}

interface Props {
  initialMessages: MessageWithTeacher[]
  initialVacationRequests: VacationRequestWithTeacher[]
}

export default function MessagesInboxClient({ initialMessages, initialVacationRequests }: Props) {
  const [tab, setTab] = useState<'messages' | 'vacations'>('messages')
  const [messages, setMessages] = useState<MessageWithTeacher[]>(initialMessages)
  const [vacations, setVacations] = useState<VacationRequestWithTeacher[]>(initialVacationRequests)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin-messages-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, async () => {
        const { data } = await supabase
          .from('messages')
          .select('*, teachers(name)')
          .order('created_at', { ascending: false })
        if (data) setMessages(data as MessageWithTeacher[])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vacation_requests' }, async () => {
        const { data } = await supabase
          .from('vacation_requests')
          .select('*, teachers(name)')
          .order('created_at', { ascending: false })
        if (data) setVacations(data as VacationRequestWithTeacher[])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleReply(id: string) {
    const reply = replyTexts[id] ?? ''
    setErrors(prev => ({ ...prev, [id]: '' }))
    setPendingIds(prev => new Set(prev).add(id))
    const result = await replyToMessage(id, reply)
    setPendingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    if (result.error) { setErrors(prev => ({ ...prev, [id]: result.error! })); return }
    setReplyTexts(prev => ({ ...prev, [id]: '' }))
  }

  async function handleDecide(id: string, status: 'approved' | 'rejected') {
    setErrors(prev => ({ ...prev, [id]: '' }))
    setPendingIds(prev => new Set(prev).add(id))
    const result = await decideVacationRequest(id, status, adminNotes[id])
    setPendingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    if (result.error) { setErrors(prev => ({ ...prev, [id]: result.error! })); return }
    setRejectingId(null)
    setAdminNotes(prev => { const s = { ...prev }; delete s[id]; return s })
  }

  const pendingMessages = messages.filter(m => m.status === 'pending').length
  const pendingVacations = vacations.filter(v => v.status === 'pending').length
  const pending = messages.filter(m => m.status === 'pending')
  const replied = messages.filter(m => m.status === 'replied')
  const pendingVac = vacations.filter(v => v.status === 'pending')
  const decidedVac = vacations.filter(v => v.status !== 'pending')

  return (
    <div dir="rtl">
      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-5">
        <button
          onClick={() => setTab('messages')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            tab === 'messages' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          הודעות{pendingMessages > 0 ? ` (${pendingMessages})` : ''}
        </button>
        <button
          onClick={() => setTab('vacations')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            tab === 'vacations' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          בקשות חופשה{pendingVacations > 0 ? ` (${pendingVacations})` : ''}
        </button>
      </div>

      {/* Messages tab */}
      {tab === 'messages' && (
        <div className="px-4 py-5 flex flex-col gap-5">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">אין הודעות עדיין</p>
          )}
          {pending.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                ממתינות לתשובה ({pending.length})
              </p>
              {pending.map(msg => (
                <div key={msg.id} className="bg-white rounded-2xl shadow-sm p-4 border border-amber-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800">
                      {msg.teachers?.name ?? 'מורה לא ידועה'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.created_at).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{msg.content}</p>
                  <textarea
                    value={replyTexts[msg.id] ?? ''}
                    onChange={e => setReplyTexts(prev => ({ ...prev, [msg.id]: e.target.value }))}
                    placeholder="כתבי תשובה..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-400"
                    dir="rtl"
                  />
                  {errors[msg.id] && (
                    <p className="text-xs text-red-500 mt-1">{errors[msg.id]}</p>
                  )}
                  <button
                    onClick={() => handleReply(msg.id)}
                    disabled={pendingIds.has(msg.id) || !(replyTexts[msg.id] ?? '').trim()}
                    className="mt-2 px-4 py-1.5 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 disabled:opacity-40 transition-colors"
                  >
                    {pendingIds.has(msg.id) ? 'שולח...' : 'ענה'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {replied.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                נענו ({replied.length})
              </p>
              {replied.map(msg => (
                <div key={msg.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">
                      {msg.teachers?.name ?? 'מורה לא ידועה'}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      נענה
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{msg.content}</p>
                  <p className="text-sm text-emerald-700 font-medium">{msg.reply}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vacations tab */}
      {tab === 'vacations' && (
        <div className="px-4 py-5 flex flex-col gap-5">
          {vacations.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">אין בקשות חופשה עדיין</p>
          )}
          {pendingVac.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                ממתינות ({pendingVac.length})
              </p>
              {pendingVac.map(vac => (
                <div key={vac.id} className="bg-white rounded-2xl shadow-sm p-4 border border-amber-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800">
                      {vac.teachers?.name ?? 'מורה לא ידועה'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(vac.created_at).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">
                    {new Date(vac.start_date + 'T12:00:00').toLocaleDateString('he-IL')} –{' '}
                    {new Date(vac.end_date + 'T12:00:00').toLocaleDateString('he-IL')}
                  </p>
                  {vac.note && (
                    <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1">{vac.note}</p>
                  )}
                  {errors[vac.id] && (
                    <p className="text-xs text-red-500 mt-1">{errors[vac.id]}</p>
                  )}
                  {rejectingId === vac.id && (
                    <textarea
                      value={adminNotes[vac.id] ?? ''}
                      onChange={e => setAdminNotes(prev => ({ ...prev, [vac.id]: e.target.value }))}
                      placeholder="הערת דחייה (אופציונלי)..."
                      rows={2}
                      className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-red-400"
                      dir="rtl"
                    />
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleDecide(vac.id, 'approved')}
                      disabled={pendingIds.has(vac.id)}
                      className="flex-1 py-1.5 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-40 transition-colors"
                    >
                      {pendingIds.has(vac.id) && rejectingId !== vac.id ? '...' : 'אשר'}
                    </button>
                    {rejectingId === vac.id ? (
                      <>
                        <button
                          onClick={() => handleDecide(vac.id, 'rejected')}
                          disabled={pendingIds.has(vac.id)}
                          className="flex-1 py-1.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 disabled:opacity-40 transition-colors"
                        >
                          {pendingIds.has(vac.id) ? '...' : 'אשרי דחייה'}
                        </button>
                        <button
                          onClick={() => setRejectingId(null)}
                          className="flex-1 py-1.5 bg-gray-100 text-gray-500 text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          ביטול
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setRejectingId(vac.id)}
                        disabled={pendingIds.has(vac.id)}
                        className="flex-1 py-1.5 bg-red-50 text-red-500 text-sm font-bold rounded-xl hover:bg-red-100 disabled:opacity-40 transition-colors"
                      >
                        דחה
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {decidedVac.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                היסטוריה ({decidedVac.length})
              </p>
              {decidedVac.map(vac => (
                <div key={vac.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">
                      {vac.teachers?.name ?? 'מורה לא ידועה'}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      vac.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {vac.status === 'approved' ? 'אושר' : 'נדחה'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    {new Date(vac.start_date + 'T12:00:00').toLocaleDateString('he-IL')} –{' '}
                    {new Date(vac.end_date + 'T12:00:00').toLocaleDateString('he-IL')}
                  </p>
                  {vac.admin_note && (
                    <p className="text-xs text-gray-500 mt-1">{vac.admin_note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
git add src/app/admin/messages/MessagesInboxClient.tsx
git commit -m "feat: add tabs and vacation requests to MessagesInboxClient"
```

---

## Task 8: Update admin messages page

**Files:**
- Modify: `src/app/admin/messages/page.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
// src/app/admin/messages/page.tsx
import { requireAdmin } from '@/lib/auth'
import MessagesInboxClient from './MessagesInboxClient'

export const dynamic = 'force-dynamic'

type MessageWithTeacher = {
  id: string
  teacher_id: string
  content: string
  reply: string | null
  status: 'pending' | 'replied'
  created_at: string
  replied_at: string | null
  teachers: { name: string } | null
}

type VacationRequestWithTeacher = {
  id: string
  teacher_id: string
  start_date: string
  end_date: string
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  decided_at: string | null
  teachers: { name: string } | null
}

export default async function AdminMessagesPage() {
  const { supabase } = await requireAdmin()

  const [{ data: messagesRaw }, { data: vacationsRaw }] = await Promise.all([
    supabase.from('messages').select('*, teachers(name)').order('created_at', { ascending: false }),
    supabase.from('vacation_requests').select('*, teachers(name)').order('created_at', { ascending: false }),
  ])

  const messages = (messagesRaw ?? []) as MessageWithTeacher[]
  const vacationRequests = (vacationsRaw ?? []) as VacationRequestWithTeacher[]

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">ניהול</p>
        <h1 className="text-xl font-bold">הודעות מורים</h1>
      </div>
      <MessagesInboxClient initialMessages={messages} initialVacationRequests={vacationRequests} />
    </div>
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
git add src/app/admin/messages/page.tsx
git commit -m "feat: fetch vacation requests in admin messages page"
```

---

## Task 9: Update `AdminLayout` badge count

**Files:**
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Replace the entire file**

```typescript
// src/app/admin/layout.tsx
import AdminNav from '@/components/layout/AdminNav'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createAdminClient()

  const [
    { count: bugsCount, error: bugsError },
    { count: messagesCount, error: messagesError },
    { count: vacationsCount, error: vacationsError },
  ] = await Promise.all([
    supabase.from('bug_reports').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('vacation_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  if (bugsError) console.error('[AdminLayout] bug count fetch failed:', bugsError.message)
  if (messagesError) console.error('[AdminLayout] messages count fetch failed:', messagesError.message)
  if (vacationsError) console.error('[AdminLayout] vacations count fetch failed:', vacationsError.message)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <AdminNav
        bugsCount={bugsCount ?? 0}
        messagesCount={(messagesCount ?? 0) + (vacationsCount ?? 0)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Full end-to-end test**

```bash
npx tsc --noEmit
npm run dev
```

**Teacher flow:**
1. Log in as a teacher → go to `/reports`
2. Scroll down → see "בקשות חופשה" section
3. Click "+ בקשי חופשה" → form opens
4. Fill dates + optional note → click "שלחי" → form closes, request appears with "ממתין" badge

**Admin flow:**
1. Log in as admin → go to `/admin/messages`
2. See two tabs: "הודעות" and "בקשות חופשה"
3. Click "בקשות חופשה" → see pending request with teacher name + dates
4. Click "אשר" → request moves to history with "אושר" badge
5. Submit another request as teacher → admin clicks "דחה" → note textarea appears → confirm → moves to history with "נדחה"

**Badge:**
- AdminNav badge on "הודעות" nav item shows combined pending count

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat: add vacation requests to admin nav badge count"
```
