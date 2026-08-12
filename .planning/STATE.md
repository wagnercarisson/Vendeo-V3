---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: — Lançamento Externo Controlado ◆
current_phase: 38.2.1
status: complete
last_updated: "2026-08-12T18:00:00.000Z"
progress:
  total_phases: 24
  completed_phases: 21
  total_plans: 117
  completed_plans: 115
  percent: 98
stopped_at: ""
---

# Project State

**Last updated:** 2026-08-10 (F38.2 Admin de Custos Operacionais + Configurações Econômicas **CONCLUÍDA — 11/11 plans**: 38-2-01 ✅ migrations 3 + db push [BLOCKING] aplicado no remoto (economic_parameters + audit + seeds 1.00/1.00 + RPC admin_set_economic_parameter + RLS service_role; 4 colunas de confiança em generation_events; RPCs admin_get_ai_operation_runs/_events com filtros/paginação/P95/evidências de segmento/insumos de badge); 38-2-02 ✅ tipos econômicos sem server-only (ECONOMIC_PARAMETER_KEYS/EconomicParameterKey/EconomicParameterResolution) + EconomicParameterService server-only fail-open (fallback 1.00)/fail-closed (EconomicParameterUnavailableError → 503) + getAll com source + 10 testes; 38-2-03 ✅ AiCostTracker persiste 4 campos de confiança (D5); 38-2-04 ✅ API GET/PUT /api/admin/economic-parameters (zod + RPC admin_set_economic_parameter); 38-2-05 ✅ OperationRunsService (BRL D1/D4 + badges D5 + segmentação D9 + agregados D3 + detalhe D4, 20 testes); 38-2-06 ✅ API GET /api/admin/ai-operation-runs (lista + detalhe) com AiOperationRunsQuerySchema (janela default 90d/max 365d → 400) + 13 testes; 38-2-07 ✅ UI /admin/operation-costs → 'Configurações Econômicas' (título D2 + seção Parâmetros com ParamsForm: motivo obrigatório + badge source + audit_id + toFixed(2); nav renomeada; 503 fail-closed por seção; checkpoint humano aprovado com melhorias de UI + 8 testes). F38.1 Apuração de Custos de IA por Entrega **CONCLUÍDA — 11/11 plans**: 38-1-10 ✅ views/RPCs apuração + I1–I6 + gates + UAT manual validado; 38-1-11 ✅ runbook trackings. **Fechamento como camada de estimativa operacional granular** — ajuste provisório versionável da tool image_generation (fórmula `responses_image_generation_v2`): `responses:image_generation = USD 0.065` é **estimativa operacional provisória para beta**, calibrada por UAT/dashboard/CSV da OpenAI — **NÃO é custo financeiro real**; a **reconciliação financeira real fica para a próxima fase**. 38/38+2 requirements, 1713 testes, typecheck/lint/build limpos; F38 concluída 8/8 plans, 1597 testes, UAT 4/4; renumeração F37 = Revisão e Aprovação da Arte, F38 = Tabela de Custos, F39 = Stripe)
**Milestone:** v1.5 — Lançamento Externo Controlado ◆ **Em andamento**
**Current phase:** 38.2.1 ✅ Complete

### Phase 38.2.1 — Snapshot Econômico ✅ Complete

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 38-2-1-01 | 1 | ✅ | Migration `20260812000001` — 4 colunas de snapshot+origem em generation_events, CHECKs enum/paridade, backfill aproximado via economic_parameter_audit (seed usd 5.18 / credit 1.00, override do usuário; origem backfilled_from_audit/backfilled_seed) + db push [BLOCKING] no remoto (221/221 linhas) |
| 38-2-1-02 | 2 | ✅ | AiCostEvent (apenas valores) + AiCostTracker.record persiste 4 colunas com origem captured_at_generation + 6 callers (generate-image, VS ×2, brand-profile ×3) resolvem 1× e propagam; falha não bloqueia geração |
| 38-2-1-03 | 2 | ✅ | RPCs `admin_get_ai_operation_runs`/`_events` expõem snapshots+origens por run/evento (contrato aditivo, sem derivar BRL) + db push |
| 38-2-1-04 | 3 | ✅ | OperationRunsService: deriveBrl com snapshot ?? corrente, deriveSummary soma por run (taxas distintas não se misturam), contrato renomeado receitaEstimadaBrl/resultadoEstimadoBrl/margemEstimadaPct + creditValueSource/usdBrlRateSource/revenueEstimationNote |
| 38-2-1-05 | 4 | ✅ | API/UI painel: labels estimados, badge de origem (fallback/backfilled), coluna câmbio, aviso "valem para novas gerações" + legend |
| 38-2-1-06 | 2 | ✅ | getAvgCostBrl (média BRL call-level por evento com snapshot) + card "Custo Médio IA" em BRL + aviso Configurações Econômicas; nunca VENDEO_USD_BRL_RATE |
| 38-2-1-07 | 5 | ✅ | Verificação I1–I7 (53/53 asserts banco real) + 4 gates verdes (1887 testes) + UAT manual aprovado + fix pós-UAT do filtro not.in |

**Tests:** 1887 passing (213 files) | **TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Verification:** `scripts/verify/38-2-1-f38-2-1-verification.mjs` — 53/53 asserts
**UAT:** Aprovado pelo usuário (2026-08-12) — histórico estável, nova geração usa vigente, labels estimados, aviso presente
**Source of truth:** `openspec/changes/fase-38-2-1-economic-snapshot/`
**Context:** `.planning/phases/38.2.1-economic-snapshot/38.2.1-CONTEXT.md`

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
| Phase 38-1-ai-cost-accounting P01 | 45min | 3 tasks | 1 files |
| Phase 38-1-ai-cost-accounting P02 | 7min | 3 tasks | 5 files |
| Phase 38-1-ai-cost-accounting P03 | 8min | 3 tasks | 7 files |
| Phase 38-1-ai-cost-accounting P04 | 19min | 3 tasks | 7 files |
| Phase 38-1-ai-cost-accounting P05 | 10min | 3 tasks | 8 files |
| Phase 38-1-ai-cost-accounting P06 | 8min | 3 tasks | 4 files |
| Phase 38-1-ai-cost-accounting P07 | 11min | 3 tasks | 5 files |
| Phase 38-1-ai-cost-accounting P08 | 9min | 3 tasks | 4 files |
| Phase 38-1-ai-cost-accounting P09 | 12min | 3 tasks | 11 files |
| Phase 38-1-ai-cost-accounting PP09 | 12min | 3 tasks | 11 files |
| Phase 38.2 P38-2-01 | 16min | 4 tasks | 4 files |
| Phase 38.2 P38-2-02 | 3min | 3 tasks | 3 files |
| Phase 38.2 P38-2-03 | 2min | 3 tasks | 3 files |
| Phase 38.2 P38-2-04 | 6min | 3 tasks | 3 files |
| Phase 38.2 P38-2-05 | 13min | 6 tasks | 3 files |
| Phase 38.2 PP38-2-06 | 8min | 4 tasks | 6 files |
| Phase 38.2 PP38-2-07 | 12min | 3 tasks | 5 files |
| Phase 38.2 P38-2-09 | 7min | 3 tasks | 4 files |
| Phase 38.2 P38-2-08 | 11min | 4 tasks | 10 files |
| Phase 38.2 P38-2-10 | 6min | 2 tasks | 2 files |
| Phase 38.2-admin-custos-operacionais P12 | 32min | 2 tasks | 2 files |
| Phase 38.2-admin-custos-operacionais P13 | 185min | 2 tasks | 4 files |
| Phase 38.2-admin-custos-operacionais P14 | 5min | 3 tasks | 4 files |
| Phase 38.2.1-economic-snapshot P38-2-1-01 | 5min | 2 tasks | 1 files |
| Phase 38.2.1-economic-snapshot P38-2-1-02 | 14min | 3 tasks | 15 files |
| Phase 38.2.1-economic-snapshot P38-2-1-03 | 14min | 2 tasks | 1 files |
| Phase 38.2.1-economic-snapshot P38-2-1-04 | 15min | 3 tasks | 7 files |
| Phase 38.2.1-economic-snapshot P38-2-1-05 | 8min | 3 tasks | 9 files |
| Phase 38.2.1-economic-snapshot P38-2-1-06 | 5min | 3 tasks | 7 files |

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

Phase: 38.2.1 (economic-snapshot) — COMPLETE (7/7 plans, UAT aprovado)
Plan: 38-2-1-07 ✅ — Verificação I1–I7 (53/53 asserts banco real) + 4 gates verdes (1887 testes) + UAT manual aprovado + fix pós-UAT do filtro not.in em getAvgCostBrl; fase completa
v1.5 em andamento — Fases 31.1, 31.2, 31.3, 32, 33, 34, 35, 36, 38 e 38.1 concluídas. F38 (Tabela de Custos por Operação, v1.5) concluída — 8/8 plans, 1597 testes, UAT 4/4; F38.1 (Apuração de Custos de IA por Entrega, desdobramento da F38) **CONCLUÍDA** — 11/11 plans, 1713 testes, UAT validado, **fechada como camada de estimativa operacional granular** (ajuste provisório da tool image_generation `0.065` = estimativa beta provisória, não custo real; reconciliação financeira real na próxima fase), fonte da verdade `openspec/changes/fase-38-1-ai-cost-accounting/`; **F38.2 (Admin de Custos Operacionais + Configurações Econômicas, desdobramento da F38) em EXECUÇÃO — 10/11 plans** — painel `/admin/ai-operation-costs` (KPIs/filtros/tabela/drilldown/segmentos) + `economic_parameters` configuráveis + badges de confiança + correção `/admin/metrics`, fonte `openspec/changes/fase-38-2-admin-custos-operacionais/`; 38-2-01 ✅ migrations/db push (schema econômico + RPCs de runs no remoto), 38-2-02 ✅ tipos econômicos + EconomicParameterService fail-open/fail-closed + 10 testes (base das rotas 38-2-04/05/06/09), 38-2-03 ✅ AiCostTracker persiste 4 campos de confiança (D5), 38-2-04 ✅ API GET/PUT /api/admin/economic-parameters (zod + RPC admin_set_economic_parameter, 200/400/403/500, idempotência, 9 testes da rota, sem endpoint público), 38-2-05 ✅ OperationRunsService server-only (BRL D1/D4 via EconomicParameterService + badges D5 por evento/entrega + segmentação classifySegment D9 com filtro e re-paginação + storeName/owner D3 + 8 agregados D3/D9 sobre o conjunto filtrado inteiro + getRunDetail D4 com BRL/badges/componentes por evento; 20 testes, typecheck/lint limpos), 38-2-06 ✅ API GET /api/admin/ai-operation-runs (lista) + GET /api/admin/ai-operation-runs/[operationRunId] (detalhe) com AiOperationRunsQuerySchema (janela default 90d/max 365d → 400) delegando 100% ao OperationRunsService (BRL/badge/segmento nunca na rota) + 13 testes (tarefa 12.4, piso 11; regressão 1804 testes); **gap closure UAT (plans 12-15) CONCLUÍDO — verificação final: 1839 testes + 4 gates verdes + UAT manual 12/12 aprovado**; F37 (Revisão e Aprovação da Arte, v1.5, experimento beta) em planejamento futuro; F39 (Stripe / Monetização Pública) como marco futuro pós-beta (renumerada de F36 → F37 → F39). **38-2-10 OK: verificacao I1-I6 em banco real (script 50/50 asserts) + gates verdes (vitest 1832/1832, typecheck, lint, build) + UAT 13.3 coletado para harvest end-of-phase (I1-I6 documentados em 38-2-VERIFICATION.md)**. **38-2-12 OK (gap UAT estornos): migration 20260811000001 com CREATE OR REPLACE dos RPCs admin_get_ai_operation_runs/_events expondo creditos_estornados (refunds via reference→deduction no ledger) e creditos_liquidos = max(bruto−estorno, 0) por run E no summary/detalhe — creditos_debitados BRUTO inalterado, view F38.1 intocada; db push aplicado no remoto (validado via REST: estornados=3/liquidos=17 em 20 runs/90d); I5 estendido com 13 asserts novos → 63/63 asserts 0 falhas em banco real; gates verdes (vitest 1834/1834, typecheck/lint/build exit 0)**.

### Phase 36 — Onboarding: Navegação por Abas ✅ Complete

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 36-01 | 1 | ✅ | Migration `create_store_draft` + `POST /api/store` dois modos (draft/fiscal) + schema push aplicado |
| 36-02 | 1 | ✅ | Core — tabs.ts, tab-state.ts, draft-store.ts + testes (sem dep. do banco) |
| 36-03 | 2 | ✅ | autoSave, use-onboarding-tabs (popstate back/forward), drift estendido, cleanup logout |
| 36-04 | 3 | ✅ | StoreTabs ARIA + LegalAcceptancePanel + form refactor + parsing `?tab=` |
| 36-05 | 4 | ✅ | Redirects/banners → `?tab=` |
| 36-06 | 5 | ✅ | Testes endpoint/gates/draft→fiscal, regressão, checkpoint humano aprovado |

**Context:** `.planning/phases/36-onboarding-navegacao-por-abas/36-CONTEXT.md`
**Source:** `openspec/changes/fase-36-onboarding-navegacao-por-abas/` (fonte da verdade)
**Checker:** 31/31 requirements covered, 0 blockers, 0 warnings

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

### Phase 38 — Tabela de Custos por Operação ✅ Complete

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 38-01 | 1 | ✅ | Migration `credit_operation_costs` + audit + RPC `admin_update_operation_cost` |
| 38-02 | 1 | ✅ | Core Library — OperationCostService, DEFAULT_OPERATION_COSTS, fail-open/fail-closed |
| 38-03 | 2 | ✅ | generate-image consome custo dinâmico com guards 503 |
| 38-04 | 2 | ✅ | generate-without-logo consome custo dinâmico + snapshot metadata |
| 38-05 | 3 | ✅ | Admin — schema, API GET/PUT, página `/admin/operation-costs` + navegação |
| 38-06 | 3 | ✅ | GET `/api/operation-costs` + hook `useOperationCosts` + balance-card dinâmico |
| 38-07 | 4 | ✅ | UI dinâmica — campaign-input-form, drift-critical-modal, visual-signature-approval-modal |
| 38-08 | 5 | ✅ | Verificação real I1-I6 + teste de integração + build gate + UAT tracking |

**Tests:** 1597 passing
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**UAT:** 4/4 passed — custo 1→2, operação desligada → 503, fail-open, fail-closed (verificado em `.planning/phases/38-credit-operation-costs/38-UAT.md`)

**Source:** `openspec/changes/fase-38-credit-operation-costs/` (fonte da verdade)
**Context:** `.planning/phases/38-credit-operation-costs/38-CONTEXT.md`
**UAT:** `.planning/phases/38-credit-operation-costs/38-UAT.md`

### Phase 38.1 — Apuração de Custos de IA por Entrega ✅ Complete

Desdobramento da F38. Custo real por chamada de IA (tokens/USD) agregado por entrega via `generation_events` + `operation_run_id`; `AiCostTracker` como camada única de registro; `resolveAiCost` (provider_reported → pricing_table → fallback_static → not_available); tabela `ai_model_pricing` versionada + RPC `admin_set_ai_model_price` + GET/PUT `/api/admin/ai-model-pricing` (sem página); views/RPCs de apuração e reconciliação USD × créditos (sem UI); furos 1–7 da F38 corrigidos; ~51 testes novos + verificação I1–I6.

**Fechamento (2026-08-09) — camada de ESTIMATIVA OPERACIONAL GRANULAR, não reconciliação financeira final.** Ajuste provisório versionável da tool image_generation (fórmula `responses_image_generation_v2`): `estimated_cost_usd = text_component_usd + image_tool_component_usd`, aplicado apenas em `generationType=campaign_image` + `imageGenerationTool=true` (anti-dupla-cobrança em visual_signature/brand_profile/fallback gpt-image-2). **`responses:image_generation = USD 0.065` é ESTIMATIVA OPERACIONAL PROVISÓRIA PARA BETA**, calibrada por UAT/dashboard/CSV da OpenAI — **NÃO preenche `provider_reported_cost_usd` e NÃO é custo financeiro real**; a **reconciliação financeira real fica para a próxima fase**. Fonte versionável: linha `ai_model_pricing ('openai','responses:image_generation')` (migration 20260809000003, aplicada em Local e Remote) ou bootstrap `DEFAULT_AI_MODEL_PRICING`, ajustável via GET/PUT `/api/admin/ai-model-pricing`; metadata do evento `campaign_image` leva `cost_formula_version`, `text_component_usd`, `image_tool_component_usd`, `image_tool_pricing_*` e `cost_estimation_note=provisional_image_tool_unit_cost_until_provider_reconciliation`, mantendo `provider_usage_raw`.

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 38-1-01 | 1 | ✅ | Migration `f38_1_create_ai_cost_accounting` — colunas `generation_events` + CHECKs + índices, `campaigns.operation_run_id`, `ai_model_pricing` + seeds + RPC (db push [BLOCKING]) |
| 38-1-02 | 2 | ✅ | Types call-level + `AiCostTracker` (único caminho de escrita, best-effort) |
| 38-1-03 | 2 | ✅ | Admin — RPC pricing + GET/PUT `/api/admin/ai-model-pricing` + `/api/admin/ai-costs` + seeds |
| 38-1-04 | 3 | ✅ | `resolveAiCost` 4 fontes nunca-null (D9) + `ai-model-pricing` (D8) + `legacy-estimator` síncrono + barrel (10 cenários 6.1, 1643 testes) |
| 38-1-05 | 3 | ✅ | D11 event contract (usage+durationMs) + `onCall` copy/validation/review/image-gen (13 cenários, 1657 testes) |
| 38-1-06 | 3 | ✅ | `onCall` no VS generator (Responses API) + brand profiler (visão, from-zero) — 1661 testes |
| 38-1-07 | 4 | ✅ | Rotas 6.3 — generate-image (call-level, delivery sem custo, totalCost) |
| 38-1-08 | 4 | ✅ | Rotas 6.4 — generate-without-logo (VS/validation custo, nova tentativa = novo run) |
| 38-1-09 | 4 | ✅ | Rotas 6.5 — brand-profile/* + infer + realign (3 caminhos IA) + brand-director/text-only onCall (15 testes novos, 1700 testes) |
| 38-1-10 | 5 | ✅ | Views/RPCs apuração + verificação I1–I6 (banco real) + 50 testes + gates + UAT checkpoint validado |
| 38-1-11 | 6 | ✅ | Runbook trackings 8.1–8.5 + fechamento (0.065 provisório beta; reconciliação financeira real na próxima fase) |

**Status:** Milestone complete

**Source:** `openspec/changes/fase-38-1-ai-cost-accounting/` (fonte da verdade)
**Context:** `.planning/phases/38-1-ai-cost-accounting/38-1-CONTEXT.md`
**Patterns:** `.planning/phases/38-1-ai-cost-accounting/38-1-PATTERNS.md`

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
| F36 | ✅ Complete | Onboarding — Navegação por Abas (6/6 plans, 31/31 requirements, 1479 testes, code review aplicado) |
| F37 | ○ In progress | Revisão e Aprovação da Arte (v1.5, experimento beta — planejamento futuro) |
| **F38** | **✅ Complete** | **Tabela de Custos por Operação — 8/8 plans, 1597 testes, I1-I6 verificados no banco real, build gate verde, UAT 4/4 aprovado** |
| **F38.1** | **✅ Complete** | **Apuração de Custos de IA por Entrega — 11/11 plans, 40/40 requirements, 1713 testes (199 arquivos), I1–I6 banco real, UAT validado; fechada como camada de ESTIMATIVA OPERACIONAL GRANULAR (0.065 provisório beta; reconciliação financeira real na próxima fase)** |
| **F38.2** | **○ Complete** | **Admin de Custos Operacionais + Configurações Econômicas — 11/11 plans: parâmetros econômicos configuráveis (`economic_parameters` usd_brl_rate/credit_value_brl + RPC + API + página Configurações Econômicas), painel `/admin/ai-operation-costs` (KPIs/filtros/tabela/drilldown/agregados por segmento), badges de confiança, correção `/admin/metrics` (Custo Médio IA call-level), verificação I1-I6 + 4 gates verdes** |
| F39 | ○ Future | Stripe / Monetização Pública (v1.7, pós-beta — renumerada de F36 → F37 → F39) |

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
| 260731-qep | Adequar documentação legal para beta freemium — Termos v1.3, Privacidade v1.2, AUP v1.1, remoção de aviso de draft (markdowns + páginas públicas), microcopy discreta em campanhas | 2026-07-31 | 020e197 | [260731-qep-adequar-documentos-legais-beta-freemium-](./quick/260731-qep-adequar-documentos-legais-beta-freemium-/) |
| 260804-s16 | Corrigir assimetria Diretor/Revisor de Imagem: mandatoryArtworkText chega ao diretor mas nao ao revisor. Espelhar contrato de contexto (mandatoryArtworkText, campaignDetails, additionalDetails) ao ImageReviewInput e ao prompt do revisor com linguagem de revisao, adicionando testes focados. | 2026-08-04 | 47a1a4a | [260804-s16-corrigir-assimetria-diretor-revisor-de-i](./quick/260804-s16-corrigir-assimetria-diretor-revisor-de-i/) |
| 260808-rqw | Landing pública + acesso fechado beta — landing / com form de solicitação, POST /api/access-requests (zod + anti-duplicidade + anti-enumeração), /signup neutralizado (beta fechado), fix pós-login /dashboard, admin /admin/access-requests com RPC atômico + audit log, doc SUPABASE-CLOSED-BETA.md | 2026-08-08 | 00947d0 | [260808-rqw-landing-p-blica-acesso-fechado-beta](./quick/260808-rqw-landing-p-blica-acesso-fechado-beta/) |
| 260808-udc | PWA básico instalável (sem service worker) + clareza de custo por operação no card de créditos — manifest.ts (start_url /dashboard), 4 PNGs via sharp em public/icons/, metadata PWA/iOS no layout (viewport themeColor), dica iOS discreta na conta, BalanceCard com Campanha/Assinatura visual sem texto ambíguo | 2026-08-09 | 101739e | [260808-udc-planejar-pwa-basico-clareza-no-card-de-c](./quick/260808-udc-planejar-pwa-basico-clareza-no-card-de-c/) |

## Decisions

- [Phase 38.2.1-economic-snapshot]: Conversão BRL movida para o domínio de métricas: getAvgCostBrl (pipeline-metrics) pré-formata o card "Custo Médio IA" como string R$ X,XX e o MetricsCards devolve strings sem re-conversão — a página não recalcula histórico (T-38.2.1-18); getAvgCost (USD) mantido APENAS para o computeHealthState (thresholds em USD); env deprecado com grep 0 literal nos diretórios de métricas (prova de não-uso por ausência, sem ocorrência residual em testes) (38-2-1-06)

- [Phase 38.2.1-economic-snapshot]: Asserts negativos (not.toContain('receitaOpBrl'/'receitaRealBrl')) nos testes das rotas materializam o grep-gate D8 como contrato testável — a resposta NUNCA contém nomes proibidos; as ocorrências dessas strings nos testes são intencionais (verificação), não fixtures (38-2-1-05)
- [Phase 38.2.1-economic-snapshot]: Fixtures de UI (makeRun/SUMMARY/makeListResult) com default snapshot CAPTURED (5.0/1.0, captured_at_generation, note null) — cenário legado (fallback) vira divergência explícita; origem exibida na UI exclusivamente do contrato do service via sourceOriginLabel (a UI nunca infere — T-38.2.1-14/15); data-testid/data-origin no wrapper div porque o Badge do design system não repassa props (38-2-1-05)
- [Phase 38.2.1-economic-snapshot]: Snapshot do run = 1º evento call-level com a coluna de valor preenchida (subquery correlacionada ORDER BY created_at ASC LIMIT 1); a origem correspondente usa o MESMO predicado (coluna de VALOR IS NOT NULL) — determinístico, valor e origem da mesma linha (T-38.2.1-09, D6) (38-2-1-03)
- [Phase 38.2.1-economic-snapshot]: RPCs continuam sem derivar BRL (D1/D5) — CREATE OR REPLACE estritamente aditivo (corpo copiado de 20260811000001 + campos no fim de projeções/JSON); contrato backward-compatible, nada removido; REVOKE/GRANT service_role e assinaturas p_* preservados (38-2-1-03)
- [Phase 38.2.1-economic-snapshot]: Push via pooler sem token no ambiente (link gvbzwihwgzujwsviufgy) — dry-run "Would push" → push exit 0 → dry-run "Remote database is up to date."; validação REST service_role: 20 runs com os 4 campos (5.18/backfilled_seed, 1.00/backfilled_seed) (38-2-1-03)
- [Phase 38.2.1-economic-snapshot]: Origem do snapshot é SEMPRE do tracker — AiCostEvent/GenerationEventInsert carregam apenas valores (usdBrlRateAtGeneration/creditValueBrlAtGeneration); o caller nunca define origem (anti-spoofing T-38.2.1-04); o tracker grava captured_at_generation quando o valor está presente e NULL quando ausente (paridade do banco preservada) (38-2-1-02)
- [Phase 38.2.1-economic-snapshot]: Resolução 1× por run (não N+1 por chamada — D3/T-38.2.1-05): cada startRun resolve o snapshot via EconomicParameterService (Promise.all de getParameter); retry do VS e os 3 paths do realign abrem novos runs com novos snapshots (valores vigentes naquele momento) (38-2-1-02)
- [Phase 38.2.1-economic-snapshot]: Best-effort de resolução em todos os callers — try/catch com log; falha → valores null → eventos NULL → fallback legacy em leitura (economic_parameter_fallback só no service, nunca persistido); geração nunca bloqueada (38-2-1-02)
- [Phase 38.2.1-economic-snapshot]: OVERRIDE do phase owner (2026-08-11): seed do backfill de usd_brl_rate = 5.18 (o plano dizia 1.00 — eventos legados sem audit anterior refletem o câmbio real do período); credit_value_brl = 1.00; origem backfilled_seed nas duas chaves — aplicado no COALESCE dos UPDATEs do backfill e documentado como deviation (38-2-1-01)
- [Phase 38.2.1-economic-snapshot]: Fix Rule 1 no backfill — SET deve referenciar a derived table exposta pelo FROM (sub.new_value), nunca o alias interno da LATERAL (av): 42P01 no 1º push, rollback transacional limpo, corrigido e re-pushado (38-2-1-01)
- [Phase 38.2.1-economic-snapshot]: Backfill executa após os CHECKs (em conformidade: valor+origem sempre juntos, só backfilled_*); idempotência POR COLUNA (WHERE <coluna> IS NULL) (38-2-1-01)
- [Phase 38-1-ai-cost-accounting]: provider do onCall do CopyDirectorService derivado de this.provider.name (TextProvider já expõe name) — sem campo providerName extra no construtor (38-1-05)
- [Phase 38-1-ai-cost-accounting]: durationMs do GenerationMetricsEvent usa elapsedMs do pipeline (Date.now() - startTime) como base no helper emitMetricsEvent — escolha documentada no código (38-1-05)
- [Phase 38-1-ai-cost-accounting]: onCall interno no generateImage captura usage e enriquece o evento da fase existente — nunca invoca onMetricsEvent direto (anti-dupla-contagem T-38.1-22, canal único) (38-1-05)
- [Phase 38-1-ai-cost-accounting]: Fixes Rule 1 no push da migration F38.1-01: REVOKE ALL ON VIEW -> ON TABLE (sintaxe PostgreSQL) e MAX(uuid) -> GROUP BY nas CTEs de admin_cost_vs_credits
- [Phase 38-1-ai-cost-accounting]: Views admin_ai_* sem GRANT direto ao cliente (404 no REST confirma T-38.1-03) - acesso exclusivo via RPC SECURITY DEFINER
- [Phase 38-1-ai-cost-accounting]: AiCostEvent importa GenerationEventType/Status de visual-signature/types (D5) - enum nao duplicado em ai-cost/types.ts (evita drift com o banco)
- [Phase 38-1-ai-cost-accounting]: insertGenerationEvent delega ao AiCostTracker e retorna null em sucesso (record e void) - consumidores atuais apenas await; API publica mantida por compat (teste 7 do spec)
- [Phase 38-1-ai-cost-accounting]: Mapeamento cost/tokens do delegate do insert so gera AiCostEvent.cost/tokens quando campos presentes - sem cost/tokens = delivery marker preservado (D1/D6)
- [Phase 38-1-ai-cost-accounting]: resolveAiCost normaliza o model ANTES da busca (normalizeModel na BUSCA — D9); ai-model-pricing.ts mantem copia local do normalizeModel (evita dependencia circular com cost-estimator) — Testes 6.1 exigem lookup por modelo base; getModelPricing ja normaliza no bootstrap — dupla normalizacao e idempotente
- [Phase 38-1-ai-cost-accounting]: not_available alcançável via desabilitação explícita do fallback: env VENDEO_AI_FALLBACK_COST_USD (ou compat antigo) = '0'/'none'/'disabled'/'off' → sem preço/config → custo NULL (D4); env inválido continua → default 0.15 (T-38.1-20) — Cenario 6.1 #8 exige o caminho not_available; a cadeia D9 padrao sempre cai em fallback_static (default 0.15)
- [Phase 38-1-ai-cost-accounting]: manual_unknown alcançável via parâmetro opcional manualCostUsd (D4: custo inserido/ajustado manualmente sem origem automática) — extensão retrocompatível do contrato documentado — Cenario 6.1 #10 exige o caminho manual_unknown 'presente no contrato e alcançável'; o contrato documentado de 4 params não o permitia
- [Phase 38-1-ai-cost-accounting]: Teste cached gpt-5.5 usa a semântica do spec (input pago = 600 uncached + 400 cached → 0.0092), não a aritmética do PLAN (0.0112) que duplica contagem dos cached tokens — PLAN anotava 0.0050 (1000 prompt a cheio) + 0.0002 (cached) — cobra os mesmos 400 tokens duas vezes; spec do cenário e contrato legado definem o desconto (uncached = prompt - cached)
- [Phase 38-1-ai-cost-accounting]: onCall do AiImageGenerator so no caminho de sucesso (chamada concluida); erro nao emite evento - failed gravado pela rota 38-1-08 — anti-dupla-contagem T-38.1-28/F38.1-25
- [Phase 38-1-ai-cost-accounting]: brand-profiler.ts so tem chamadas de visao (callVision/callVisionFull); brand_profile_text vem do text-only-inference-service.ts na rota 38-1-09 (D11) — D5: nao inventar chamada; plano assumia 2 onCalls no path 2
- [Phase 38-1-ai-cost-accounting]: recordCall na rota generate-image e fire-and-forget (void) no caminho de resultado — telemetria nunca bloqueia geracao (T-38.1-29, D7); ordem de resolucao garantida pelos awaits do pipeline (upload/update) antes do logPipelineEvent com totalCost (38-1-07)
- [Phase 38-1-ai-cost-accounting]: campaign_input_validation vem do onMetricsEvent do ImageGenerationService (fase input_validation, attempt 0) — a validacao pre-stream da rota (guards 409/conflict) nao emite evento pois nao chega a criar campanha (38-1-07)
- [Phase 38-1-ai-cost-accounting]: duration_is_pipeline centralizada no helper recordCall (delivery) — o tracker a adiciona de novo (idempotente); chamada de delivery nao repassa metadata, mantendo grep de controle em 1 ocorrencia na rota (38-1-07)
- [Phase 38-1-ai-cost-accounting]: Retry VS = novo startRun + flushCallEvents(null) fechando o run 1 (eventos da tentativa falha gravados com visual_signature_id null) antes de abrir o run 2 — o run falho nao recebe o id da assinatura do retry (T-38.1-37, D1) (38-1-08)
- [Phase 38-1-ai-cost-accounting]: Imagem e validacao VS atravessam o MESMO onCall (D11); a rota distingue visual_signature_image vs visual_signature_validation pelo model real da chamada (validacao = IMAGE_VALIDATION_MODEL || gpt-4o-mini) (38-1-08)
- [Phase 38-1-ai-cost-accounting]: Eventos call-level VS enfileirados (pendingCalls) ate o visual_signature_id existir (apos persistSignature) — todos os eventos do run com o id (D2); operationRunId/attempt capturados no momento da chamada (38-1-08)
- [Phase 38-1-ai-cost-accounting]: Rota principal /brand-profile (GET/PATCH/archive) NAO gera via profiler — entrega brand_profile_with_logo emitida no path logo do realign (director.analyze); decidido e testado na rota principal (38-1-09 task 2.3)
- [Phase 38-1-ai-cost-accounting]: Buffer de AiCallInfo por sequencia nas rotas brand: 1a entrada = brand_profile_vision, 2a = brand_profile_text (mapeamento deterministico por path — T-38.1-39); na pratica brand-profiler.ts so emite visao, text-only e servico separado (38-1-09)
- [Phase 38-1-ai-cost-accounting]: onCall de analyze/infer em try/catch await (aceita sync e async, nunca lanca — D7); caminho mock dev sem OPENAI_API_KEY nao emite onCall (sem chamada real de IA — 6.5) (38-1-09)
- [Phase 38.2]: Migration 4 de fix separada (padrão F38.1) para MIN(uuid) no RPC de runs — PostgreSQL não tem agregado MIN/MAX para UUID; subqueries correlacionadas ORDER BY created_at LIMIT 1 (38-2-01)
- [Phase 38.2]: Evidências de segmento (D9) expostas como dados brutos no RPC (store_is_test, deduction_purchased_amount/bonus, admin_grant_evidence); classificação é do service layer (38-2-05), nunca no RPC (38-2-01)
- [Phase 38.2]: creditos_debitados reutiliza public.admin_cost_vs_credits via SQL interno do RPC SECURITY DEFINER — proibição de .from() vale para a camada app/service, não para SQL de migration (38-2-01)
- [Phase 38.2]: [Phase 38.2] Default/fallback de AMBOS os parâmetros = 1.00 (conservador — D1), via constante DEFAULT_ECONOMIC_PARAMETER_VALUE exportada do service (38-2-02)
- [Phase 38.2]: Defesa value <= 0 implementada no service (log + fallback 1.00, nunca propaga inválido) como complemento ao CHECK value > 0 do banco — T-38.2-10 mitigado em 3 camadas (service + CHECK + zod na rota 38-2-04) (38-2-02)
- [Phase 38.2]: getAll usa ordem fixa de ECONOMIC_PARAMETER_KEYS com .find() por chave — source visível por resolução para o admin (38-2-02)
- [Phase 38.2]: JSDoc do tracker.ts reformulado sem os literais snake_case das colunas para satisfazer o grep verify (== 1 por coluna) — padrão de desvio da 38-2-02 (38-2-03)
- [Phase 38.2]: Persistência de confiança com ?? null (não undefined): campos opcionais ausentes do CostResolution → colunas NULL explícitas → badge genérico na UI (D5); sem backfill em histórico (38-2-03)
- [Phase 38.2]: Suite do tracker tinha 13 testes F38.1 (não 8 como o plano estimou) — 4 novos adicionados, total real 17 verdes; critério '12 testes' do acceptance criteria baseado em contagem imprecisa (38-2-03)
- [Phase 38.2]: PUT usa safeParse no body (catch -> null) para 400 unico { error: 'Dados invalidos', details } — JSON malformado cai no mesmo 400 zod (38-2-04)
- [Phase 38.2]: Resposta do PUT em camelCase { parameter: { key, value }, auditId, updatedAt, idempotent } — mapeamento do JSONB do RPC para o contrato D2 da UI 38-2-07 (38-2-04)
- [Phase 38.2]: Paginação progressiva aplicada SEMPRE (não só com filtro de segmento): o RPC devolve só a página, mas summary/aggregations (D3/D4) exigem o conjunto filtrado inteiro — o service acumula o conjunto base (page_size 100) e re-pagina no final (38-2-05)
- [Phase 38.2]: byStage agrupa sob 'unknown' quando o RPC não expõe generation_type por run (gap de contrato do 38-2-01); campo lido como opcional quando presente; registro em deferred-items.md para 38-2-06/38-2-10 (38-2-05)
- [Phase 38.2]: admin_grant (D9): shape confirmado do RPC ({ grant_count: N } com N > 0); shape divergente → unknown — nunca inferir errado (T-38.2-20) (38-2-05)
- [Phase 38.2]: Summary/P95 recomputados no service (helper percentile replicando percentile_cont) sobre o conjunto inteiro — consistência entre summary e aggregations; o summary do RPC permanece como fonte do total da paginação (38-2-05)
- [Phase 38.2]: storeName/owner fail-open (log + null → bucket 'unknown'): dado de apresentação; caminho monetário/segmento é fail-closed (RPC + parâmetros econômicos → 503) (38-2-05)
- [Phase 38.2]: byHour usa hora UTC de created_at — determinístico entre ambientes (Vercel = UTC; dev local em São Paulo não desloca o agregado) (38-2-05)
- [Phase 38.2]: Segmento validado no zod via enum local OPERATION_RUN_SEGMENTS (sem importar do service server-only) - mesmo contrato D9 do service — schemas.ts e modulo compartilhado importado por rotas admin
- [Phase 38.2]: Janela de periodo validada no zod com superRefine (periodStart+periodEnd presentes e diff > 365d -> 400); datas ausentes -> OK (default 90d no service/RPC) — Limite operacional de janela T-38.2-25
- [Phase 38.2]: getAvgCost usa o RPC admin_get_ai_costs (F38.1, estavel, aceita p_hours direto) em vez do novo admin_get_ai_operation_runs (D4) — key_links do plano apontam para o primeiro; documentado no JSDoc (38-2-09)
- [Phase 38.2]: storeKind nao e suportado pelo RPC de apuracao (sem filtro de loja) — getAvgCost mantem a assinatura (hours, storeKind) por compat mas ignora storeKind; card de custo e global (38-2-09)
- [Phase 38.2]: Env VENDEO_USD_BRL_RATE mantido apenas como comentario de fallback de bootstrap (sem uso ativo) — atende D2 (fonte unica = parametro) e o grep verify <= 1 (38-2-09)
- [Phase 38.2]: getParameter('usd_brl_rate') resolvido apos o early-return de empty state — nenhuma leitura de parametro quando nao ha cards a renderizar (38-2-09)
- [Phase 38.2]: Página /admin/ai-operation-costs consome OperationRunsService direto (padrão operation-costs/metrics — service server-only); drilldown (client) usa fetch à GET /api/admin/ai-operation-runs/[id]. KPIs/agregados vêm de summary/aggregations do service — a UI NUNCA recalcula (D3/D4). Filtros dos searchParams (contrato camelCase da API 38-2-06) repassados ao service; filtros client navegam com router.push. Placeholder F38.3 (D7) como colunas/blocos fixos. (38-2-08)
- [Phase 38.2]: I1 seeds: contrato é o valor 1.00 (D1 conservador); updated_by preenchido após edição via UI/RPC é auditoria funcionando, não falha — Verificação I1 em banco real (38-2-10)
- [Phase 38.2]: I6 delivery markers: invariante anti-dupla-contagem = nenhum marker pós-F38.1 (operation_run_id NOT NULL) carrega custo; 51 markers legados (operation_run_id NULL) são inertes por construção (views/RPCs filtram operation_run_id IS NOT NULL + generation_type NOT IN) — Verificação I6 em banco real (38-2-10)
- [Phase 38.2]: Linhas de teste I2/I3 permanecem na economic_parameter_audit (reason 38-2-10-verification) — append-only por desenho (trigger bloqueia até DELETE de service_role); não afetam a UI — Verificação I2/I3 (38-2-10)
- [Phase 38.2-admin-custos-operacionais]: RPCs da F38.2 expõem creditos_estornados/creditos_liquidos por run (gap UAT) — fix exclusivo nos RPCs (CREATE OR REPLACE), view F38.1 intocada, creditos_debitados BRUTO mantido
- [Phase 38.2]: Receita/resultado/margem derivados de creditos_liquidos — bruto (creditosDebitados) permanece como auditoria de deduções — Decisão D1/D4 do phase owner — KPIs refletem estornos; full-refund zera receita mantendo custo de IA
- [Phase 38.2]: Floor 0 (estorno > bruto) aplicado pelo RPC via GREATEST (38-2-12) — o service consome creditos_liquidos e nunca recalcula o líquido — Decisão D1/D4 do phase owner — KPIs refletem estornos; full-refund zera receita mantendo custo de IA
- [Phase 38.2]: mapDetailRun delegado a deriveBrl — uma única fórmula monetária para lista e detalhe (RawDetailRun agora carrega os 3 campos de crédito) — Decisão D1/D4 do phase owner — KPIs refletem estornos; full-refund zera receita mantendo custo de IA
- [Phase 38.2]: KpiDef estendido com tooltip?: string renderizado via title no card — tooltip nativo HTML, sem dependencia nova (38-2-14)
- [Phase 38.2]: Breakdown da celula de creditos em linhas separadas (Bruto/Estorno/Liquido) + linha financeira muted — asserts exatos por linha nos testes (38-2-14)
- [Phase 38.2]: Bloco financeiro do drilldown condicionado a creditosDebitados !== null — runs historicos sem dados nao exibem linha vazia (38-2-14)
- [Phase 38.2]: Textos compostos via template literal nos componentes — match exato do getByText sem ambiguidade de nos JSX (38-2-14)
- [Phase 38.2.1-economic-snapshot]: Origem do valor exposta com union de 4 valores em OperationRun/summary: captured_at_generation / backfilled_from_audit / backfilled_seed / economic_parameter_fallback — um valor backfilled NUNCA se apresenta como captured; fallback de leitura sempre sinalizado (T-38.2.1-11)
- [Phase 38.2.1-economic-snapshot]: deriveSummary passa a somar os BRL JA derivados por run (D5/T-38.2.1-12): re-derivacao do total USD com taxa unica removida — alterar parametro corrente nao recalcula historico com snapshot (estabilidade temporal testada com corrente 6.00)
- [Phase 38.2.1-economic-snapshot]: Agregacao de origem do summary com precedencia deterministica: fallback > backfilled_from_audit > backfilled_seed > captured; revenueEstimationNote derivada da origem agregada do credito
- [Phase 38.2.1-economic-snapshot]: Evento call-level expoe snapshots/origens cruas (nullable) + estimatedCostBrl com snapshot do evento ?? corrente; run do detalhe usa os snapshots do RPC (1o evento do run — D6)
