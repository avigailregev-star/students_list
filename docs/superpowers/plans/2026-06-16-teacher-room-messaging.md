# Teacher My-Room + Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/my-room` page where teachers see their room assignment for today and can send messages to the secretary, who receives and replies from a dedicated `/admin/messages` inbox with real-time notifications.

**Architecture:** New `messages` Supabase table with RLS. Teacher actions use `createClient()` (RLS enforces ownership). Admin actions use the `requireAdmin` wrapper. Supabase Realtime subscriptions provide live updates on both sides. Admin badge and card on `/admin` page update in real time via a client component.

**Tech Stack:** Next.js App Router, Supabase (RLS + Realtime), Tailwind CSS, TypeScript, Hebrew RTL UI

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/types/database.ts` | Modify | Add `Message` type |
| `src/app/my-room/messageActions.ts` | Create | `sendMessage` server action |
| `src/app/my-room/page.tsx` | Create | Teacher server component |
| `src/app/my-room/MyRoomClient.tsx` | Create | Room card + send form + history + Realtime |
| `src/app/admin/messages/messageActions.ts` | Create | `replyToMessage` server action |
| `src/app/admin/messages/page.tsx` | Create | Admin inbox server component |
| `src/app/admin/messages/MessagesInboxClient.tsx` | Create | Inbox list + reply forms + Realtime |
| `src/app/admin/PendingMessagesCard.tsx` | Create | Realtime pending count card for /admin |
| `src/app/admin/page.tsx` | Modify | Add PendingMessagesCard |
| `src/app/admin/layout.tsx` | Modify | Fetch messagesCount, pass to AdminNav |
| `src/components/layout/AdminNav.tsx` | Modify | Add `messagesCount` prop + "הודעות" nav item |
| `src/components/layout/BottomNav.tsx` | Modify | Change "חדרים" href from `/rooms` to `/my-room` |

---

## Task 1: SQL Migration + TypeScript Type

**Files:**
- SQL: run manually in Supabase Dashboard SQL editor
- Modify: `src/types/database.ts`

- [ ] **Step 1: Run the migration in Supabase Dashboard**

Open Supabase Dashboard → SQL Editor → New Query → paste and run:

```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  content text not null,
  reply text,
  status text not null default 'pending' check (status in ('pending', 'replied')),
  created_at timestamptz default now(),
  replied_at timestamptz
);

alter table messages enable row level security;

create policy "messages_teacher_read_own" on messages
  for select using (teacher_id = auth.uid());

create policy "messages_teacher_insert" on messages
  for insert with check (teacher_id = auth.uid());

create policy "messages_admin_all" on messages
  for all using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );
```

Expected: "Success. No rows returned."

- [ ] **Step 2: Add `Message` type to `src/types/database.ts`**

At the end of the file, after the `TeacherRoomAssignment` type, add:

```typescript
export type Message = {
  id: string
  teacher_id: string
  content: string
  reply: string | null
  status: 'pending' | 'replied'
  created_at: string
  replied_at: string | null
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd teacher-attendance-app
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add Message type for teacher-secretary messaging"
```

---

## Task 2: Teacher Server Action — `sendMessage`

**Files:**
- Create: `src/app/my-room/messageActions.ts`

- [ ] **Step 1: Create `src/app/my-room/messageActions.ts`**

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function sendMessage(content: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trimmed = content.trim()
  if (!trimmed) return { error: 'ההודעה לא יכולה להיות ריקה' }

  const { error } = await supabase.from('messages').insert({
    teacher_id: user.id,
    content: trimmed,
  })
  if (error) return { error: 'שגיאה בשליחת ההודעה: ' + error.message }

  revalidatePath('/my-room')
  return {}
}
```

Note: uses `createClient()` (not admin client) — RLS policy `messages_teacher_insert` enforces `teacher_id = auth.uid()`, so no admin privileges needed.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/my-room/messageActions.ts
git commit -m "feat: add sendMessage server action"
```

---

## Task 3: Teacher `/my-room` Page

**Files:**
- Create: `src/app/my-room/page.tsx`
- Create: `src/app/my-room/MyRoomClient.tsx`

- [ ] **Step 1: Create `src/app/my-room/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Message, TeacherRoomAssignment } from '@/types/database'
import MyRoomClient from './MyRoomClient'
import BottomNav from '@/components/layout/BottomNav'

export const dynamic = 'force-dynamic'

export default async function MyRoomPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = teacher?.role === 'admin'

  const dow = new Date().getDay() // 0=Sun … 6=Sat

  const [{ data: assignmentRaw }, { data: messagesRaw }] = await Promise.all([
    supabase
      .from('teacher_room_assignments')
      .select('*, rooms(name)')
      .eq('teacher_id', user.id)
      .eq('day_of_week', dow)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('*')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const roomName =
    (assignmentRaw as (TeacherRoomAssignment & { rooms: { name: string } | null }) | null)
      ?.rooms?.name ?? null
  const messages = (messagesRaw ?? []) as Message[]

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">קונסרבטוריון דימונה</p>
        <h1 className="text-xl font-bold">החדר שלי</h1>
      </div>
      <MyRoomClient roomName={roomName} initialMessages={messages} userId={user.id} />
      <BottomNav isAdmin={isAdmin} />
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/my-room/MyRoomClient.tsx`**

```typescript
'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/types/database'
import { sendMessage } from './messageActions'

interface Props {
  roomName: string | null
  initialMessages: Message[]
  userId: string
}

export default function MyRoomClient({ roomName, initialMessages, userId }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [content, setContent] = useState('')
  const [sendError, setSendError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('my-messages')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `teacher_id=eq.${userId}`,
      }, async () => {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('teacher_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)
        if (data) setMessages(data as Message[])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  function handleSend() {
    if (!content.trim()) return
    setSendError('')
    startTransition(async () => {
      const result = await sendMessage(content)
      if (result.error) { setSendError(result.error); return }
      setContent('')
    })
  }

  return (
    <div className="px-4 py-5 flex flex-col gap-4" dir="rtl">
      {/* Room card */}
      {roomName ? (
        <div className="bg-emerald-500 text-white rounded-2xl px-5 py-5 shadow-sm shadow-emerald-200">
          <p className="text-xs font-semibold opacity-80 mb-1">החדר שלך היום</p>
          <p className="text-3xl font-bold">{roomName}</p>
        </div>
      ) : (
        <div className="bg-gray-100 rounded-2xl px-5 py-5">
          <p className="text-sm text-gray-400 font-semibold">לא שובצת לחדר היום</p>
        </div>
      )}

      <Link href="/rooms" className="text-xs text-teal-500 font-semibold">
        ← ראי את הלוח השבועי
      </Link>

      {/* Send message */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
        <p className="text-sm font-bold text-gray-700">שליחת הודעה למזכירות</p>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="כתבי את בקשתך כאן..."
          rows={3}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-teal-400"
          dir="rtl"
        />
        {sendError && <p className="text-xs text-red-500">{sendError}</p>}
        <button
          onClick={handleSend}
          disabled={isPending || !content.trim()}
          className="self-end px-5 py-2 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 disabled:opacity-40 transition-colors"
        >
          {isPending ? 'שולחת...' : 'שלחי'}
        </button>
      </div>

      {/* Messages history */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">הודעות שלי</p>
          {messages.map(msg => (
            <div key={msg.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  msg.status === 'replied'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {msg.status === 'replied' ? 'נענה' : 'ממתין'}
                </span>
                <span className="text-[10px] text-gray-400">
                  {new Date(msg.created_at).toLocaleDateString('he-IL')}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-2">{msg.content}</p>
              {msg.reply && (
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <p className="text-xs text-gray-400 font-semibold mb-1">תשובת המזכירות:</p>
                  <p className="text-sm text-emerald-700 font-medium">{msg.reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Open browser and verify `/my-room`**

Navigate to `http://localhost:3000/my-room` (logged in as a teacher).
- If teacher has a room assignment today: big green card with room name
- If no assignment: gray "לא שובצת לחדר היום" card
- "← ראי את הלוח השבועי" link is visible
- Send message form appears
- Type a message and click "שלחי" — message appears in history below with "ממתין" badge

- [ ] **Step 5: Commit**

```bash
git add src/app/my-room/page.tsx src/app/my-room/MyRoomClient.tsx
git commit -m "feat: add /my-room page with room card and message form"
```

---

## Task 4: Admin Reply Action

**Files:**
- Create: `src/app/admin/messages/messageActions.ts`

- [ ] **Step 1: Create `src/app/admin/messages/messageActions.ts`**

```typescript
'use server'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const { supabase } = await _requireAdmin('/admin')
  return { supabase }
}

export async function replyToMessage(id: string, reply: string): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin()

  const trimmed = reply.trim()
  if (!trimmed) return { error: 'התשובה לא יכולה להיות ריקה' }

  const { error } = await supabase
    .from('messages')
    .update({
      reply: trimmed,
      status: 'replied',
      replied_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: 'שגיאה בשמירת התשובה: ' + error.message }
  revalidatePath('/admin/messages')
  return {}
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/messages/messageActions.ts
git commit -m "feat: add replyToMessage admin server action"
```

---

## Task 5: Admin Messages Inbox Page

**Files:**
- Create: `src/app/admin/messages/page.tsx`
- Create: `src/app/admin/messages/MessagesInboxClient.tsx`

- [ ] **Step 1: Create `src/app/admin/messages/page.tsx`**

```typescript
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

export default async function AdminMessagesPage() {
  const { supabase } = await requireAdmin()

  const { data: messagesRaw } = await supabase
    .from('messages')
    .select('*, teachers(name)')
    .order('created_at', { ascending: false })

  const messages = (messagesRaw ?? []) as MessageWithTeacher[]

  return (
    <div className="flex flex-col min-h-screen">
      <div className="bg-gradient-to-bl from-teal-400 to-teal-600 text-white rounded-b-[36px] shadow-lg shadow-teal-200 px-5 pt-10 pb-7">
        <p className="text-xs font-semibold text-teal-100 uppercase tracking-widest">ניהול</p>
        <h1 className="text-xl font-bold">הודעות מורים</h1>
      </div>
      <MessagesInboxClient initialMessages={messages} />
    </div>
  )
}
```

Note: No `<AdminNav>` here — the admin layout (`src/app/admin/layout.tsx`) renders `<AdminNav>` automatically for all `/admin/*` routes.

- [ ] **Step 2: Create `src/app/admin/messages/MessagesInboxClient.tsx`**

```typescript
'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { replyToMessage } from './messageActions'

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

interface Props {
  initialMessages: MessageWithTeacher[]
}

export default function MessagesInboxClient({ initialMessages }: Props) {
  const [messages, setMessages] = useState<MessageWithTeacher[]>(initialMessages)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin-messages-inbox')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
      }, async () => {
        const { data } = await supabase
          .from('messages')
          .select('*, teachers(name)')
          .order('created_at', { ascending: false })
        if (data) setMessages(data as MessageWithTeacher[])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function handleReply(id: string) {
    const reply = replyTexts[id] ?? ''
    setErrors(prev => ({ ...prev, [id]: '' }))
    startTransition(async () => {
      const result = await replyToMessage(id, reply)
      if (result.error) {
        setErrors(prev => ({ ...prev, [id]: result.error! }))
        return
      }
      setReplyTexts(prev => ({ ...prev, [id]: '' }))
    })
  }

  const pending = messages.filter(m => m.status === 'pending')
  const replied = messages.filter(m => m.status === 'replied')

  return (
    <div className="px-4 py-5 flex flex-col gap-5" dir="rtl">
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
                disabled={isPending || !(replyTexts[msg.id] ?? '').trim()}
                className="mt-2 px-4 py-1.5 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 disabled:opacity-40 transition-colors"
              >
                ענה
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
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Open browser and verify `/admin/messages`**

Navigate to `http://localhost:3000/admin/messages` (logged in as admin).
- Page loads with teal header "הודעות מורים"
- If a teacher sent a message in Task 3: it appears under "ממתינות לתשובה"
- Type a reply and click "ענה" → message moves to "נענו" section
- In the teacher's `/my-room` tab: reply appears automatically (Realtime) under "תשובת המזכירות:"

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/messages/page.tsx src/app/admin/messages/MessagesInboxClient.tsx
git commit -m "feat: add /admin/messages inbox with real-time reply"
```

---

## Task 6: Admin Dashboard Pending Card

**Files:**
- Create: `src/app/admin/PendingMessagesCard.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Create `src/app/admin/PendingMessagesCard.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function PendingMessagesCard({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('pending-messages-card')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
      }, async () => {
        const { count: newCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        setCount(newCount ?? 0)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (count === 0) return null

  return (
    <Link
      href="/admin/messages"
      className="bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 flex items-center gap-3"
    >
      <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-violet-700">{count} הודעות ממתינות לתשובה</p>
        <p className="text-xs text-violet-400">לחצי לטיפול</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </Link>
  )
}
```

- [ ] **Step 2: Modify `src/app/admin/page.tsx`**

Add the import at the top (after the existing import):
```typescript
import PendingMessagesCard from './PendingMessagesCard'
```

In the `Promise.all` call, add a third query for pending messages count:
```typescript
const [{ count: teacherCount }, { count: pendingCount }, { count: pendingMessagesCount }] = await Promise.all([
  supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
  supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('admin_approval_status', 'pending'),
  supabase.from('messages').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
])
```

Add `<PendingMessagesCard>` in the JSX, right after the pending sick-leave block and before `{/* Quick links */}`:
```tsx
<PendingMessagesCard initialCount={pendingMessagesCount ?? 0} />
```

The full updated JSX section:
```tsx
{/* Pending sick leave */}
{(pendingCount ?? 0) > 0 && (
  <a href="/admin/sick-leave" className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
    <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    </div>
    <div className="flex-1">
      <p className="text-sm font-bold text-amber-700">{pendingCount} בקשות מחלה ממתינות לאישור</p>
      <p className="text-xs text-amber-500">לחצי לאישור</p>
    </div>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  </a>
)}

<PendingMessagesCard initialCount={pendingMessagesCount ?? 0} />

{/* Quick links */}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Open browser and verify `/admin`**

Navigate to `http://localhost:3000/admin`.
- If there are pending messages: violet card appears "X הודעות ממתינות לתשובה"
- Clicking it goes to `/admin/messages`
- When a teacher sends a new message from `/my-room`, the count on this card updates in real time (without page refresh)

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/PendingMessagesCard.tsx src/app/admin/page.tsx
git commit -m "feat: add real-time pending messages card to admin dashboard"
```

---

## Task 7: Navigation Updates

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/components/layout/AdminNav.tsx`
- Modify: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Modify `src/app/admin/layout.tsx`**

Add a fetch for pending messages count alongside the existing bugs count fetch:

```typescript
import AdminNav from '@/components/layout/AdminNav'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createAdminClient()

  const [{ count: bugsCount, error: bugsError }, { count: messagesCount, error: messagesError }] =
    await Promise.all([
      supabase.from('bug_reports').select('*', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('messages').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ])

  if (bugsError) console.error('[AdminLayout] bug count fetch failed:', bugsError.message)
  if (messagesError) console.error('[AdminLayout] messages count fetch failed:', messagesError.message)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <AdminNav bugsCount={bugsCount ?? 0} messagesCount={messagesCount ?? 0} />
    </div>
  )
}
```

- [ ] **Step 2: Modify `src/components/layout/AdminNav.tsx`**

Change the component signature and add a "הודעות" nav item with badge. Full replacement of the relevant sections:

Change the interface at the top:
```typescript
export default function AdminNav({ bugsCount = 0, messagesCount = 0 }: { bugsCount?: number; messagesCount?: number }) {
```

Add the "הודעות" item to `NAV_ITEMS` array, after the "חדרים" item and before "מחלות":
```typescript
{
  href: '/admin/messages',
  label: 'הודעות',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  badge: messagesCount,
},
```

- [ ] **Step 3: Modify `src/components/layout/BottomNav.tsx`**

Change the `href` for the "חדרים" item from `/rooms` to `/my-room`:

```typescript
{
  href: '/my-room',
  label: 'חדרים',
  icon: (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#14b8a6' : '#9ca3af'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <line x1="9" y1="22" x2="9" y2="12"/>
      <line x1="15" y1="22" x2="15" y2="12"/>
    </svg>
  ),
},
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Full end-to-end verification**

1. Open `/my-room` as a teacher — bottom nav "חדרים" tab is now active on this page
2. Open `/admin` as admin — AdminNav shows "הודעות" item with badge count if there are pending messages
3. Send a message as teacher → badge in AdminNav updates in real time
4. Reply as admin → teacher sees reply in `/my-room` Realtime, badge disappears from AdminNav

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/layout.tsx src/components/layout/AdminNav.tsx src/components/layout/BottomNav.tsx
git commit -m "feat: wire navigation for messages badge and /my-room bottom nav"
```
