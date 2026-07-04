# Plan 08-02 — Pages & Route Handler

**Status:** ✓ Complete
**Committed:** `2ef9ea5`, `3bf01fc`, `b441ecd`, `db71deb`, `e74e991`, `b3ccd41`

## What was built

### Task 01 — Login form navigation links
- Added "Esqueci minha senha" link → `/forgot-password` below password field
- Added "Criar conta" link → `/signup` below submit button
- Links styled with `text-blue-400` (design system pattern), using `next/link`

### Task 02 — Signup page
- `src/app/(auth)/signup/page.tsx` — server component (public)
- `src/app/(auth)/signup/signup-form.tsx` — client form with email, password, confirm
- Validation: min 6 chars, confirm must match — Portuguese error messages
- Always redirect `/check-email?type=signup` regardless of success/error
- Loading state with Loader2, no error messages displayed to user

### Task 03 — Check-email page
- `src/app/(auth)/check-email/page.tsx` — server component reading `searchParams.type`
- Contextual copy: signup confirmation / recovery / generic fallback
- Never reveals the user's email address

### Task 04 — Auth/confirm route handler
- `src/app/auth/confirm/route.ts` — GET handler
- Processes `token_hash` + `type` via `verifyOtp()` (not `exchangeCodeForSession()`)
- Strict type validation: only `"signup"` or `"recovery"` accepted
- `next` validated against allowlist: `["/", "/update-password"]`
- No HTML rendering

### Task 05 — Forgot-password page
- `src/app/(auth)/forgot-password/page.tsx` — server component (public)
- `src/app/(auth)/forgot-password/forgot-password-form.tsx` — client form with email
- Always redirect `/check-email?type=recovery` regardless of result

### Task 06 — Update-password page
- `src/app/(auth)/update-password/page.tsx` — server component (middleware guards)
- `src/app/(auth)/update-password/update-password-form.tsx` — client form with password + confirm
- Validation: min 6 chars, confirm must match
- Success → `router.replace("/")` (session stays active)
- Error → generic Portuguese message

## Files created
- `src/app/(auth)/login/login-form.tsx` — modified
- `src/app/(auth)/signup/page.tsx` — new
- `src/app/(auth)/signup/signup-form.tsx` — new
- `src/app/(auth)/check-email/page.tsx` — new
- `src/app/auth/confirm/route.ts` — new
- `src/app/(auth)/forgot-password/page.tsx` — new
- `src/app/(auth)/forgot-password/forgot-password-form.tsx` — new
- `src/app/(auth)/update-password/page.tsx` — new
- `src/app/(auth)/update-password/update-password-form.tsx` — new
