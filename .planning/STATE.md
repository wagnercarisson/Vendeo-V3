---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Lançamento Externo Controlado
status: planning
last_updated: "2026-07-16T16:20:00.000Z"
last_activity: 2026-07-16
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 2
  completed_plans: 0
  percent: 0
---

# Project State

**Last updated:** 2026-07-16
**Milestone:** v1.5 — Lançamento Externo Controlado ◆

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

**Total:** 5 phases, 18 plans, 713 tests, 89 files
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**UAT:** 61/61 ✅

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-15)

**Core value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais.

**Current focus:** v1.5 — Lançamento Externo Controlado ◆

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

### Phase 23 — Text Provider + Copy Director

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 23-01 | 1 | 📋 Planned | TextProvider Foundation — types, OpenAI, Mock, factory, PublicationCopySnapshot title? |
| 23-02 | 2 | 📋 Planned | Copy Director + Tests — schema, service, prompt template, parseResult, 10+ testes |

**Requirements:** COPY-01, COPY-02, COPY-03, COPY-04
**Context:** `.planning/phases/23-text-provider-copy-director/23-CONTEXT.md`
**Source:** `openspec/changes/fase-23-text-provider-copy-director/`

## Next Steps

- ✅ Milestone v1.4 — Experiência SaaS **concluída e arquivada** 🎉
- 📋 Phase 23 — Text Provider + Copy Director **planejada** — aguardando autorização para execução

## Current Position

Phase: 23 — Text Provider + Copy Director
Plan: 2/2 planned
Status: Planned — awaiting implementation go-ahead
Last activity: 2026-07-16 — Phase 23 planned
