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

### Phase 9 — Cutover de Ownership e Onboarding ✓

**Slug:** `09-cutover-ownership`
**Plans:** `.planning/phases/09-cutover-ownership/09-01-PLAN.md` — `09-04-PLAN.md`

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 09-01 | 1 | ✓ | Database & Auth Helpers Core |
| 09-02 | 1 | ✓ | API Routes — Ownership |
| 09-03 | 2 | ✓ | Server Components & Client Refactoring |
| 09-04 | 3 | ✓ | Tests, Verificação e Regressão |

**Entrega:** Migration `user_id` + RLS em `stores`. `StoreNotFoundError`, `getCurrentStore()`, `requireOwnership()` em `store-ownership.ts`. `buildStoreResponse()` em `store-response.ts`. Ownership nas 4 rotas CRUD (POST/GET /api/store, GET/PATCH /api/store/:id). 3 páginas viram server components (`/`, `/store`, `/campaign/preview`). `localStorage("store_id")` removido de todos os componentes. 26 novos testes (410 total).

## Planned

### Phase 10 — Perímetro Multi-tenant ✓

**Slug:** `fase-10-perimetro-multitenant`
**Change:** `openspec/changes/fase-10-perimetro-multitenant/`
**Context:** `.planning/phases/10-perimetro-multitenant/10-CONTEXT.md`
**Plans:** `.planning/phases/10-perimetro-multitenant/10-01-PLAN.md` — `10-06-PLAN.md`

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 10-01 | 1 | ○ | Auth Guards & Error Contracts |
| 10-02 | 2 | ○ | Route Handlers — requireAuthorizedStore + CSRF |
| 10-03 | 2 | ○ | Server Actions — Extração de Serviço + Guards |
| 10-04 | 1 | ○ | RLS + Storage Policies |
| 10-05 | 3 | ○ | Matriz de Testes Parametrizados |
| 10-06 | 4 | ○ | Validação e Regressão |

**Entrega:** Erros centralizados em `errors.ts`, CSRF/same-origin, `requireAuthorizedStore()` em ~20 handlers, `getCurrentStore()` em `/api/campaign/generate`, 3 Server Actions extraídas para `store-identity-service.ts`, 4 Server Actions com guards, RLS em 4 tabelas filhas, Storage policies, matriz parametrizada (~100 testes). Build limpo.

## Pending

### Phase 11 — Verificação e Hardening
