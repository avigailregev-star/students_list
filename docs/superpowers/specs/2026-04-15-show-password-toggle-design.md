# Show Password Toggle — Design Spec

**Date:** 2026-04-15

## Summary

Add a show/hide password toggle (eye icon) to all password fields in the app, so users can verify what they typed before submitting.

## Scope

Two files:
- `src/app/login/page.tsx` — one password field (used in both login and signup modes)
- `src/app/reset-password/page.tsx` — two password fields (new password + confirm)

## Design

### Approach
Wrap each `<input type="password">` in a relative-positioned `<div>`. Place an absolutely-positioned `<button type="button">` inside on the left side (`left-3`). The button toggles a boolean state per field, which switches `type` between `"password"` and `"text"`.

### State

**login/page.tsx** — add one state variable:
```ts
const [showPassword, setShowPassword] = useState(false)
```

**reset-password/page.tsx** — add two state variables:
```ts
const [showPassword, setShowPassword] = useState(false)
const [showConfirm, setShowConfirm] = useState(false)
```

### Markup pattern (per field)

```tsx
<div className="relative">
  <input
    type={showPassword ? 'text' : 'password'}
    // ...existing props
    className="w-full pl-10 pr-4 py-3 ..."  // add pl-10 for icon space (RTL layout)
  />
  <button
    type="button"
    onClick={() => setShowPassword(v => !v)}
    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
    tabIndex={-1}
    aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
  >
    {/* SVG eye / eye-off icon */}
  </button>
</div>
```

> The input uses `dir="ltr"` and the icon sits on the left (`left-3`) which is visually the "end" side for LTR text — standard convention for password fields.

### Icons (inline SVG, no dependency)

- **Eye open** — shown when password is hidden (click to reveal)
- **Eye off (slash)** — shown when password is visible (click to hide)

Both are 18×18 SVGs from the same icon set already used in the project (stroke-based, `currentColor`).

## Files Changed

| File | Change |
|------|--------|
| `src/app/login/page.tsx` | Add `showPassword` state, wrap password input in relative div, add toggle button |
| `src/app/reset-password/page.tsx` | Add `showPassword` + `showConfirm` states, wrap both inputs, add toggle buttons |

## Out of Scope

- No new component file — changes are self-contained in each page
- No changes to styling tokens or global CSS
