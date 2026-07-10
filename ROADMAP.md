# Vendeo — Roadmap

> Milestone: **Contas e Propriedade** (v1.2) | **Persistência e Entrega da Campanha** (v1.3)
> v1.2 estabelece a camada fundacional de contas e propriedade. v1.3 implementa persistência e entrega de campanhas.

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

## Phase 9 — Cutover de Ownership e Onboarding ✓

**Status:** `Complete` ✓
**Slug:** `fase-9-cutover-ownership`
**Change:** `openspec/changes/fase-9-cutover-ownership/`
**Plans:** `.planning/phases/09-cutover-ownership/09-01-PLAN.md` — `09-04-PLAN.md`
**Context:** `.planning/phases/09-cutover-ownership/09-CONTEXT.md`

Vinculação user→store, `getCurrentStore()`, `requireOwnership()`, RLS em `stores`, routes ownership, server components, remoção de localStorage.

**Entrega:** Migration `user_id` + RLS em `stores`. Ownership nas rotas CRUD. Páginas transformadas em server component. `localStorage("store_id")` removido de todos os componentes. 26 novos testes (410 total). TypeScript, lint e build limpos.

**Dependências:** Phase 7, Phase 8

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 09-01 | 1 | ✓ | Database & Auth Helpers Core |
| 09-02 | 1 | ✓ | API Routes — Ownership |
| 09-03 | 2 | ✓ | Server Components & Client Refactoring |
| 09-04 | 3 | ✓ | Tests, Verificação e Regressão |

**Migration:** `20260706000001_add_user_id_to_stores.sql` aplica coluna `user_id`, RLS policy e `GRANT SELECT TO authenticated`. ⚠️ Destrutiva — deleta dados filhos antes de adicionar coluna. Não rodar em produção sem backfill.

**Procedimentos manuais pendentes:**
1. Rodar migração no Supabase DB (após verificar se `auth.uid()` function existe)
2. Remover `store_id` das variáveis de ambiente se existirem
3. Fazer backfill de user_id para stores existentes antes de ativar RLS em produção
4. Validar fluxo E2E: signup → redirect /store → criar loja → recarregar → dashboard → criar campanha

---

## Phase 10 — Perímetro Multi-tenant ✓

**Status:** `Complete` ✓
**Slug:** `fase-10-perimetro-multitenant`
**Change:** `openspec/changes/fase-10-perimetro-multitenant/`
**Plans:** `.planning/phases/10-perimetro-multitenant/10-01-PLAN.md` — `10-06-PLAN.md`
**Context:** `.planning/phases/10-perimetro-multitenant/10-CONTEXT.md`

Fechar o perímetro multi-tenant: erros centralizados, CSRF, `requireAuthorizedStore()` em ~20 handlers, Server Actions com auth, RLS em 4 tabelas filhas, Storage policies, matriz de testes parametrizados.

**Entrega:** Toda superfície existente respeita o tenant. ~100 novos testes. TypeScript, lint e build limpos.

**Dependências:** Phase 9

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 10-01 | 1 | ✓ | Auth Guards & Error Contracts |
| 10-02 | 2 | ✓ | Route Handlers — requireAuthorizedStore + CSRF |
| 10-03 | 2 | ✓ | Server Actions — Extração de Serviço + Guards |
| 10-04 | 1 | ✓ | RLS + Storage Policies |
| 10-05 | 3 | ✓ | Matriz de Testes Parametrizados |
| 10-06 | 4 | ✓ | Validação e Regressão |

**Tests:** 51 files, 457 tests passing (47 novos em relação à Phase 9)
**TypeScript, lint, build:** Todos verdes
**Procedimentos manuais pendentes:**
1. Rodar migration `enable_rls_child_tables` no Supabase DB (`supabase/migrations/20260707000001_enable_rls_child_tables.sql`)
2. Rodar Storage policies migration (mesmo arquivo)
3. Validar fluxo E2E: acessar rota alheia → 404, mutação cross-origin → 403
4. Bucket `store-logos` mantido como exceção temporária — inventário e migração na Fase 11

---

## Phase 11 — Verificação e Hardening ✓

**Status:** `Complete` ✓
**Slug:** `fase-11-verificacao-hardening`
**Change:** `openspec/changes/archive/2026-07-08-fase-11-verificacao-hardening/`

Testes RLS, cross-tenant, E2E de sessão, vazamento de storage, regressão, fechamento do catálogo de cenários.

**Entrega:** Evidência formal de conclusão da milestone — todos os cenários de segurança VERDES. Catálogo D8: 21/21 PASS. Inventário store-logos: 0 objetos órfãos.

**Dependências:** Phase 10

---

## v1.3 — Persistência e Entrega da Campanha

> Milestone: **Persistência e Entrega da Campanha**
> O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la.

---

## Phase 12 — Fundação DB/Storage ✓

**Status:** `Complete` ✓
**Slug:** `fase-12-fundacao-db-storage`
**Change:** `openspec/changes/fase-12-fundacao-db-storage/`
**Plans:** `.planning/phases/12-fundacao-db-storage/12-01-PLAN.md` — `12-05-PLAN.md`
**Context:** `.planning/phases/12-fundacao-db-storage/12-CONTEXT.md`

Criar a infraestrutura fundacional de banco e Storage para campanhas: tabela `public.campaigns`, bucket privado `campaign-images`, RLS e políticas de acesso. Fase puramente de banco + Storage — não cria services, não modifica app code, não altera fluxo de geração.

**Entrega:** Tabela `campaigns` com DDL completa, bucket `campaign-images` com policies, smoke tests 9/9 PASS, UAT manual com 10 verificações.

**Dependências:** Phases 7–11

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 12-01 | 1 | ✓ | Migration 1 — Create campaigns table DDL |
| 12-02 | 1 | ✓ | Migration 2 — Create campaign-images bucket + policies |
| 12-03 | 2 | ✓ | Smoke Tests & Manual Verification |
| 12-04 | 3 | ✓ | Migration Squash (opcional) |
| 12-05 | 3 | ✓ | UAT Checklist & Validação |

**Smoke tests:** 9/9 PASS
**UAT:** 5/10 verificado (RLS, CHECK, trigger, isolation) — pendente deploy online para validação completa

---

## Phase 13 — Serviço de Persistência e Download

**Status:** `Planned`
**Slug:** `fase-13-servico-persistencia-download`
**Change:** `openspec/changes/fase-13-servico-persistencia-download/`
**Plans:** `.planning/phases/13-servico-persistencia-download/13-01-PLAN.md` — `13-03-PLAN.md`
**Context:** `.planning/phases/13-servico-persistencia-download/13-CONTEXT.md`

Criar camada de persistência isolada para campanhas: tipos manuais (`types.ts`), 7 helpers de escrita/leitura (`persistence.ts`), e rota de download com signed URL (`GET /api/campaign/[id]/download/`). Não modifica o fluxo de geração existente.

**Entrega:** `src/lib/campaign/types.ts`, `src/lib/campaign/persistence.ts`, `GET /api/campaign/[id]/download`, testes unitários (19+6 cenários), TypeScript/lint/build limpos.

**Dependências:** Phases 7–12

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 13-01 | 1 | ○ | Types & Persistence Service |
| 13-02 | 1 | ○ | Download Route |
| 13-03 | 2 | ○ | Tests — Persistence Service & Download Route |

---

## Phase 14 — Integração no Fluxo de Geração (Next)

**Status:** `Pending`
**Slug:** `fase-14-integracao-fluxo-geracao`

Modificar o fluxo de geração (`generate-image`) para salvar a campanha pós-renderização: orquestrar `createCampaign` → `dataUrlToCampaignImage` → `uploadCampaignImage` → `updateCampaignReady`, com compensação via `updateCampaignError` + `deleteCampaignImage` em falha.

**Dependências:** Phase 13

---

## Phase 15 — Página de Campanha ✓

**Status:** `Complete` ✓
**Slug:** `fase-15-pagina-de-campanha`
**Change:** `openspec/changes/fase-15-pagina-de-campanha/`
**Plans:** `.planning/phases/15-pagina-de-campanha/15-01-PLAN.md` — `15-03-PLAN.md`
**Context:** `.planning/phases/15-pagina-de-campanha/15-CONTEXT.md`

Página `/campanha/[id]` com preview e download da campanha persistida. Server Component com RLS, 4 estados visuais (ready/generating/stale/error), signed URL para preview, e kit de publicação.

**Dependências:** Phase 13, Phase 14

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 15-01 | 1 | ✓ | Data/Display Contract — display.ts com getCampaignForDisplay, generateSignedPreviewUrl, computeDisplayStatus |
| 15-02 | 2 | ✓ | UI `/campanha/[id]` — page.tsx + client.tsx com 4 estados + middleware matcher |
| 15-03 | 2 | ✓ | Testes e Verificação — page states, middleware, typecheck/lint/build |

**Tests:** 524 passing (60 files, 19 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

---

## Phase 16 — Minhas Campanhas

**Status:** `Planned`
**Slug:** `fase-16-minhas-campanhas`
**Change:** `openspec/changes/fase-16-minhas-campanhas/`
**Plans:** `.planning/phases/16-minhas-campanhas/16-01-PLAN.md` — `16-03-PLAN.md`
**Context:** `.planning/phases/16-minhas-campanhas/16-CONTEXT.md`

Página `/minhas-campanhas` com listagem de campanhas persistidas, thumbnails via signed URL, estado vazio, e navegação. Fecha o ciclo da milestone v1.3 ("gerou, saiu, voltou, encontrou e baixou").

**Dependências:** Phase 13, Phase 15

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 16-01 | 1 | ◀ | Contrato de listagem — list.ts com listCampaigns, CampaignListItem, generateBatchThumbnailUrls |
| 16-02 | 2 | ◀ | UI `/minhas-campanhas` + navegação — page.tsx, client.tsx, header, middleware, back link |
| 16-03 | 2 | ◀ | Testes e Verificação — helper, page states, middleware, typecheck/lint/build |
