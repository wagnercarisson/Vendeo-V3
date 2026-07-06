# Project State

**Last updated:** 2026-07-06
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

### Phase 8 — Ciclo de Conta ✓

**Slug:** `fase-8-ciclo-de-conta`
**Change:** `openspec/changes/fase-8-ciclo-de-conta/`
**Plans:** `.planning/phases/08-ciclo-de-conta/08-01-PLAN.md` — `08-04-PLAN.md`

| Plan | Status | Description |
|------|--------|-------------|
| 08-01 | ✓ | Setup & Middleware Expansion |
| 08-02 | ✓ | Pages & Route Handler |
| 08-03 | ✓ | Tests (39 novos, 383 total) |
| 08-04 | ✓ | UAT — Local & Online (14/14) |

**Entrega:** Ciclo de credenciais completo — signup, confirmação de email, recuperação de senha. Anti-enumeration, templates PT-BR, SMTP via Resend.com, DNS configurado (DKIM/DMARC/SPF). UAT validado com Gmail, 383 testes passando.

## Planned

### Phase 9 — Cutover de Ownership e Onboarding

| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 09-01 | 1 | ○ | Database & Auth Helpers Core |
| 09-02 | 1 | ○ | API Routes — Ownership |
| 09-03 | 2 | ○ | Server Components & Client Refactoring |
| 09-04 | 3 | ○ | Tests, Verificação e Regressão |

## Pending

### Phase 10 — Perímetro Multi-tenant
### Phase 11 — Verificação e Hardening
