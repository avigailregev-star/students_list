# Admin → Teacher Messaging — Design Spec

## Overview

Add the ability for the admin to initiate messages to a specific teacher or to all teachers at once. Teachers see admin messages in their existing "my-room" page and can reply using the existing reply mechanism. All notifications are in-app only.

## Database

One new column on the existing `messages` table:

```sql
ALTER TABLE messages ADD COLUMN from_admin boolean DEFAULT false;
```

No other schema changes. Broadcast to all teachers creates one row per teacher (each with `from_admin = true` and the relevant `teacher_id`).

## Server Action

New server action in `src/app/admin/messages/messageActions.ts`:

```ts
sendAdminMessage(teacherId: string | 'all', content: string): Promise<{ error?: string }>
```

- Validates content is non-empty.
- If `teacherId === 'all'`: fetches all teacher IDs from `teachers` table, inserts one `messages` row per teacher with `from_admin = true`, `status = 'pending'`.
- If specific teacher: inserts one row with `from_admin = true`, `status = 'pending'`, `teacher_id = teacherId`.
- Returns `{ error }` on failure.

## Admin UI — `/admin/messages`

Changes to `MessagesInboxClient.tsx`:

- Add "✉️ שלח הודעה חדשה" button at the top of the page.
- Clicking opens an inline compose form (no modal/dialog needed — a panel that expands):
  - Dropdown: list of all teachers + "📢 כל המורות" option at the top.
  - Textarea for message content.
  - "שלח" button that calls `sendAdminMessage`.
  - On success: collapse form, show brief confirmation.
  - On error: show error message inline.
- Fetch teacher list for the dropdown: new server query in `AdminMessagesPage` (passed as prop to client).

## Teacher UI — `/my-room`

Changes to `MyRoomClient.tsx`:

- Admin-initiated messages (`from_admin = true`) render with blue styling and a "מהמנהל" badge, matching the mockup.
- Below each admin message: a small inline reply input ("השב למנהל...") that calls the existing `sendMessage` action.
- Regular teacher-initiated messages render exactly as today.
- Real-time subscription already filters by `teacher_id` — no changes needed for live updates.

## Data Flow

```
Admin composes → sendAdminMessage() → INSERT into messages (from_admin=true)
                                              ↓
                              Supabase Realtime pushes to teacher
                                              ↓
                          Teacher sees blue "מהמנהל" message in my-room
                                              ↓
                          Teacher replies → sendMessage() (existing flow)
                                              ↓
                          Admin sees reply in /admin/messages inbox
```

## Out of Scope

- Push notifications / WhatsApp / email.
- Message threading or linking replies to original admin messages.
- Admin seeing which teachers read a broadcast message.
- Deleting or editing sent messages.
