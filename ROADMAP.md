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

## Phase 8 — Ciclo de Conta ← (atual)

**Status:** `Planned`
**Slug:** `fase-8-ciclo-de-conta`
**Change:** `openspec/changes/fase-8-ciclo-de-conta/`
**Plans:** `.planning/phases/08-ciclo-de-conta/08-01-PLAN.md` — `08-04-PLAN.md`
**Context:** `.planning/phases/08-ciclo-de-conta/CONTEXT.md`

Ciclo completo de credenciais: signup, confirmação de email, recuperação de senha.

**Entrega:** Ciclo de signup (`cria conta → /check-email → confirma email → login`) e ciclo de recuperação (`forgot → email → confirma token → nova senha → login`).

**Dependências:** Phase 7

**Planos:**
| Plan | Wave | Descrição |
|------|------|-----------|
| 08-01 | 1 | Setup & Middleware Expansion |
| 08-02 | 2 | Pages & Route Handler |
| 08-03 | 3 | Tests |
| 08-04 | 4 | UAT — Local & Online |

---

## Phase 9 — Cutover de Ownership e Onboarding

**Status:** `Pending`
**Slug:** `fase-9-cutover-ownership`

Vinculação user→store, `getCurrentStore()`, `requireOwnership()`, onboarding, RLS em `stores`.

**Entrega:** Usuário autenticado cria loja, retorna e acessa exclusivamente sua própria loja.

**Dependências:** Phase 7, Phase 8

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
