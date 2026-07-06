# Vendeo v1.2 — Roadmap

> Milestone: **Contas e Propriedade**
> Estabelecer a camada fundacional de contas e propriedade para que as milestones seguintes construam sobre ela.

---

## Phase 7 — Sessão e Login Vertical

**Status:** `Complete` ✓
**Slug:** `fase-7-sessao-login-vertical`
**Change:** `openspec/changes/archive/2026-07-04-fase-7-sessao-login-vertical/`

Infraestrutura de sessão: `@supabase/ssr`, middleware, login, logout, `requireUser()`, `sanitizeRedirectPath()`.

**Entrega:** Usuário provisionado → `/login` → cookie SSR → rota protegida → `POST /auth/signout`.

---

## Phase 8 — Ciclo de Conta ✓

**Status:** `Complete` ✓
**Slug:** `fase-8-ciclo-de-conta`
**Change:** `openspec/changes/fase-8-ciclo-de-conta/`
**Plans:** `.planning/phases/08-ciclo-de-conta/08-01-PLAN.md` — `08-04-PLAN.md`
**Context:** `.planning/phases/08-ciclo-de-conta/CONTEXT.md`

Ciclo completo de credenciais: signup, confirmação de email, recuperação de senha.

**Entrega:** Ciclo de signup (`cria conta → /check-email → confirma email → login`) e ciclo de recuperação (`forgot → email → confirma token → nova senha → login`).

**Dependências:** Phase 7

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 08-01 | 1 | ✓ | Setup & Middleware Expansion |
| 08-02 | 2 | ✓ | Pages & Route Handler |
| 08-03 | 3 | ✓ | Tests |
| 08-04 | 4 | ✓ | UAT — Local & Online |

**Tests:** 383 passing (344 prior + 39 novos)
**UAT:** 14/14 passed, 0 issues. SMTP Resend.com configurado e funcional, domínio vendeo.tech com DKIM/DMARC/SPF, templates PT-BR no Dashboard remoto, fluxo signup e recovery validados com Gmail em beta.vendeo.tech.

---

## Phase 9 — Cutover de Ownership e Onboarding ← (next)

**Status:** `Planned`
**Slug:** `fase-9-cutover-ownership`
**Change:** `openspec/changes/fase-9-cutover-ownership/`
**Plans:** `.planning/phases/09-cutover-ownership/09-01-PLAN.md` — `09-04-PLAN.md`
**Context:** `.planning/phases/09-cutover-ownership/09-CONTEXT.md`

Vinculação user→store, `getCurrentStore()`, `requireOwnership()`, onboarding, RLS em `stores`.

**Entrega:** Usuário autenticado cria loja, retorna e acessa exclusivamente sua própria loja.

**Dependências:** Phase 7, Phase 8

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 09-01 | 1 | ○ | Database & Auth Helpers Core |
| 09-02 | 1 | ○ | API Routes — Ownership |
| 09-03 | 2 | ○ | Server Components & Client Refactoring |
| 09-04 | 3 | ○ | Tests, Verificação e Regressão |

**Nota sobre RLS:** Migration precisa incluir `GRANT SELECT ON TABLE public.stores TO authenticated` — as migrations existentes revogaram `authenticated`, e a policy RLS não será alcançável sem essa permissão.

---

## Phase 10 — Perímetro Multi-tenant

**Status:** `Pending`
**Slug:** `fase-10-perimetro-multitenant`

RLS nas 4 tabelas restantes, Storage, `requireOwnership()` em todos os handlers, CSRF, Server Actions com auth.

**Entrega:** Toda superfície existente respeita o tenant.

**Dependências:** Phase 9

---

## Phase 11 — Verificação e Hardening

**Status:** `Pending`
**Slug:** `fase-11-verificacao-hardening`

Testes RLS, cross-tenant, E2E de sessão, vazamento de storage, regressão, fechamento do catálogo de cenários.

**Entrega:** Evidência formal de conclusão da milestone — todos os cenários de segurança VERDES.

**Dependências:** Phase 10
