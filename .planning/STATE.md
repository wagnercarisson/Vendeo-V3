---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: — Lançamento Externo Controlado ◆
current_phase: 35
status: milestone_complete
last_updated: 2026-07-31T18:51:17.313Z
progress:
  total_phases: 18
  completed_phases: 16
  total_plans: 74
  completed_plans: 68
  percent: 89
stopped_at: Milestone complete (Phase 35 was final phase)
---

# Project State

**Last updated:** 2026-07-31 (fase 35 — Changelog/Novidades concluída: 5/5 plans, 42 testes novos, verificação 31/31 verdades, checkpoint humano aprovado, milestone v1.5 completo — F36 Stripe como próximo marco)
**Milestone:** v1.5 — Lançamento Externo Controlado ◆ **Em andamento**
**Current phase:** 35

## Completed

### v1.2 — Contas e Propriedade (Phases 7–11)

| Phase | Status | Plans | Description |
|-------|--------|-------|-------------|
| 7. Sessão e Login Vertical | ✅ | 5/5 | `@supabase/ssr`, middleware, login, logout, requireUser |
| 8. Ciclo de Conta | ✅ | 4/4 | signup, confirm, forgot-password, SMTP Resend, UAT 14/14 |
| 9. Cutover de Ownership | ✅ | 4/4 | migration user_id, getCurrentStore, requireOwnership, localStorage removido |
| 10. Perímetro Multi-tenant | ✅ | 6/6 | RLS 5 tabelas, CSRF, guards ~20 handlers, 457 tests, Security 14/14 |
| 11. Verificação e Hardening | ✅ | 1/1 | D8 Catalog 21/21 PASS, store-logos inventário (0 objetos) |

### v1.3 — Persistência e Entrega da Campanha ✅

| Phase | Status | Plans | Description |
|-------|--------|-------|-------------|
| 12. Fundação DB/Storage | ✅ | 5/5 | campaigns table, campaign-images bucket, RLS/Storage policies, verify script |
| 13. Serviço de Persistência | ✅ | 3/3 | types.ts, persistence.ts (7 helpers), download route, 25 testes |
| 14. Integração no Fluxo de Geração | ✅ | 3/3 | image-processor.ts, orchestration generate-image, consumer navigation |
| 15. Página de Campanha | ✅ | 3/3 | display.ts (RLS), /campanha/[id], 4 estados visuais, middleware |
| **16. Minhas Campanhas** | ✅ | **3/3** | **list.ts, /minhas-campanhas UI, navegação, 21 testes** |
| **17. Edição de Publication Copy** | ✅ | **2/2** | **migration SQL, display contract, validação, PATCH route, UI edição inline, 17 testes** |

**Tests:** 579 passing (67 files, 29 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

## Completed

### Phase 15 — Página de Campanha ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 15-01 | 1 | ✅ | Data/Display Contract — display.ts (getCampaignForDisplay, generateSignedPreviewUrl, computeDisplayStatus, CampaignPageProps) |
| 15-02 | 2 | ✅ | UI `/campanha/[id]` — page.tsx + client.tsx (4 estados) + middleware |
| 15-03 | 2 | ✅ | Tests & Verification — 19 novos testes, typecheck/lint/build |

**Tests:** 524 passing (60 files, 19 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

## Completed

### Phase 13 — Serviço de Persistência e Download ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 13-01 | 1 | ✅ | Types & Persistence Service — types.ts, persistence.ts (7 helpers) |
| 13-02 | 1 | ✅ | Download Route — GET /api/campaign/[id]/download |
| 13-03 | 2 | ✅ | Tests — 19+6 cenários |

**Tests:** 490 passing (53 files)
**TypeScript:** Clean | **Lint:** Clean

### Phase 14 — Integração no Fluxo de Geração ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 14-01 | 1 | ✅ | Image Processor + Publication Copy — sharp, transcodeToJpeg, buildPublicationCopySnapshot, types.ts realinhado |
| 14-02 | 2 | ✅ | Orquestração em generate-image — pipeline INSERT→IA→transcode→upload→updateReady com compensação |
| 14-03 | 3 | ✅ | Consumer no Cliente — navegação /campanha/[id], sessionStorage campaign_preview removido |

## Archived Milestones

### v1.4 — Experiência SaaS ✅ SHIPPED

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 18 — App Shell + UI Base + Rotas | 3/3 | ✅ | 2026-07-13 |
| 19 — Onboarding & Estados Vazios | 3/3 | ✅ | 2026-07-13 |
| 20 — Dashboard | 3/3 | ✅ | 2026-07-13 |
| 21 — Histórico e Busca | 3/3 | ✅ | 2026-07-14 |
| 22 — Mobile Hardening | 3/3 | ✅ | 2026-07-15 |
| 29.1.2 — Histórico Curto + Assinatura Visual | 3/3 | ✅ | 2026-07-21 |

**Total:** 5 phases, 18 plans, 713 tests, 89 files
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**UAT:** 61/61 ✅

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-15)

**Core value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais.

**Current focus:** Milestone complete

## Completed Milestones

### Phase 18 — App Shell + UI Base + Rotas ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 18-01 | 1 | ✓ | UI Base (7 componentes) + estrutura diretórios + root layout cleanup + redirects + testes |
| 18-02 | 2 | ✓ | App Shell: sidebar, topbar, account-menu, drawer, (app)/layout + testes |
| 18-03 | 2 | ✓ | Migração rotas + dashboard + conta + middleware + token cleanup + testes |

**Tests:** 600 passing (79 files)

**Commits:**

- `900be21` — 18-01: UI Base + estrutura + redirects + testes
- `e24016d` — 18-02: App Shell + sidebar + topbar + account-menu + drawer + (app)/layout + testes
- `6d97072` — 18-03: Route migration + polish + 600 testes

## Performance Metrics

| Phase | Plans | Duration | Tests |
|-------|-------|----------|-------|
| Phase 18-app-shell-ui-base-rotas | 3 plans | ~multi-cycle | 579→600 (21 novos) |

### Phase 19 — Onboarding & Estados Vazios ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 19-01 | 1 | ✅ | Fundação do Onboarding Helper — types, count, state, microcopy + 9 testes |
| 19-02 | 2 | ✅ | Dashboard Inteligente — async server component com 3 estados + 6 testes |
| 19-03 | 3 | ✅ | Campanhas + Detalhe sem Loja — empty states, 404, microcopy + 7 testes |

**Tests:** 600→628 passing (86 files, 28 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/19-onboarding-estados-vazios/19-CONTEXT.md`
**Source:** `openspec/changes/fase-19-onboarding-estados-vazios/`

**Commits:**

- `8dfc693` — 19-01: Fundação do Onboarding Helper — types, count, state, microcopy + 9 testes
- `801948a` — 19-02: Dashboard Inteligente — async server component com 3 estados + 6 testes
- `bbd3d0e` — 19-03: Campanhas + Detalhe sem Loja — redirects substituídos por empty state/404 + 7 testes
- `ef18659` — Atualiza testes existentes para redirect→empty state e nova microcopy

### Phase 20 — Dashboard ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 20-01 | 1 | ✅ | Métricas e Recentes — `metrics.ts` (4 funções + 1 tipo), `count.ts` reexport + 9 testes |
| 20-02 | 2 | ✅ | Dashboard Completo — saudação, 3 cards métricas, campanhas recentes, next-step card, links |
| 20-03 | 2 | ✅ | Testes e Acabamento Responsivo — 20 testes (11 novos cenários + 9 edge cases) |

**Tests:** 628→651 passing (87 files, 23 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/20-dashboard/20-CONTEXT.md`
**Source:** `openspec/changes/fase-20-dashboard/`

**Commits:**

- `3a17fe2` — 20-01: Metrics module + count.ts reexport + 9 tests
- `e8b5839` — 20-02: Dashboard real + 20-03: Testes (20 tests)

### Phase 21 — Histórico e Busca ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 21-01 | 1 | ✅ | Query Contract — list.ts (ListCampaignsParams/Result), search-params.ts, countCampaignsFiltered, 29 testes |
| 21-02 | 2 | ✅ | URL State + Filtros — SSR searchParams, useDebounce, client.tsx com busca/chips/presets/sort/CAMPAIGNS_SEARCH_EMPTY, 12 testes |
| 21-03 | 3 | ✅ | Pagination + Acabamento — componente Pagination, integração, 10 testes |

**Tests:** 651→691 passing (89 files, 40 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/21-historico-busca/21-CONTEXT.md`
**Source:** `openspec/changes/fase-21-historico-busca/`

**Commits:**

- `3886f96` — 21-01: Query Contract — list.ts, search-params.ts, 29 testes
- `b31923b` — 21-02: URL State + Filtros — SSR, useDebounce, client.tsx, microcopy, 12 testes
- `48a6e3b` — 21-03: Pagination + Acabamento — Pagination, integração, 10 testes

## Milestone v1.5 — Lançamento Externo Controlado ◆

### Phase 23 — Text Provider + Copy Director ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 23-01 | 1 | ✅ | TextProvider Foundation — types, OpenAI, Mock, factory, PublicationCopySnapshot title?, 10 testes |
| 23-02 | 2 | ✅ | Copy Director + Tests — schema, service, prompt template, parseResult, 17 testes |

**Requirements:** COPY-01, COPY-02, COPY-03, COPY-04
**Tests:** 740 passing (91 files, 27 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Context:** `.planning/phases/23-text-provider-copy-director/23-CONTEXT.md`
**Source:** `openspec/changes/fase-23-text-provider-copy-director/`

**Commits:**

- `1df7298` — 23-01: TextProvider Foundation — interface, OpenAI, Mock, factory, PublicationCopySnapshot title?, +10 testes
- `b9a8ffc` — 23-02: Copy Director + Tests — schemas, CopyDirectorService, prompt template, parseResult 3-layer fallback, +17 testes

## Next Steps

- ✅ Milestone v1.4 — Experiência SaaS **concluída e arquivada** 🎉
- ✅ Phase 23 — Text Provider + Copy Director **implementada**
- ✅ Phase 24 — Créditos — Schema, Saldo e Transações **implementada**

## Completed

### Phase 24 — Créditos — Schema, Saldo e Transações ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 24-01 | 1 | ✅ | Migration SQL + CreditService — 3 SQL functions atômicas, credit_balances, credit_transactions append-only, tipos Zod, classe 6 métodos |
| 24-02 | 2 | ✅ | Tests + SQL Verification — 28 testes, concorrência, invariantes |

**Tests:** 768 passing (92 files, 28 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/24-creditos-schema-saldo-transacoes/24-CONTEXT.md`

**Commits:**

- `14136e8` — 24-01: Migration — credit_balances table
- `8251b7b` — 24-01: Migration — credit_transactions table
- `db7f1fe` — 24-01: Migration — grant_credits SQL function
- `1cc492d` — 24-01: Migration — reserve_credit SQL function
- `9361b96` — 24-01: Migration — refund_credit SQL function
- `f925d56` — 24-01: Migration — REVERT section
- `d2b3526` — 24-01: CreditService types (Zod + TypeScript)
- `eee8fba` — 24-01: CreditService class (6 methods)
- `cc981eb` — 24-02: Test setup + mocks
- `7c91c0f` — 24-02: 6 testes Saldo e Grant
- `29a4af1` — 24-02: 7 testes Reserva e Dedução
- `81cadd7` — 24-02: 5 testes Estorno
- `b565cf5` — 24-02: 4 testes Histórico
- `76f4362` — 24-02: 3 testes Concorrência + 3 Invariantes

### Phase 26 — Admin Operacional + Convites + Créditos Manuais ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 26-01 | 1 | ✅ | Fundação — Migration, Gate, Middleware e Layout Admin |
| 26-02 | 2 | ✅ | API Routes e Páginas Admin |
| 26-03 | 3 | ✅ | Testes e Verificação — 25 novos testes |

**Tests:** 829 passing (102 files, 25+ novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/26-admin-operacional/26-CONTEXT.md`
**Source:** `openspec/changes/fase-26-admin-operacional/`

**Commits:**

- `77e0cf2` — 26-01: Fundação — migration, requireAdmin, middleware, layout
- `89a5aa0` — 26-02: API routes + admin pages (6 routes, 5 pages, schemas)
- `3d64f5f` — 26-03: Testes + summaries + STATE/ROADMAP (25 testes, 829 total)

### Phase 27 — Conta + Saldo Visível + Extrato ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 27-01 | 1 | ✅ | Fundação — CreditService Session + BalanceDisplay + BalanceCard |
| 27-02 | 2 | ✅ | Páginas e Integração — TransactionHistory + CreditCta + Dashboard + /conta + Geração |
| 27-03 | 3 | ✅ | Testes e Verificação — 20 novos testes |

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06
**Tests:** 852 passing (108 files, 20 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/27-conta-saldo-extrato/27-CONTEXT.md`
**Source:** `openspec/changes/fase-27-conta-saldo-extrato/`

**Commits:**

- `b7db26c` — 27-01: CreditService session client + countCreditTransactions + BalanceDisplay + BalanceCard
- `0d61e9a` — 27-02: TransactionHistory + CreditCta + Dashboard + /conta + Geração flow
- `aa136e0` — 27-03: Testes e Verificação (20 novos testes, 852 total)

## Completed

### Phase 28 — Observabilidade + Operação + Launch Controls ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 28-01 | 1 | ✅ | Fundação — Launch Config, AI Cost Estimator, Pipeline Logger (3 módulos, 16 testes) |
| 28-02 | 2 | ✅ | Migrations + Pipeline Integration + Rate Limit (2 SQL, pipeline instrumentado) |
| 28-03 | 3 | ✅ | Pipeline Metrics + Admin Dashboard + Documentação (7 funções, 3 docs) |
| 28-04 | 4 | ✅ | Testes e Verificação — Concorrência, Telemetria, Regressão + UAT (7+28 testes) |

**Requirements:** OPS-01 a OPS-09
**Tests:** 889 passing (116 files, 37 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Commits:**

- `30f35c7` — 28-01: launch config + AI cost estimator + pipeline logger — 16 tests
- `246df41` — 28-02: migrations + pipeline integration + rate limit bypass
- `24d2359` — 28-03: pipeline metrics + admin dashboard + operations docs
- `991de75` — 28-04: concurrency, telemetry, and regression tests

**Context:** `.planning/phases/28-observabilidade-operacao-launch-controls/28-CONTEXT.md`

---

### Phase 29 — Refinamento Visual + UAT + Launch Readiness ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 29-01 | 1 | ✅ | Componentes Base — Skeleton 5 variantes + shimmer dark-mode + loading-skeleton wrapper + error-state + 12 loading.tsx + 2 error.tsx |
| 29-02 | 2 | ✅ | Empty States (7) + Error States (4) + Microcopy PT-BR (14 substituições) + Modal créditos a11y + Admin dark OLED (6 páginas) |
| 29-03 | 2 | ✅ | Mobile Hardening (6 áreas) + Legibilidade (10 critérios, auditoria 3 peças) + Launch Readiness Docs (4 docs) |
| 29-04 | 3 | ✅ | UAT Externo (4 lojistas, 4/4 aprovado) + Decisão Final + Regressão |

**Tests:** 889 passing (116 files)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Commits:**

- `e8981b8` — 29-01: Skeleton variants + 12 loading.tsx + 2 error.tsx + error-state.tsx
- `38cd4dc` — 29-02: empty states, error states, microcopy, admin harmonization, modal a11y
- `14eff71` — 29-03: mobile hardening, legibility checklist, launch readiness docs
- `5d83a72` — 29-04: UAT roteiro, pool doc, regressão completa (889/889)
- `99ba86d` — docs(fase 29): artefatos de observabilidade/uat
- `262a897` — fix(fase 29): refinamentos visuais pelo usuário

**Context:** `.planning/phases/29-refinamento-visual-uat-launch-readiness/`
**Summaries:** `01-SUMMARY.md`, `02-SUMMARY.md`, `03-SUMMARY.md`, `04-SUMMARY.md`

---

### Phase 25 — Integração Transacional Pipeline ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 25-01 | 1 | ✅ | Fundação — Config, Migration, Rate Limit, Copy Director e Gemini |
| 25-02 | 2 | ✅ | Integração Transacional — mandatoryArtworkText, Mapper, Pipeline 3 Zonas, Onboarding Grant e Compatibilidade |
| 25-03 | 3 | ✅ | Testes e Verificação — 34+ testes, rate-limit, pipeline F25, store onboarding, retroactive title?; 799/799 passing |

**Requirements:** PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, UI-05
**Tests:** 799 passing (94 files, 34+ novos)
**TypeScript:** Clean | **Build:** Clean

**Context:** `.planning/phases/25-integracao-transacional-pipeline/25-CONTEXT.md`
**Source:** `openspec/changes/fase-25-integracao-transacional-pipeline/`

**Commits:**

- `17fd747` — 25-01: foundation — config, migration, rate limit, Gemini, Copy Director errors + AbortSignal + 2-tier parseResult
- `2e82c5a` — 25-02: transactional integration — 3-zone pipeline, mandatoryArtworkText, mapper, onboarding grant RPC, title? compatibility
- `d508e9b` — 25-03: tests for pipeline integration — rate-limit, store routes, generate-image route; fix all compilation+test failures (799/799 passing, typecheck clean)

### Phase 29.1.1 — Créditos na Assinatura Visual ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 29-1-1-01 | 1 | ✅ | Backend Foundation — Types, CreditService, Routes (6 tasks) |
| 29-1-1-02 | 2 | ✅ | Frontend — Modal UI + Ocultar Modal Antigo (6 tasks) |
| 29-1-1-03 | 3 | ✅ | Testes e Verificação — 917 testes, typecheck, lint, build |

**Requirements:** CRED-03, CRED-04, CRED-05, OPS-05
**Context:** `.planning/phases/29-1-1-creditos-assinatura-visual/29-1-1-CONTEXT.md`
**Source:** `openspec/changes/fase-29-1-1-creditos-assinatura-visual/`
**Tests:** 917 passing (117 files, 8 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**UAT:** 15/15 ✅ — crédito, saldo, estorno, flags, exhausted removido, insufficient_credits, paginação, reject/approve routes

**Commits:**

- `d735d01` — 29-1-1-01: Backend Foundation — types, credit integration, pagination, remove quota
- `291f605` — 29-1-1-02: Frontend — remove exhausted, add insufficient_credits, hide old modal
- `6ff32ee` — 29-1-1-03: Testes — credit flow (8 testes), regressão
- `b6c8a8c` — fix(29-1-1-03): update makeChain mock for count:exact pagination

### Phase 29.1.2 — Histórico Curto + Assinatura Visual ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 29-1-2-01 | 1 | ✅ | Backend Foundation — approve drift fix + spec update (2 tasks) |
| 29-1-2-02 | 1 | ✅ | Frontend — HistoryModal rewrite + ApprovalModal bridge + pagination (10 tasks) |
| 29-1-2-03 | 2 | ✅ | Testes e Verificação — 22+ testes, regressão completa (6 tasks) |

**Context:** `.planning/phases/29-1-2-historico-curto-assinatura-visual/29-1-2-CONTEXT.md`
**Tests:** 943 passing (118 files, 22+ novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**UAT:** 15/15 ✅ + 1 gap corrigido (hasArchivedSignatures não populado sem VS ativa)

**Commits:**

- `f0e0af2` — 29-1-2-01: Backend Foundation — approve drift fix + spec update
- `720ac8c` — 29-1-2-02: Frontend — HistoryModal rewrite + ApprovalModal bridge + pagination
- `40645d9` — 29-1-2-03: Testes e Verificação — HistoryModal + Backend + Regressão
- `17a893f` — fix(29-1-2): resolve test issues — missing onOpenGallery destructure, mock drift for missing metadata
- `339052f` — fix(29-1-2): hasArchivedSignatures não era populado sem VS ativa
- `b27b3f1` — test(29-1-2): finalize UAT — 15 passed, 1 gap fixed

## Completed

### Phase 29.3 — Créditos Mensais Automáticos ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 29-3-01 | 1 | ✅ | Modelo Contábil — Migration buckets, backfill, 3 SQL functions bucket-aware, types |
| 29-3-02 | 2 | ✅ | grant_monthly_credits RPC + Launch Config — 4 flags mensais, .env.example |
| 29-3-03 | 3 | ✅ | Vercel Cron + Fallback Admin — /api/cron/monthly-credits, vercel.json, admin grant route, UI button |
| 29-3-04 | 4 | ✅ | Testes e Verificação — 119 files, 986 testes, typecheck, lint |

**Tests:** 987 passing (119 files, 4 planos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/29-3-creditos-mensais-automaticos/29-3-CONTEXT.md`
**Commits:**

- `d557fda` — 29-3-01: migration + types + bucket-aware functions
- `06adb28` — 29-3-02: grant_monthly_credits RPC + Launch Config
- `d834d68` — 29-3-03: Vercel Cron + admin fallback + button
- `0329f9b` — 29-3-04: testes + verificação
- `41e9156` — fix: libera rota cron no middleware

## Current Position

Phase: 35 — CHANGELOG/NOVIDADES ✅
Plan: Not started
v1.5 em andamento — Fases 31.1, 31.2, 31.3, 32, 33, 34 e 35 concluídas. F36 (Stripe / Monetização Pública) como próximo marco (renumerada de F35 → F36).

### Phase 35 — Changelog/Novidades ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 35-01 | 1 | ✅ | Foundation — Seed content/changelog (F30, F32, F34) + Core Library pura (types, parser, renderer, schema, date) |
| 35-02 | 1 | ✅ | Core Library — get-changelog.ts (server-only, fail-fast) + Hook use-changelog-state (SSR-safe) |
| 35-03 | 2 | ✅ | Página /novidades + Componentes Changelog (card, list, announcement, sidebar-badge) |
| 35-04 | 2 | ✅ | App Shell + Dashboard — fluxo latestEntryId, sidebar 5º item, AccountMenu, anúncio contextual |
| 35-05 | 3 | ✅ | Rotina + Verificação + Tracking — docs/changelog-update.md cirúrgico, testes/typecheck/lint/build, renumeração |

**Tests:** 1345 passing (170 files, 42 novos F35 — base 1201 + 42 F35 + adicionais das fases 35-01..04)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/35-changelog-novidades/35-CONTEXT.md`
**Source:** `openspec/changes/fase-35-changelog-novidades/`
**Checker:** 25/25 requirements covered, 0 blockers, 0 warnings

### Phase 30 — Fundação Legal ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 30-01 | 1 | ✅ | Migrations (6) + Legal Documents Drafts (3) |
| 30-02 | 2 | ✅ | Core Library — Types, Document Versions, Privacy, Consent, Acceptance, Clearance |
| 30-03 | 3 | ✅ | Public Pages (/termos, /privacidade, /uso-aceitavel) + API Routes (4) + Signup/Onboarding Legal Checkboxes |
| 30-04 | 4 | ✅ | Pipeline Guards + Re-aceite Flow |
| 30-05 | 5 | ✅ | Account Legal Status + Admin Legal Badges |
| 30-06 | 6 | ✅ | Testes e Verificação — 24+ novos, 1018 total |

**Tests:** 1018 passing (125 files, 24+ novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Commits:** a2b0873, e2de329, d355268, cfdd788, 9439e9f, 9ab90dc

### Phase 31.1 — Modelo Comercial — Formulário ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 31-1-01 | 1 | ✅ | Foundation — CampaignIntent type, schemas, BADGE_OPTIONS_BY_INTENT |
| 31-1-02 | 2 | ✅ | Form Logic — inferIntent, CampaignFormFields, conditional validation |
| 31-1-03 | 2 | ✅ | Pipeline Guard — intent guard pre-stream + inputSnapshot normalized |
| 31-1-04 | 3 | ✅ | UI — IntentSelector, conditional badge, preserveImageContext, submit blocking |
| 31-1-05 | 4 | ✅ | Tests — 20 intent tests, regression 1036 total, typecheck/lint/build |

**Tests:** 1036 passing (129 files, 20 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Commits:** afdfbf7, c2a94ce, 17c3d04, 162d5d5, b7b7d38

### Phase 31.2 — Diretores por Intenção ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 31-2-01 | 1 | ✅ | Schema Contracts — discountedPriceCents opcional, CampaignSpecSchema nullable |
| 31-2-02 | 1 | ✅ | Unblock — UI/Form/Route: remover bloqueios, normalização exclusive, validação offer |
| 31-2-03 | 2 | ✅ | 6 Prompt Templates — 3 image + 3 copy por intent |
| 31-2-04 | 2 | ✅ | Image Director Routing — assemblePrompt, buildPromptVariables, validatePrompts por intent |
| 31-2-05 | 2 | ✅ | Copy Director + Content — commercialFrame, buildCommercialRepertoire, buildDeterministicCopy |
| 31-2-06 | 3 | ✅ | Tests + Verification — 15 novos testes, regressão 1051, typecheck/lint/build |

**Tests:** 1051 passing (130 files, 15 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Context:** `.planning/phases/31-2-diretores-por-intencao/31-2-CONTEXT.md`
**Source:** `openspec/changes/fase-31-2-diretores-por-intencao/`

### Phase 31.3 — Quality Gate por Intenção Comercial ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 31-3-01 | 1 | ✅ | Schema + Foundation — ImageReviewInput, ReviewIssueType union, failureType null |
| 31-3-02 | 1 | ✅ | Intent-Aware Review Service — 2-stage vars, expectedBadgeBehavior, empty_review |
| 31-3-03 | 2 | ✅ | Prompt Restructuring — campaign-image-reviewer.md com variáveis contextuais |
| 31-3-04 | 2 | ✅ | Pipeline Integration — buildReviewInput, validatePrompts intent-aware |
| 31-3-05 | 3 | ✅ | Automated Tests — contract/drift tests, regressão |
| 31-3-06 | 3 | ✅ | UAT Real — 5 cenários E2E com IA real (6/6 executados, 5 aprovados, 1 ajuste no diretor exclusive) |

**Source:** `openspec/changes/fase-31-3-quality-gate-por-intencao-comercial/`
**Context:** `.planning/phases/31-3-quality-gate-por-intencao-comercial/31-3-CONTEXT.md`

**Tests:** 1071 passing (131 files, 20 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Commits:**

- `be83d7d` — 31-3-01: Schema + Foundation — ImageReviewInput estendido, ReviewIssueType union, failureType string|null
- `f7cbdaf` — 31-3-02: Intent-Aware Review Service — 2-stage var builder, 3-variant expectedBadgeBehavior, empty_review estruturado
- `45daa35` — 31-3-03: Prompt Restructuring — comportamento esperado, commercial_tone_mismatch, remove placeholders antigos
- `7d4efa1` — 31-3-04: Pipeline Integration — buildReviewInput intent-aware, validatePrompts usa builder compartilhado, verificação de vars contextuais e placeholders antigos
- `faaf234` — 31-3-05: Automated Tests — contract tests, intent-aware review tests, validatePrompts com campaignIntent, regressão offer
- `bc2b2af` — 31-3-06: UAT evidence structure — 5 cenarios E2E com micro-runbook, criterios de aceite e template de evidencias

## Completed

### Phase 34 — Store Readiness ✅

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 34-01 | 1 | ✅ | Migration + Core Libraries — store_billing_info table, RPC check_store_readiness, StoreReadiness/StoreBillingInfo modules, CNPJ Address Mapper, Store type CNPJ fields, cast removal |
| 34-02 | 2 | ✅ | Guarda Dupla + Fluxo Legacy — page guard `/campanhas/nova`, API guard 412, redirect chaining, fallback nome_fantasia, contextual microcopy |
| 34-03 | 2 | ✅ | Step 2 UX + Billing Card — renaming "Direção Visual" + badge, query param suport, billing collapsible card, confirm route |
| 34-04 | 3 | ✅ | Dashboard Banner + Brand Profile — ReadinessBanner with checklist, async server component, three visual direction paths |
| 34-05 | 3 | ✅ | Tests + Verification — 17+ novos testes, 1201 total, typecheck/lint/build clean |

**Tests:** 1201 passing (154 files, 17+ novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Context:** `.planning/phases/34-store-readiness/34-CONTEXT.md`

**Fix commits (pós-verificação):**

- `76199b3` — fix(f34): revise store readiness — 7 correções obrigatórias
- `fae35c8` — fix(f34): correções restantes — fiscal read-only, billing reconsulta, aceite legal
- `06ee23a` — fix(f34): billing manual abre campos + feedback erro reconsulta CNPJ

### Next Phases

| Phase | Status | Description |
|-------|--------|-------------|
| F28 | ✅ Completed | Observabilidade + Operação + Launch Controls (4 plans, 37+ testes, 889 total) |
| F29 | ✅ Completed | Refinamento Visual + UAT + Launch Readiness — UAT 4/4 lojistas aprovado |
| F29.1.1 | ✅ Completed | Créditos na Assinatura Visual — VS consome créditos, remove cota fixa de 3, UAT 15/15 ✅ |
| F29.1.2 | ✅ Completed | Histórico Curto + Assinatura Visual — HistoryModal reescrito (3 plans, 943 testes) |
| F29.3 | ✅ Completed | Créditos Mensais Automáticos — Buckets bônus/compra, grant mensal, Vercel Cron (4 plans, 987 testes) |
| F30 | ✅ Completed | Fundação Legal — 6 migrations, 5 services, 3 public pages, 4 API routes, pipeline guards, re-aceite, admin badges, 24+ testes |
| **F31.1** | **✅ Completed** | **Modelo Comercial — Formulário — CampaignIntent type, inferência, seletor, badge-by-intent, preserveImageContext, pipeline guard** |
| **F31.2** | **✅ Completed** | **Diretores por Intenção — Schemas tolerantes, desbloqueio de intents, 6 prompts, roteamento, conteúdo adaptado, 6 plans, UAT 9/9 ✅** |
| **F31.3** | **✅ Completed** | **Quality Gate por Intenção Comercial — ImageReviewInput intent-aware, prompt reestruturado, commercial_tone_mismatch, 6 plans, 1071 testes, UAT executada com IA real (6/6 cenários)** |
| F32 | ✅ Complete | Freemium Anti-Abuso CNPJ — CNPJ obrigatório, entitlement por raiz, admin freemium status (5/5 plans, 27+ tests) |
| F33 | ✅ Complete | Verificação CNPJ Freemium — Consulta BrasilAPI/CNPJá, cross-check, motor de decisão, admin review, test stores |
| F34 | ✅ Completed | Store Readiness — 5 plans, 17+ testes, 1189 total |
| **F35** | **✅ Completed** | **Changelog/Novidades — 5 plans, 3 waves, 42 testes novos, 1345 total, typecheck/lint/build limpos** |
| F36 | ○ Future | Stripe / Monetização Pública (renumerada de F35 → F36) |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260717-okh | Corrigir bug/guardrail no pipeline de geracao de campanha: evitar chamadas de IA quando houver placeholders nao resolvidos em prompts e corrigir placeholder do revisor. | 2026-07-17 | 5878b0f | [260717-okh-corrigir-bug-guardrail-no-pipeline-de-ge](./quick/260717-okh-corrigir-bug-guardrail-no-pipeline-de-ge/) |
| 260722-001 | Corrigir UX pós-UAT fase 29.1.2 — Gerar nova assinatura abre ApprovalModal direto com textarea | 2026-07-22 | cf19759 | [260722-001-fix-ux-pos-uat-2912](./quick/260722-001-fix-ux-pos-uat-2912/) |
| 260722-hyq | Sanear persistência e cálculo das métricas de crédito — corrigir getRefundRate para filtrar por feature, corrigir getCreditsGranted para somar amounts, adicionar metadata.feature em reserveCredit/refundCredit | 2026-07-22 | 4f73def | [260722-hyq-sanear-persist-ncia-e-c-lculo-das-m-tric](./quick/260722-hyq-sanear-persist-ncia-e-c-lculo-das-m-tric/) |
| 260722-i7v | Separar visualmente as métricas por domínio — 3 seções no admin, 6 funções VS, cross-window fix, duration_ms | 2026-07-22 | c772ffd | [260722-i7v-separar-visualmente-as-m-tricas-por-dom-](./quick/260722-i7v-separar-visualmente-as-m-tricas-por-dom-/) |
| 260722-jwr | Fase 29.2 — Onboarding Grant 10 créditos | 2026-07-22 | 976a571 | [260722-jwr-fase-29-2-onboarding-grant-10-cr-ditos-a](./quick/260722-jwr-fase-29-2-onboarding-grant-10-cr-ditos-a/) |
| 260724-hzz | Privacy Gate pós-login — ciência de Política de Privacidade | 2026-07-24 | fb02332 | [260724-hzz-privacy-gate-p-s-login-ci-ncia-de-pol-ti](./quick/260724-hzz-privacy-gate-p-s-login-ci-ncia-de-pol-ti/) |
| 260729-rag | Corrigir atomicidade do cadastro fiscal pós-F34 | 2026-07-29 | bfc07b4 | [260729-rag-corrigir-atomicidade-do-cadastro-fiscal-](./quick/260729-rag-corrigir-atomicidade-do-cadastro-fiscal-/) |
| 260729-t6x | Adicionar verificação CNPJ externa ao update-cnpj + unificar fluxo fiscal em /loja | 2026-07-30 | 36ae2a7 | [260729-t6x-corrigir-update-cnpj-route-para-verifica](./quick/260729-t6x-corrigir-update-cnpj-route-para-verifica/) |
| 260730-j73 | Corrigir UX de feedback visível no onboarding — feedbacks críticos (erro/sucesso) ficam fora da viewport após ações de salvar/confirmar/gerar | 2026-07-30 | 058c342 | [260730-j73-onboarding-feedback-visivel-quero-corrig](./quick/260730-j73-onboarding-feedback-visivel-quero-corrig/) |
| 260730-kka | Corrigir UX/robustez no card de billing do onboarding para tolerar dados parciais de CNPJ | 2026-07-30 | 33f173e | [260730-kka-billing-cnpj-parcial](./quick/260730-kka-billing-cnpj-parcial/) |
| 260730-mrr | Separar test store de produção no admin — filtro ternário (production/test/all), RPC admin_get_metrics bundle, pipeline refactor, admin pages + testes | 2026-07-30 | 7abffe5 | [260730-mrr-admin-separar-teste-producao](./quick/260730-mrr-admin-separar-teste-producao/) |
| 260730-zfe | Admin Legibilidade — Datas e Labels | 2026-07-30 | 8753513 | [260730-zfe-admin-legibilidade-datas-labels](./quick/260730-zfe-admin-legibilidade-datas-labels/) |
| 260730-pfq | corrigir criação de loja de teste admin quebrada por chk_stores_cnpj_atomic | 2026-07-30 | 239443e | [260730-pfq-corrigir-cria-o-de-loja-de-teste-admin-q](./quick/260730-pfq-corrigir-cria-o-de-loja-de-teste-admin-q/) |
| 260730-o30 | Hotfix admin_get_metrics uuid = text + dead code grant_monthly_credits | 2026-07-30 | 0051a7a | [260730-o30-hotfix-admin-metrics-rpc-uuid-text](./quick/260730-o30-hotfix-admin-metrics-rpc-uuid-text/) |
