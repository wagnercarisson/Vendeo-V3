---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Experiência SaaS
status: in_progress
last_updated: "2026-07-13T17:00:00.000Z"
last_activity: 2026-07-13
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State

**Last updated:** 2026-07-13
**Milestone:** v1.4 — Experiência SaaS 🚧 Phase 18 complete (3/3 plans)

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

## Current Position

**Milestone:** v1.4 — Experiência SaaS
**Phase:** 18 — App Shell + UI Base + Rotas ✅ COMPLETE (3/3 plans)
**Current:** Phase 19 ready for planning
**Last activity:** 2026-07-13 — Phase 18 completed

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-10)

**Core value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais.

**Current focus:** v1.4 — Experiência SaaS (Phase 18 complete)

## Completed

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

## Operator Next Steps

- Planejar Phase 19 (próxima fase v1.4)
- Verificar alinhamento com OpenSpec `openspec/changes/fase-18-app-shell-ui-base-rotas/` antes de modificar
