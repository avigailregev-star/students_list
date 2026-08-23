# Teacher Invite Link Fallback Design

## Goal

Gmail sometimes silently drops the teacher-invite email (no bounce, no error — see memory `project-email-invite-issue`). Today the generated invite/recovery link only ever goes out through that email; if the send is swallowed, the admin has no way to retrieve or resend the link. This adds a way to view and copy the invite link directly in the admin UI as a manual fallback (WhatsApp, SMS, etc.), regardless of whether the email succeeded.

---

## Data Flow

### `src/app/admin/teachers/actions.ts`

Change the return shape of `inviteTeacher` and `resendTeacherInvite` from `string | void` (error message or success) to a structured result:

```typescript
type InviteResult = {
  error?: string
  link?: string
  newUserId?: string // only set by inviteTeacher when a new auth user was created
}
```

- `link` and `newUserId` are populated as soon as the invite/recovery link is generated and the DB is consistent — regardless of whether `sendTeacherInviteEmail` succeeds afterward.
- `error` is set only when link generation itself fails (no link exists at all). If link generation succeeds but the email send throws, that is **not** treated as an error anymore — the function still returns `{ link, newUserId }` so the UI can show the link as the fallback.
- **Remove** the `redirect()` call currently at the end of `inviteTeacher`. Navigation to the new teacher page moves to the client, triggered by the "המשך" button (see below), using `newUserId` from the result.
- `resendTeacherInvite` keeps calling `revalidatePath` but does not redirect (it already doesn't).

---

## UI: `ResendInviteButton.tsx`

After clicking "שלח הזמנה", the button area is replaced by a result panel (state `status: 'idle' | 'sending' | 'link' | 'error'`):

- A read-only text field containing the full `link`.
- A "העתק" button that copies the link via `navigator.clipboard.writeText`, with a transient "הועתק!" confirmation (e.g. 2s timeout, matching the existing "sent" style already in this component).
- Static hint text: "הקישור בתוקף ל-24 שעות".
- A primary "המשך" button:
  - If `isPending` (new teacher invite): navigates via `useRouter().push('/admin/teachers/' + newUserId)` when clicked.
  - If resending to an existing teacher: just dismisses the panel back to idle (no navigation needed, since the admin is already on the right page).

`status === 'error'` (link generation itself failed) keeps the existing inline red error message — no link panel is shown in that case, since there is nothing to copy.

The email is still sent in the background as before (best-effort); its success/failure no longer affects what the admin sees. This is a deliberate behavior change: the admin now always sees the link, not just on email failure — this was chosen over an "only on failure" mode because it's simpler (one code path) and mirrors how the admin already treats the on-screen link as the primary channel with email as a courtesy.

---

## Error Handling

- Link generation failure (both `generateLink` calls fail, or DB write fails): show the existing red error text, no link panel.
- Email send failure after a successful link generation: swallowed silently from the UI's perspective — the link panel still renders normally. (Optionally the panel could show a small muted note like "המייל לא נשלח, אפשר להעתיק את הקישור ידנית" — left as a nice-to-have, not required for this change since the link is shown either way.)

---

## Out of Scope

- No changes to `sendTeacherInviteEmail` / `src/lib/email.ts` itself.
- No changes to link expiry (still Supabase's default 24h for these link types).
- No WhatsApp/SMS share-sheet integration — copy-to-clipboard only, per user's choice.
