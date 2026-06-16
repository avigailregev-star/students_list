# Teacher My-Room + Messaging Design

## Goal

Each teacher sees which room they're assigned to today on a dedicated page (`/my-room`), and can send a message/request to the secretary. The secretary receives messages in real-time, replies from a dedicated inbox, and a badge on `/admin` shows the pending count live.

---

## Data Model

### New table: `messages`

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

-- Teachers: read and insert their own messages only
create policy "messages_teacher_read_own" on messages
  for select using (teacher_id = auth.uid());

create policy "messages_teacher_insert" on messages
  for insert with check (teacher_id = auth.uid());

-- Admins: full access
create policy "messages_admin_all" on messages
  for all using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );
```

### TypeScript type (add to `src/types/database.ts`)

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

---

## Pages & Components

### 1. `/my-room` — Teacher dedicated page

**Server component** (`src/app/my-room/page.tsx`):
- Requires auth; redirects to `/login` if not authenticated
- Fetches:
  - Today's `teacher_room_assignments` row for current user (joined with `rooms`)
  - Last 10 `messages` for current user (ordered by `created_at` desc)
- Passes data to `<MyRoomClient>`

**`src/app/my-room/MyRoomClient.tsx`** (client component):
- **Room card**: large, prominent — "החדר שלך היום: חדר 3" in green. If no assignment: "לא שובצת לחדר היום" in gray.
- **Link**: "ראי את הלוח השבועי ←" → `/rooms`
- **Send message section**: textarea + "שלחי" button → calls `sendMessage` server action
- **Messages history**: list of last 10 messages showing content, date, status badge (ממתין / נענה), and reply text if present
- **Realtime**: subscribes to `messages` table filtered by `teacher_id=eq.${userId}` — reply appears automatically without refresh

**Navigation**: BottomNav "חדרים" href changes from `/rooms` to `/my-room`

---

### 2. `/admin/messages` — Secretary inbox

**Server component** (`src/app/admin/messages/page.tsx`):
- Requires admin auth via `requireAdmin()` from `@/lib/auth`
- Fetches all messages ordered by `created_at` desc, joined with teacher name via:
  `supabase.from('messages').select('*, teachers(name)').order('created_at', { ascending: false })`
- Renders `<MessagesInboxClient>`

**`src/app/admin/messages/MessagesInboxClient.tsx`** (client component):
- List of all messages grouped by status (pending first)
- Each pending message: teacher name, message content, date + textarea + "ענה" button → calls `replyToMessage` server action → updates row (reply + status='replied' + replied_at=now())
- Each replied message: shown in green with reply text and replied_at date
- **Realtime**: subscribes to `messages` table — new messages appear automatically

---

### 3. `/admin` — Pending messages card

**`src/app/admin/PendingMessagesCard.tsx`** (client component):
- Fetches count of `messages` where `status='pending'` on mount
- Subscribes to Realtime on `messages` table — recalculates count on any change
- When count > 0: renders an amber card (same visual style as the sick-leave card on /admin) linking to `/admin/messages`
- When count = 0: renders nothing
- Placed in `/admin/page.tsx` below the pending sick-leave card

**AdminNav**: Add a "הודעות" nav item → `/admin/messages`. The server component (`/admin/page.tsx`) fetches the initial pending count and passes it as `messagesCount` prop to `<AdminNav>`. AdminNav renders a red dot badge (same pattern as existing `bugsCount`).

---

## Server Actions

**`src/app/my-room/messageActions.ts`**
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// sendMessage(content: string): Promise<{ error?: string }>
//   — createClient() + supabase.auth.getUser() → redirect('/login') if no user
//   — inserts { teacher_id: user.id, content, status: 'pending' }
//   — RLS enforces teacher_id = auth.uid() (no admin client needed)
//   — calls revalidatePath('/my-room')
```

**`src/app/admin/messages/messageActions.ts`**
```typescript
'use server'
import { requireAdmin as _requireAdmin } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const { supabase } = await _requireAdmin('/admin')
  return { supabase }
}

// replyToMessage(id: string, reply: string): Promise<{ error?: string }>
//   — updates messages set reply=reply, status='replied', replied_at=now()::timestamptz
//   — calls revalidatePath('/admin/messages')
```

---

## Realtime Subscriptions

| Component | Table | Filter | Action |
|-----------|-------|--------|--------|
| `MyRoomClient` | `messages` | `teacher_id=eq.${userId}` | Refresh messages list |
| `MessagesInboxClient` | `messages` | none | Refresh full list |
| `MessagesBadge` | `messages` | none | Recount pending |

---

## Navigation Changes

**`BottomNav.tsx`**: Change "חדרים" href from `/rooms` to `/my-room`

**`AdminNav.tsx`**: Add "הודעות" nav item → `/admin/messages`. Add `messagesCount?: number` prop alongside existing `bugsCount` prop. Render red dot badge (same pattern as bugsCount).

---

## RLS Summary

| Table | Teacher | Admin |
|-------|---------|-------|
| `messages` | SELECT own, INSERT own | ALL |

---

## Out of Scope

- Push notifications (browser/mobile)
- Message threading / multi-reply
- Deleting messages
- Message categories/tags
