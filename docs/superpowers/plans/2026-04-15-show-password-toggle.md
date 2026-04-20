# Show Password Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an eye-icon toggle button inside every password field so the user can show or hide what they typed.

**Architecture:** Each password `<input>` is wrapped in a relative `<div>`, and an absolutely-positioned `<button type="button">` with an SVG eye icon sits on the left side. A boolean state variable per field controls whether `type` is `"password"` or `"text"`. No shared component — changes are local to each page file.

**Tech Stack:** React (useState), Tailwind CSS, inline SVG icons

---

### Task 1: Add show/hide toggle to the login/signup page

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Add `showPassword` state**

In `src/app/login/page.tsx`, add one new state variable after the existing `useState` declarations (around line 16):

```tsx
const [showPassword, setShowPassword] = useState(false)
```

- [ ] **Step 2: Replace the password input with a toggle-wrapped version**

Find this block (lines 144–168):

```tsx
{mode !== 'forgot' && (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-sm font-semibold text-gray-600">סיסמה</label>
      {mode === 'login' && (
        <button
          type="button"
          onClick={() => reset('forgot')}
          className="text-xs text-teal-500 hover:text-teal-700 font-semibold"
        >
          שכחתי סיסמה
        </button>
      )}
    </div>
    <input
      type="password"
      value={password}
      onChange={e => setPassword(e.target.value)}
      required
      placeholder="לפחות 6 תווים"
      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"
      dir="ltr"
    />
  </div>
)}
```

Replace it with:

```tsx
{mode !== 'forgot' && (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-sm font-semibold text-gray-600">סיסמה</label>
      {mode === 'login' && (
        <button
          type="button"
          onClick={() => reset('forgot')}
          className="text-xs text-teal-500 hover:text-teal-700 font-semibold"
        >
          שכחתי סיסמה
        </button>
      )}
    </div>
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        placeholder="לפחות 6 תווים"
        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"
        dir="ltr"
      />
      <button
        type="button"
        onClick={() => setShowPassword(v => !v)}
        tabIndex={-1}
        aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {showPassword ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify visually**

Run the dev server (`npm run dev` inside `teacher-attendance-app/`) and open `/login`. Confirm:
- Eye icon appears on the left side of the password field
- Clicking it reveals the typed password
- Clicking again hides it
- Works in both login and signup modes

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add show/hide password toggle to login/signup page"
```

---

### Task 2: Add show/hide toggles to the reset-password page

**Files:**
- Modify: `src/app/reset-password/page.tsx`

- [ ] **Step 1: Add two state variables**

In `src/app/reset-password/page.tsx`, add after the existing `useState` declarations (around line 13):

```tsx
const [showPassword, setShowPassword] = useState(false)
const [showConfirm, setShowConfirm] = useState(false)
```

- [ ] **Step 2: Replace the "סיסמה חדשה" input**

Find:

```tsx
<div>
  <label className="block text-sm font-semibold text-gray-600 mb-1.5">סיסמה חדשה</label>
  <input
    type="password"
    value={password}
    onChange={e => setPassword(e.target.value)}
    required
    minLength={6}
    placeholder="לפחות 6 תווים"
    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"
    dir="ltr"
  />
</div>
```

Replace with:

```tsx
<div>
  <label className="block text-sm font-semibold text-gray-600 mb-1.5">סיסמה חדשה</label>
  <div className="relative">
    <input
      type={showPassword ? 'text' : 'password'}
      value={password}
      onChange={e => setPassword(e.target.value)}
      required
      minLength={6}
      placeholder="לפחות 6 תווים"
      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"
      dir="ltr"
    />
    <button
      type="button"
      onClick={() => setShowPassword(v => !v)}
      tabIndex={-1}
      aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
    >
      {showPassword ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Replace the "אימות סיסמה" input**

Find:

```tsx
<div>
  <label className="block text-sm font-semibold text-gray-600 mb-1.5">אימות סיסמה</label>
  <input
    type="password"
    value={confirm}
    onChange={e => setConfirm(e.target.value)}
    required
    placeholder="הכניסי שוב את הסיסמה"
    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"
    dir="ltr"
  />
</div>
```

Replace with:

```tsx
<div>
  <label className="block text-sm font-semibold text-gray-600 mb-1.5">אימות סיסמה</label>
  <div className="relative">
    <input
      type={showConfirm ? 'text' : 'password'}
      value={confirm}
      onChange={e => setConfirm(e.target.value)}
      required
      placeholder="הכניסי שוב את הסיסמה"
      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-100 transition-all"
      dir="ltr"
    />
    <button
      type="button"
      onClick={() => setShowConfirm(v => !v)}
      tabIndex={-1}
      aria-label={showConfirm ? 'הסתר סיסמה' : 'הצג סיסמה'}
      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
    >
      {showConfirm ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  </div>
</div>
```

- [ ] **Step 4: Verify visually**

Open `/reset-password` (via a password-reset email link or directly in dev). Confirm:
- Both fields have independent eye icon toggles
- Each toggle works independently — revealing one field doesn't affect the other

- [ ] **Step 5: Commit**

```bash
git add src/app/reset-password/page.tsx
git commit -m "feat: add show/hide password toggles to reset-password page"
```
