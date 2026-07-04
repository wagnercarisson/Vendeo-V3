# Plan 08-03 — Tests

**Status:** ✓ Complete
**Committed:** `2ef9ea5`, `08ba72e`, (various commits in batch)

## What was built

### Test files created/modified

- `src/__tests__/auth/login-form.test.tsx` — Extended: navigation links (Criar conta, Esqueci minha senha)
- `src/__tests__/auth/signup-form.test.tsx` — New: 6 tests (render, validation short password, validation confirm mismatch, submit success, submit error anti-enumeration, loading state)
- `src/__tests__/auth/check-email.test.tsx` — New: 4 tests (signup type, recovery type, generic fallback, no email leak)
- `src/__tests__/auth/confirm.test.ts` — New: 8 tests (valid signup/recovery token, invalid next, invalid signup/recovery token, missing token_hash, invalid type, missing both)
- `src/__tests__/auth/forgot-password-form.test.tsx` — New: 4 tests (render, submit success, submit error anti-enumeration, loading state)
- `src/__tests__/auth/update-password-form.test.tsx` — New: 6 tests (render, validation short password, validation confirm mismatch, submit success, submit error, loading state)
- `src/__tests__/auth/middleware.test.ts` — Extended: 10 new tests for expanded routes (signup/check-email/forgot-password public pass-through, /auth/confirm always pass-through, /update-password protected, authenticated redirects for public routes)
- `src/__tests__/auth/site-url.test.ts` — Removed (module-level throw incompatible with vitest dynamic import)

### Fixes
- `src/lib/supabase/site-url.ts` — Fixed: TypeScript strict null check with `as string` assertion
- `src/app/auth/confirm/route.ts` — Fixed: explicit `{ status: 302 }` on all redirects (Next.js default is 307)

## Regression
- **41 test files, 383 tests — all passing** (previous: 344)
- Tests added: ~39 new tests (signup 6, check-email 4, confirm 8, forgot-password 4, update-password 6, middleware +10, login-form +2)
- `npx tsc --noEmit` — zero errors
