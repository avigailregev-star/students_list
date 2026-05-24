# Bug Reporting System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a teacher's app crashes or a server action fails, the admin automatically receives an email, a bug report is stored in Supabase, and the teacher sees a friendly error page with an optional description field.

**Architecture:** A React Error Boundary wraps the root layout and catches client-side crashes, then calls `/api/report-error` which inserts a row into `bug_reports` and sends an email via Resend. The admin views all reports at `/admin/bugs` and can mark them resolved. AdminNav shows a red dot when there are new (unresolved) reports.

**Tech Stack:** Next.js 16 App Router, Supabase, Resend (email), Tailwind CSS, TypeScript

---

## File Map

| Action | File |
|--------|------|
| Create | `src/lib/email.ts` |
| Create | `src/app/api/report-error/route.ts` |
| Create | `src/components/error/ErrorBoundary.tsx` |
| Create | `src/components/error/ErrorPage.tsx` |
| Modify | `src/app/layout.tsx` |
| Create | `src/app/admin/bugs/page.tsx` |
| Create | `src/app/admin/bugs/MarkResolvedButton.tsx` |
| Create | `src/app/admin/bugs/bugActions.ts` |
| Modify | `src/components/layout/AdminNav.tsx` |
| Modify | `src/app/admin/layout.tsx` |

---

### Task 1: Create the `bug_reports` table in Supabase

**Files:**
- No local file — run SQL in the Supabase dashboard SQL editor

- [ ] **Step 1: Run this SQL in Supabase → SQL Editor → New query**

```sql
create table if not exists bug_reports (
  id            uuid        primary key default gen_random_uuid(),
  teacher_id    uuid        references teachers(id) on delete set null,
  teacher_name  text,
  page_url      text        not null,
  error_message text        not null,
  error_stack   text,
  user_description text,
  status        text        not null default 'new' check (status in ('new', 'resolved')),
  created_at    timestamptz not null default now()
);

-- Enable RLS
alter table bug_reports enable row level security;

-- Authenticated teachers can insert
create policy "auth_insert" on bug_reports
  for insert to authenticated with check (true);

-- Only admin can read
create policy "admin_select" on bug_reports
  for select using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );

-- Only admin can update (mark resolved)
create policy "admin_update" on bug_reports
  for update using (
    exists (select 1 from teachers where id = auth.uid() and role = 'admin')
  );
```

- [ ] **Step 2: Verify the table was created**

In Supabase → Table Editor, confirm `bug_reports` appears with all columns.

---

### Task 2: Install Resend and add RESEND_API_KEY

**Files:**
- Modify: `package.json` (via npm install)
- No local file for env var — added in Vercel dashboard

- [ ] **Step 1: Install Resend**

```bash
cd teacher-attendance-app
npm install resend
```

Expected output: `added 1 package` (or similar, no errors)

- [ ] **Step 2: Get a Resend API key**

Go to https://resend.com → sign up (free) → API Keys → Create API Key.
Copy the key (starts with `re_...`).

- [ ] **Step 3: Add key to local `.env.local`**

Open (or create) `teacher-attendance-app/.env.local` and add:
```
RESEND_API_KEY=re_your_key_here
```

- [ ] **Step 4: Add key to Vercel**

In Vercel dashboard → Project → Settings → Environment Variables → add:
- Name: `RESEND_API_KEY`
- Value: `re_your_key_here`
- Environments: Production, Preview, Development

- [ ] **Step 5: Create `src/lib/email.ts`**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface BugEmailParams {
  teacherName: string
  errorMessage: string
  pageUrl: string
  userDescription?: string
  createdAt: string
}

export async function sendBugReportEmail(params: BugEmailParams) {
  const { teacherName, errorMessage, pageUrl, userDescription, createdAt } = params

  await resend.emails.send({
    from: 'noreply@students-list.app',
    to: 'avigailregev@gmail.com',
    subject: `🐛 באג חדש — ${teacherName}`,
    html: `
      <div dir="rtl" style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:#fef2f2;border-right:4px solid #ef4444;border-radius:8px;padding:14px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:4px">שגיאה חדשה דווחה</div>
          <div style="font-size:13px;color:#7f1d1d">${errorMessage}</div>
        </div>
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 4px;color:#6b7280;width:100px">מורה</td>
            <td style="padding:8px 4px;font-weight:600;color:#111">${teacherName}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 4px;color:#6b7280">דף</td>
            <td style="padding:8px 4px;color:#111">${pageUrl}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 4px;color:#6b7280">שעה</td>
            <td style="padding:8px 4px;color:#111">${createdAt}</td>
          </tr>
          ${userDescription ? `
          <tr>
            <td style="padding:8px 4px;color:#6b7280">תיאור</td>
            <td style="padding:8px 4px;color:#111">״${userDescription}״</td>
          </tr>
          ` : ''}
        </table>
        <div style="margin-top:20px;text-align:center">
          <a href="https://students-list-ochre.vercel.app/admin/bugs"
             style="background:#14b8a6;color:white;padding:10px 24px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;display:inline-block">
            פתחי דף הבאגים ←
          </a>
        </div>
      </div>
    `,
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/email.ts package.json package-lock.json
git commit -m "feat: add Resend email utility for bug reports"
```

---

### Task 3: Build the `/api/report-error` route

**Files:**
- Create: `src/app/api/report-error/route.ts`

- [ ] **Step 1: Create `src/app/api/report-error/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBugReportEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { errorMessage, errorStack, pageUrl, userDescription } = await request.json() as {
      errorMessage: string
      errorStack?: string
      pageUrl: string
      userDescription?: string
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let teacherName: string | null = null
    let teacherId: string | null = null

    if (user) {
      teacherId = user.id
      const { data: teacher } = await supabase
        .from('teachers')
        .select('name')
        .eq('id', user.id)
        .single()
      teacherName = teacher?.name ?? null
    }

    await supabase.from('bug_reports').insert({
      teacher_id: teacherId,
      teacher_name: teacherName,
      page_url: pageUrl,
      error_message: errorMessage,
      error_stack: errorStack ?? null,
      user_description: userDescription ?? null,
    })

    await sendBugReportEmail({
      teacherName: teacherName ?? 'לא ידוע',
      errorMessage,
      pageUrl,
      userDescription,
      createdAt: new Date().toLocaleString('he-IL'),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[report-error]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
```

- [ ] **Step 2: Smoke-test with curl (optional, while dev server is running)**

```bash
curl -X POST http://localhost:3000/api/report-error \
  -H "Content-Type: application/json" \
  -d '{"errorMessage":"Test error","pageUrl":"/test","userDescription":"בדיקה"}'
```

Expected: `{"ok":true}` (or `{"ok":false}` if Resend key isn't set yet — that's fine for now, the insert still happens)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/report-error/route.ts
git commit -m "feat: add /api/report-error route"
```

---

### Task 4: Build ErrorBoundary and ErrorPage components

**Files:**
- Create: `src/components/error/ErrorBoundary.tsx`
- Create: `src/components/error/ErrorPage.tsx`

- [ ] **Step 1: Create `src/components/error/ErrorPage.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface Props {
  error: Error
  onDismiss: () => void
}

export default function ErrorPage({ error, onDismiss }: Props) {
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function report(withDescription: boolean) {
    setSending(true)
    try {
      await fetch('/api/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorMessage: error.message || String(error),
          errorStack: error.stack,
          pageUrl: pathname,
          userDescription: withDescription ? description : undefined,
        }),
      })
    } catch {
      // best effort — don't block the user
    }
    onDismiss()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-sm p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">😔</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">אירעה שגיאה</h1>
        <p className="text-sm text-gray-500 mb-6">הבעיה דווחה אוטומטית. מטפלים בה.</p>

        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="תרצי להוסיף תיאור קצר של מה עשית?"
          className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-teal-400"
          rows={3}
          dir="rtl"
        />

        <div className="flex gap-3">
          <button
            onClick={() => report(true)}
            disabled={sending}
            className="flex-1 bg-teal-500 text-white font-bold py-3 rounded-2xl text-sm disabled:opacity-50"
          >
            שלחי דיווח
          </button>
          <button
            onClick={() => report(false)}
            disabled={sending}
            className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl text-sm disabled:opacity-50"
          >
            דלגי
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/error/ErrorBoundary.tsx`**

React Error Boundaries must be class components. The `'use client'` directive makes it render on the client where errors happen.

```tsx
'use client'

import React from 'react'
import ErrorPage from './ErrorPage'

interface State {
  error: Error | null
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorPage
          error={this.state.error}
          onDismiss={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/error/ErrorBoundary.tsx src/components/error/ErrorPage.tsx
git commit -m "feat: add ErrorBoundary and ErrorPage components"
```

---

### Task 5: Wrap the root layout with ErrorBoundary

**Files:**
- Modify: `src/app/layout.tsx`

Current content of `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'מעקב נוכחות',
  description: 'אפליקציית מעקב נוכחות למורים',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${inter.variable} font-sans bg-slate-50 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 1: Add the ErrorBoundary import and wrap children**

Replace the entire file with:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import ErrorBoundary from '@/components/error/ErrorBoundary'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'מעקב נוכחות',
  description: 'אפליקציית מעקב נוכחות למורים',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${inter.variable} font-sans bg-slate-50 min-h-screen`}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Start the dev server and verify no build error**

```bash
npm run dev
```

Open http://localhost:3000. The app should load normally. The ErrorBoundary is invisible until an error occurs.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wrap root layout with ErrorBoundary"
```

---

### Task 6: Build the `/admin/bugs` page

**Files:**
- Create: `src/app/admin/bugs/bugActions.ts`
- Create: `src/app/admin/bugs/MarkResolvedButton.tsx`
- Create: `src/app/admin/bugs/page.tsx`

- [ ] **Step 1: Create `src/app/admin/bugs/bugActions.ts`**

```typescript
'use server'

import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function markResolved(id: string) {
  await requireAdmin()
  const supabase = createAdminClient()
  await supabase.from('bug_reports').update({ status: 'resolved' }).eq('id', id)
  revalidatePath('/admin/bugs')
}
```

- [ ] **Step 2: Create `src/app/admin/bugs/MarkResolvedButton.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { markResolved } from './bugActions'

export default function MarkResolvedButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => markResolved(id))}
      disabled={isPending}
      className="shrink-0 text-xs bg-gray-100 text-gray-600 font-medium px-3 py-1.5 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors"
    >
      {isPending ? '...' : 'סמן כטופל'}
    </button>
  )
}
```

- [ ] **Step 3: Create `src/app/admin/bugs/page.tsx`**

```tsx
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import MarkResolvedButton from './MarkResolvedButton'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'עכשיו'
  if (minutes < 60) return `לפני ${minutes} דקות`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `לפני ${hours} שעות`
  const days = Math.floor(hours / 24)
  return `לפני ${days} ימים`
}

export default async function AdminBugsPage() {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: reports } = await supabase
    .from('bug_reports')
    .select('id, teacher_name, page_url, error_message, user_description, status, created_at')
    .order('created_at', { ascending: false })

  const newCount = (reports ?? []).filter(r => r.status === 'new').length

  return (
    <div className="min-h-screen bg-gray-50 pb-24 px-4 pt-6">
      <div className="max-w-lg mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">דיווחי באגים</h1>
          {newCount > 0 && (
            <p className="text-sm text-red-500 font-medium mt-0.5">{newCount} דיווחים חדשים</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {(reports ?? []).map(report => (
            <div
              key={report.id}
              className={`bg-white rounded-2xl shadow-sm px-4 py-4 ${
                report.status === 'new' ? 'border-r-4 border-red-400' : 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-gray-900">
                      {report.teacher_name ?? 'לא ידוע'}
                    </span>
                    {report.status === 'new' && (
                      <span className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-0.5 rounded-xl">
                        חדש
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 font-mono bg-gray-50 rounded-lg px-2 py-1 mb-2 line-clamp-2">
                    {report.error_message}
                  </p>

                  {report.user_description && (
                    <p className="text-xs text-gray-600 italic mb-2">
                      ״{report.user_description}״
                    </p>
                  )}

                  <p className="text-[10px] text-gray-400">{report.page_url}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(report.created_at)}</p>
                </div>

                {report.status === 'new' && <MarkResolvedButton id={report.id} />}
              </div>
            </div>
          ))}

          {(reports ?? []).length === 0 && (
            <p className="text-center text-gray-400 text-sm py-12">אין דיווחי באגים 🎉</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Navigate to http://localhost:3000/admin/bugs in the dev server**

Expected: page loads with "אין דיווחי באגים 🎉" (no reports yet).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/bugs/
git commit -m "feat: add /admin/bugs page with mark-resolved action"
```

---

### Task 7: Add "באגים" link to AdminNav with unread indicator

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/components/layout/AdminNav.tsx`

The admin layout is a server component that can fetch the unread count and pass it as a prop to the client component AdminNav.

- [ ] **Step 1: Modify `src/app/admin/layout.tsx` to fetch unread count**

Replace the entire file with:

```tsx
import AdminNav from '@/components/layout/AdminNav'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('bug_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new')

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {children}
      <AdminNav bugsCount={count ?? 0} />
    </div>
  )
}
```

- [ ] **Step 2: Modify `src/components/layout/AdminNav.tsx` to accept `bugsCount` and add the bugs nav item**

Replace the entire file with:

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  badge?: number
}

function BugIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1.88 1.88"/>
      <path d="M14.12 3.88 16 2"/>
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/>
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"/>
      <path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/>
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>
    </svg>
  )
}

export default function AdminNav({ bugsCount = 0 }: { bugsCount?: number }) {
  const pathname = usePathname()
  const router = useRouter()

  const NAV_ITEMS: NavItem[] = [
    {
      href: '/',
      label: 'מורה',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      href: '/admin',
      label: 'בקרה',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
      ),
    },
    {
      href: '/admin/teachers',
      label: 'מורים',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      href: '/admin/calendar',
      label: 'לוח שנה',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      href: '/admin/sick-leave',
      label: 'מחלות',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
    },
    {
      href: '/admin/bugs',
      label: 'באגים',
      icon: <BugIcon />,
      badge: bugsCount,
    },
  ]

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-50">
      <div className="flex items-center justify-around py-2 pb-3">
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-colors ${
                isActive ? 'text-teal-600 bg-teal-50' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {item.icon}
              {item.badge != null && item.badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          )
        })}

        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span className="text-[10px] font-semibold">יציאה</span>
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Verify in the browser**

Open http://localhost:3000/admin. The nav should now have a "באגים" icon. If there are no unresolved bug reports, no red dot appears.

To see the red dot: trigger an error (see Task 8 below), then navigate to `/admin`.

- [ ] **Step 4: Commit and push**

```bash
git add src/app/admin/layout.tsx src/components/layout/AdminNav.tsx
git commit -m "feat: add bugs nav item to AdminNav with unread indicator"
git push
```

---

### Task 8: End-to-end test

No code to write — this verifies everything works together.

- [ ] **Step 1: Trigger a test error**

In any client component, temporarily add:
```tsx
throw new Error('בדיקת מערכת דיווח שגיאות')
```

For example, open `src/app/page.tsx` and throw at the top of the component body. Save the file.

- [ ] **Step 2: Open http://localhost:3000**

Expected: the error page appears with "אירעה שגיאה", a textarea, and two buttons.

- [ ] **Step 3: Type a description and click "שלחי דיווח"**

Expected: navigates to home (`/`). The error gets reset so the page loads normally (remove the thrown error first).

- [ ] **Step 4: Check admin panel**

Open http://localhost:3000/admin/bugs.
Expected: one bug report card with a red "חדש" badge, your description, and the error message.

- [ ] **Step 5: Check email**

Open avigailregev@gmail.com inbox.
Expected: email with subject `🐛 באג חדש — [teacher name]` with the error details.

- [ ] **Step 6: Mark as resolved**

Click "סמן כטופל" on the card. Expected: card turns grey and the red dot disappears from AdminNav.

- [ ] **Step 7: Remove the test throw**

Remove the `throw new Error(...)` you added in Step 1 and save.

- [ ] **Step 8: Final push to production**

```bash
git push
```

Wait for Vercel to deploy, then verify on the live site.
