# Project State

**Last updated:** 2026-07-04
**Milestone:** v1.2 — Contas e Propriedade

## Completed

### Phase 7 — Sessão e Login Vertical ✓

**Files created:**
- `src/middleware.ts` — updateSession + redirect logic (5-route matcher)
- `src/lib/supabase/client.ts` — `createBrowserClient()` factory
- `src/lib/supabase/server.ts` — `createServerClient()` + `supabaseAdmin`
- `src/lib/supabase/middleware.ts` — `updateSession(request)`
- `src/lib/auth/require-user.ts` — `requireUser()`, `requirePageUser()`, `requireApiUser()`
- `src/lib/auth/redirect.ts` — `sanitizeRedirectPath()`
- `src/app/(auth)/layout.tsx` — centralized auth layout
- `src/app/(auth)/login/page.tsx` — login page
- `src/app/(auth)/login/login-form.tsx` — login form component
- `src/app/auth/signout/route.ts` — logout route handler
- `src/components/auth/auth-header.tsx` — auth-aware header
- `src/components/auth/logout-button.tsx` — logout button

**Tests:** 344 tests passing. Covers requireUser, sanitizeRedirectPath, middleware, login form, logout.

## Planned

### Phase 8 — Ciclo de Conta

**Change artifacts approved:** `openspec/changes/fase-8-ciclo-de-conta/`
**Plans ready:** `.planning/phase-08-ciclo-de-conta/` (4 plans)
- Proposal, design, 8 specs, tasks approved
- Context, roadmap, state, and plans generated
- Ready for execution: 08-01 (Setup & Middleware), 08-02 (Pages), 08-03 (Tests), 08-04 (UAT)

## Pending

### Phase 9 — Cutover de Ownership e Onboarding
### Phase 10 — Perímetro Multi-tenant
### Phase 11 — Verificação e Hardening
