# Teacher Invite Link Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin view and copy the teacher invite/reset link directly in the UI, so a silently-dropped Gmail send is no longer a dead end.

**Architecture:** `inviteTeacher` and `resendTeacherInvite` (server actions in `src/app/admin/teachers/actions.ts`) change from returning `string | void` to returning a structured `InviteResult` (`{ error?, link?, newUserId? }`). The link is always returned once generated, regardless of whether the follow-up email send succeeds. The two client components that call these actions — `EditTeacherForm.tsx` (first invite) and `ResendInviteButton.tsx` (resend to existing teacher) — render a copy-to-clipboard panel with the link instead of relying solely on the email.

**Tech Stack:** Next.js 16 App Router (server actions), React 19, TypeScript, Vitest (`src/**/*.test.ts` only — no component/tsx test harness exists in this repo).

## Global Constraints

- Invite/recovery links expire in 24h (Supabase default) — copy shown in the UI: "הקישור בתוקף ל-24 שעות".
- `sendTeacherInviteEmail` failures must never surface as a blocking error to the admin anymore — the link is always the source of truth in the UI.
- No changes to `src/lib/email.ts`, link expiry, or DB schema.
- Follow existing RTL/Tailwind styling conventions already used in these files (amber = pending/action, emerald = success).

---

### Task 1: `actions.ts` — structured return value, no auto-redirect

**Files:**
- Modify: `src/app/admin/teachers/actions.ts:54-119` (`inviteTeacher`), `:137-212` (`resendTeacherInvite`)
- Test: `src/app/admin/teachers/actions.test.ts` (new file)

**Interfaces:**
- Produces: `export type InviteResult = { error?: string; link?: string; newUserId?: string }`
- Produces: `inviteTeacher(pendingId: string, email: string, name: string): Promise<InviteResult>`
- Produces: `resendTeacherInvite(teacherId: string, email: string, name: string): Promise<InviteResult>`

- [ ] **Step 1: Write the failing tests**

Create `src/app/admin/teachers/actions.test.ts`:

```typescript
import { describe, expect, test, vi, beforeEach } from 'vitest'

type Row = Record<string, any>

function createFakeFrom(tables: Record<string, Row[]>) {
  return function from(table: string) {
    const rows = tables[table] ?? (tables[table] = [])
    const filters: [string, any][] = []
    let pendingUpdate: Row | null = null
    let pendingInsert: Row | null = null
    let isDelete = false

    const applyFilters = (list: Row[]) => list.filter((r) => filters.every(([k, v]) => r[k] === v))

    const builder: any = {
      select() { return builder },
      eq(col: string, val: any) { filters.push([col, val]); return builder },
      update(obj: Row) { pendingUpdate = obj; return builder },
      insert(obj: Row) {
        pendingInsert = { id: obj.id ?? `generated-${rows.length + 1}`, ...obj }
        rows.push(pendingInsert)
        return builder
      },
      delete() { isDelete = true; return builder },
      then(resolve: (v: { error: null }) => void) {
        if (pendingUpdate) {
          for (const r of applyFilters(rows)) Object.assign(r, pendingUpdate)
        }
        if (isDelete) {
          for (const r of applyFilters(rows)) {
            const idx = rows.indexOf(r)
            if (idx >= 0) rows.splice(idx, 1)
          }
        }
        resolve({ error: null })
      },
    }
    return builder
  }
}

const tables: Record<string, Row[]> = {}
const generateLink = vi.fn()
const listUsers = vi.fn()
const createUser = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: createFakeFrom(tables),
    auth: { admin: { generateLink, listUsers, createUser } },
  }),
}))
vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(async () => ({ supabase: {}, user: { id: 'admin-1' } })),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => (k === 'host' ? 'example.com' : null) }),
}))
vi.mock('@/lib/email', () => ({ sendTeacherInviteEmail: vi.fn() }))

import { redirect } from 'next/navigation'
import { sendTeacherInviteEmail } from '@/lib/email'
import { inviteTeacher, resendTeacherInvite } from './actions'

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key]
  tables.teachers = [{ id: 'pending-1', name: 'רות', role: 'teacher', is_pending: true }]
  vi.clearAllMocks()
})

describe('inviteTeacher', () => {
  test('returns the link and new user id, and never redirects, when the invite link succeeds', async () => {
    generateLink.mockResolvedValueOnce({
      data: { user: { id: 'new-1' }, properties: { action_link: 'https://app.test/invite-abc' } },
      error: null,
    })
    ;(sendTeacherInviteEmail as any).mockResolvedValueOnce(undefined)

    const result = await inviteTeacher('pending-1', 'rut@example.com', 'רות')

    expect(result).toEqual({ link: 'https://app.test/invite-abc', newUserId: 'new-1' })
    expect(redirect).not.toHaveBeenCalled()
  })

  test('still returns the link when the follow-up email send fails', async () => {
    generateLink.mockResolvedValueOnce({
      data: { user: { id: 'new-1' }, properties: { action_link: 'https://app.test/invite-abc' } },
      error: null,
    })
    ;(sendTeacherInviteEmail as any).mockRejectedValueOnce(new Error('smtp down'))

    const result = await inviteTeacher('pending-1', 'rut@example.com', 'רות')

    expect(result.link).toBe('https://app.test/invite-abc')
    expect(result.error).toBeUndefined()
    expect(redirect).not.toHaveBeenCalled()
  })

  test('returns an error and never emails when link generation itself fails', async () => {
    generateLink.mockResolvedValueOnce({ data: null, error: { message: 'invalid email' } })

    const result = await inviteTeacher('pending-1', 'bad-email', 'רות')

    expect(result.error).toContain('שגיאה ביצירת ההזמנה')
    expect(result.link).toBeUndefined()
    expect(sendTeacherInviteEmail).not.toHaveBeenCalled()
  })
})

describe('resendTeacherInvite', () => {
  test('still returns the link when the follow-up email send fails', async () => {
    generateLink.mockResolvedValueOnce({
      data: { properties: { action_link: 'https://app.test/recovery-xyz' } },
      error: null,
    })
    ;(sendTeacherInviteEmail as any).mockRejectedValueOnce(new Error('smtp down'))

    const result = await resendTeacherInvite('teacher-1', 'rut@example.com', 'רות')

    expect(result.link).toBe('https://app.test/recovery-xyz')
    expect(result.error).toBeUndefined()
  })

  test('returns an error when recovery, invite, and createUser all fail', async () => {
    generateLink
      .mockResolvedValueOnce({ data: null, error: { message: 'no user' } }) // recovery attempt
      .mockResolvedValueOnce({ data: null, error: { message: 'invite failed' } }) // invite fallback
    createUser.mockResolvedValueOnce({ data: null, error: { message: 'create failed' } })

    const result = await resendTeacherInvite('teacher-1', 'rut@example.com', 'רות')

    expect(result.error).toContain('שגיאה ביצירת קישור')
    expect(result.link).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd teacher-attendance-app && npm test -- actions.test.ts`
Expected: FAIL — `inviteTeacher`/`resendTeacherInvite` still return strings/void and `inviteTeacher` calls `redirect`, so assertions on `.link`/`.newUserId`/`.error` and `redirect not toHaveBeenCalled` fail.

- [ ] **Step 3: Update `inviteTeacher`**

In `src/app/admin/teachers/actions.ts`, add the exported type above the function and replace the function body so every `return \`...\`` (error string) becomes `return { error: \`...\` }`, and the email-send try/catch no longer returns an error string on failure — it only logs. Replace the final `redirect(...)` call with a plain return of the link:

```typescript
export type InviteResult = {
  error?: string
  link?: string
  newUserId?: string
}

export async function inviteTeacher(pendingId: string, email: string, name: string): Promise<InviteResult> {
  await _requireAdmin('/admin')
  const supabase = createAdminClient()

  let newUserId: string
  let inviteLink: string

  const resetCallbackUrl = await getResetCallbackUrl()

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { name },
      redirectTo: resetCallbackUrl,
    },
  })

  if (linkError) {
    if (!linkError.message.toLowerCase().includes('already')) {
      return { error: `שגיאה ביצירת ההזמנה: ${linkError.message}` }
    }
    // Auth user already exists — generate a recovery (password reset) link instead
    const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: resetCallbackUrl },
    })
    if (recoveryError) return { error: `שגיאה ביצירת קישור: ${recoveryError.message}` }
    inviteLink = recoveryData.properties.action_link

    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existingUser = users?.find(u => u.email === email)
    if (!existingUser) return { error: 'שגיאה: המשתמש קיים אך לא נמצא' }
    newUserId = existingUser.id
  } else {
    newUserId = linkData.user.id
    inviteLink = linkData.properties.action_link
  }

  // Insert the new teacher record FIRST so FK refs can be updated
  const { error: dbError } = await supabase
    .from('teachers')
    .insert({ id: newUserId, name, email, role: 'teacher', is_pending: false })
  if (dbError) return { error: `שגיאה בשמירה: ${dbError.message}` }

  // Migrate all associations before deleting the old record
  if (newUserId !== pendingId) {
    await supabase.from('groups').update({ teacher_id: newUserId }).eq('teacher_id', pendingId)
    await supabase.from('teacher_availability_ranges').update({ teacher_id: newUserId }).eq('teacher_id', pendingId)
    await supabase.from('messages').update({ teacher_id: newUserId }).eq('teacher_id', pendingId)
    await supabase.from('vacation_requests').update({ teacher_id: newUserId }).eq('teacher_id', pendingId)
  }

  await supabase.from('teachers').delete().eq('id', pendingId)
  revalidatePath('/admin/teachers')

  // Best-effort email send — the link is always returned to the caller so the
  // admin can copy/share it manually if the email is silently dropped (Gmail does this).
  try {
    await sendTeacherInviteEmail({ teacherEmail: email, teacherName: name, inviteLink })
  } catch (e: unknown) {
    console.error('[inviteTeacher] email send failed:', e)
  }

  return { link: inviteLink, newUserId }
}
```

- [ ] **Step 4: Update `resendTeacherInvite`**

Replace every `return \`...\`` with `return { error: \`...\` }`, and change the final email try/catch plus return statement:

```typescript
export async function resendTeacherInvite(teacherId: string, email: string, name: string): Promise<InviteResult> {
  await _requireAdmin('/admin')
  const supabase = createAdminClient()

  const resetCallbackUrl = await getResetCallbackUrl()

  let inviteLink: string

  const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: resetCallbackUrl },
  })

  if (recoveryError) {
    // User doesn't exist in Auth yet — fall back to invite type
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: resetCallbackUrl, data: { name } },
    })

    let newUserId: string | undefined
    let newInviteLink: string | undefined

    if (!inviteError) {
      newUserId = inviteData.user.id
      newInviteLink = inviteData.properties.action_link
    } else {
      // invite also failed — try createUser + recovery as last resort
      // (happens when email is in a soft-deleted state in Supabase Auth)
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        user_metadata: { name },
        email_confirm: false,
      })
      if (createError) {
        // All attempts failed — report the original recovery error
        return { error: `שגיאה ביצירת קישור: ${recoveryError.message} (invite: ${inviteError.message})` }
      }
      newUserId = created.user.id

      // Generate recovery link for the freshly created user
      const { data: newRecovery, error: newRecoveryError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: resetCallbackUrl },
      })
      if (newRecoveryError) return { error: `שגיאה ביצירת קישור: ${newRecoveryError.message}` }
      newInviteLink = newRecovery.properties.action_link
    }

    // Register the new auth user id in teachers table
    if (newUserId !== teacherId) {
      await supabase.from('teacher_availability_ranges').update({ teacher_id: newUserId }).eq('teacher_id', teacherId)
      await supabase.from('messages').update({ teacher_id: newUserId }).eq('teacher_id', teacherId)
      await supabase.from('vacation_requests').update({ teacher_id: newUserId }).eq('teacher_id', teacherId)
      await supabase.from('groups').update({ teacher_id: newUserId }).eq('teacher_id', teacherId)
      await supabase.from('teachers').insert({ id: newUserId, name, email, role: 'teacher', is_pending: false })
      await supabase.from('teachers').delete().eq('id', teacherId)
    } else {
      await supabase.from('teachers').update({ email, is_pending: false }).eq('id', teacherId)
    }

    inviteLink = newInviteLink!
  } else {
    inviteLink = recoveryData.properties.action_link
  }

  try {
    await sendTeacherInviteEmail({ teacherEmail: email, teacherName: name, inviteLink })
  } catch (e: unknown) {
    console.error('[resendTeacherInvite] email send failed:', e)
  }
  revalidatePath('/admin/teachers')
  return { link: inviteLink }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd teacher-attendance-app && npm test -- actions.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/teachers/actions.ts src/app/admin/teachers/actions.test.ts
git commit -m "feat: return invite link from server actions instead of redirecting/swallowing on email failure"
```

---

### Task 2: `EditTeacherForm.tsx` — show link panel after first invite

**Files:**
- Modify: `src/app/admin/teachers/[id]/EditTeacherForm.tsx`

**Interfaces:**
- Consumes: `inviteTeacher(pendingId, email, name): Promise<InviteResult>` from Task 1 (`InviteResult = { error?, link?, newUserId? }`)

- [ ] **Step 1: Replace `inviteSent` state with link/newUserId state and update the submit handler**

In `EditTeacherForm.tsx`, replace:

```typescript
  const [inviteSent, setInviteSent] = useState(false)
```

with:

```typescript
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [newUserId, setNewUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
```

Add the import for the router at the top:

```typescript
import { useRouter } from 'next/navigation'
```

and inside the component, right after the existing `useState` calls:

```typescript
  const router = useRouter()
```

- [ ] **Step 2: Replace the success block and submit handler**

Replace the whole `if (inviteSent) { ... }` block with:

```tsx
    if (inviteLink) {
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div>
              <p className="text-sm font-bold text-emerald-800">ההזמנה נוצרה בהצלחה</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                נשלח מייל הזמנה לכתובת <span className="font-bold">{inviteEmail}</span>. אם המייל לא מגיע, אפשר להעתיק את הקישור ולשלוח אותו ידנית (למשל בוואטסאפ).
              </p>
            </div>
          </div>
          <input
            type="text"
            readOnly
            value={inviteLink}
            dir="ltr"
            onFocus={e => e.currentTarget.select()}
            className="w-full px-3 py-2.5 border border-emerald-200 bg-white rounded-xl text-xs text-gray-600"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteLink)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
            >
              {copied ? 'הועתק!' : 'העתק קישור'}
            </button>
            <button
              type="button"
              onClick={() => router.push(newUserId ? `/admin/teachers/${newUserId}` : '/admin/teachers')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm py-2.5 rounded-xl transition-colors"
            >
              המשך
            </button>
          </div>
          <p className="text-[11px] text-gray-400 text-center">הקישור בתוקף ל-24 שעות</p>
        </div>
      )
    }
```

Then update the form's `onSubmit` to use the structured result:

```typescript
        onSubmit={e => {
          e.preventDefault()
          setInviteError(null)
          startTransition(async () => {
            const result = await inviteTeacher(teacherId, inviteEmail.trim(), initialName)
            if (result.error) { setInviteError(result.error); return }
            setInviteLink(result.link ?? null)
            setNewUserId(result.newUserId ?? null)
          })
        }}
```

- [ ] **Step 3: Run typecheck**

Run: `cd teacher-attendance-app && npx tsc --noEmit`
Expected: no errors referencing `EditTeacherForm.tsx`

- [ ] **Step 4: Manual verification**

Run: `cd teacher-attendance-app && npm run dev`
1. Go to `/admin/teachers`, create a pending teacher, open their page.
2. Enter an email and click "שלח הזמנה".
3. Confirm the emerald panel appears with the link, "העתק קישור" copies it (paste somewhere to confirm), and "המשך" navigates to the teacher's detail page.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/teachers/[id]/EditTeacherForm.tsx
git commit -m "feat: show copyable invite link after inviting a new teacher"
```

---

### Task 3: `ResendInviteButton.tsx` — drop dead branch, show link panel

**Files:**
- Modify: `src/app/admin/teachers/[id]/ResendInviteButton.tsx`
- Modify: `src/app/admin/teachers/[id]/page.tsx:144-151`

**Interfaces:**
- Consumes: `resendTeacherInvite(teacherId, email, name): Promise<InviteResult>` from Task 1

- [ ] **Step 1: Rewrite `ResendInviteButton.tsx`**

Replace the entire file content with:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { resendTeacherInvite } from '../actions'

interface Props {
  teacherId: string
  email: string | null
  name: string
}

export default function ResendInviteButton({ teacherId, email, name }: Props) {
  const [inputEmail, setInputEmail] = useState(email ?? '')
  const [isPendingTransition, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'link' | 'error'>('idle')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  function handleSend() {
    const finalEmail = inputEmail.trim()
    if (!finalEmail) return
    setStatus('idle')
    startTransition(async () => {
      const result = await resendTeacherInvite(teacherId, finalEmail, name)
      if (result.error) { setStatus('error'); setErrorMsg(result.error); return }
      setLink(result.link ?? '')
      setStatus('link')
    })
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === 'link') {
    return (
      <div className="flex flex-col gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
        <p className="text-xs text-gray-500 text-right leading-relaxed">
          אם המייל לא מגיע, אפשר להעתיק את הקישור ולשלוח אותו ידנית (למשל בוואטסאפ).
        </p>
        <input
          type="text"
          readOnly
          value={link}
          dir="ltr"
          onFocus={e => e.currentTarget.select()}
          className="w-full px-3 py-2.5 border border-emerald-200 bg-white rounded-xl text-xs text-gray-600"
        />
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 font-bold text-sm rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            {copied ? 'הועתק!' : 'העתק קישור'}
          </button>
          <button
            onClick={() => setStatus('idle')}
            className="flex-1 py-2.5 font-bold text-sm rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            סגירה
          </button>
        </div>
        <p className="text-[11px] text-gray-400 text-center">הקישור בתוקף ל-24 שעות</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-center justify-end gap-2">
        <p className="text-sm font-bold text-amber-800">שליחת קישור כניסה</p>
        <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" />
      </div>
      <p className="text-xs text-gray-500 text-right leading-relaxed">שלח למורה קישור חדש להגדרת סיסמה.</p>

      {!email ? (
        <input
          type="email"
          value={inputEmail}
          onChange={e => setInputEmail(e.target.value)}
          placeholder="אימייל המורה"
          dir="ltr"
          className="w-full border border-amber-200 bg-white rounded-xl px-3 py-2.5 text-sm text-right focus:outline-none focus:border-amber-400 placeholder:text-right"
        />
      ) : (
        <p className="text-xs text-gray-400 text-right">{email}</p>
      )}

      <button
        onClick={handleSend}
        disabled={isPendingTransition || !inputEmail.trim()}
        className="flex items-center justify-center gap-2 w-full py-3 font-bold text-sm rounded-xl transition-colors disabled:opacity-60 bg-amber-400 text-white hover:bg-amber-500"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        {isPendingTransition ? 'שולח...' : 'שלח הזמנה'}
      </button>

      {status === 'error' && (
        <p className="text-xs text-red-500 text-center">{errorMsg}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Remove the now-unused `isPending` prop from the call site**

In `src/app/admin/teachers/[id]/page.tsx`, change:

```tsx
        {!(teacher.is_pending ?? false) && (
          <ResendInviteButton
            teacherId={teacher.id}
            email={teacherEmail}
            name={teacher.name}
            isPending={false}
          />
        )}
```

to:

```tsx
        {!(teacher.is_pending ?? false) && (
          <ResendInviteButton
            teacherId={teacher.id}
            email={teacherEmail}
            name={teacher.name}
          />
        )}
```

- [ ] **Step 3: Run typecheck**

Run: `cd teacher-attendance-app && npx tsc --noEmit`
Expected: no errors (confirms the removed `isPending` prop isn't referenced anywhere else)

- [ ] **Step 4: Manual verification**

With `npm run dev` still running:
1. Open an already-registered teacher's page (`is_pending = false`).
2. Click "שלח הזמנה" under "שליחת קישור כניסה".
3. Confirm the emerald panel appears with the link, "העתק קישור" works, and "סגירה" returns to the amber form.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/teachers/[id]/ResendInviteButton.tsx src/app/admin/teachers/[id]/page.tsx
git commit -m "refactor: drop unused isPending branch, show copyable link on resend"
```

---

### Task 4: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd teacher-attendance-app && npm test`
Expected: all tests pass, including the 5 new tests from Task 1

- [ ] **Step 2: Run the production build**

Run: `cd teacher-attendance-app && npm run build`
Expected: build succeeds with no type errors

- [ ] **Step 3: Manual end-to-end pass**

With `npm run dev`, repeat both manual checks from Task 2 and Task 3 back-to-back (invite a brand-new teacher, then resend to an existing one), confirming both link panels behave independently and neither leaves the admin on a broken state if dismissed without copying.
