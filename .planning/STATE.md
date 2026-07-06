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

## Phase 8 — Ciclo de Conta (4/4 plans executed) ✓

**Status:** 08-01 ✓ | 08-02 ✓ | 08-03 ✓ | 08-04 ✓

### 08-01 — Setup & Middleware Expansion ✓
- `NEXT_PUBLIC_SITE_URL` added to `.env.example`, `.env.local`
- `src/lib/supabase/site-url.ts` created (module-level validation)
- `supabase/config.toml` generated (site_url, redirects, templates, enable_confirmations)
- `supabase/templates/confirmation.html` + `recovery.html` with TokenHash
- Middleware expanded: 10 routes, PUBLIC_ROUTES, ALWAYS_PASSTHROUGH

### 08-02 — Pages & Route Handler ✓
- Login form: "Criar conta" + "Esqueci minha senha" links
- Signup page: form with validation, anti-enumeration redirect
- Check-email page: contextual copy by type
- Auth/confirm route handler: verifyOtp, strict type validation, next allowlist
- Forgot-password page: form with anti-enumeration redirect
- Update-password page: form with validation, session-preserving redirect

### 08-03 — Tests ✓
- 39 new tests across 6 new files + 2 extended files
- 383 total tests, all passing (344 prior + 39 new)
- Zero TypeScript errors, zero lint errors

### 08-04 — UAT ✓
- 14/14 tests passed
- SMTP Hostinger (Impromx) configurado e funcional via Supabase Dashboard
- Templates de email PT-BR customizados no Dashboard remoto
- Fluxo signup (cria conta → email → confirma → login) validado
- Fluxo recovery (forgot → email → recovery → update-password → login) validado
- Middleware (public routes, protected routes, passthrough) validado

## Pending

### Phase 9 — Cutover de Ownership e Onboarding
### Phase 10 — Perímetro Multi-tenant
### Phase 11 — Verificação e Hardening
