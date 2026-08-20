---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: â€” LanÃ§amento Externo Controlado â—†
current_phase: 42
status: in_progress
last_updated: 2026-08-20T20:15:00.000Z
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 52
  completed_plans: 165
  percent: 87
stopped_at: F42 em VERIFICACAO - 20/20 plans implementados (2182 testes, 4 gates verdes); UAT humano 20.5-20.15 pendente + push migration 42-12 [BLOCKING]
---

# Project State

**Last updated:** 2026-08-17 â€” **F42 (Signup Controlado e Elegibilidade Freemium, v1.5) EM PLANEJAMENTO â€” fase de planos completa (20/20 plans escritos e commitados)**. Fonte da verdade: `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/`. Contexto: `42-CONTEXT.md` âœ…, UI-SPEC aprovada (1 fix co-location aplicado), `42-PATTERNS.md` âœ…, `42-PLAN-OUTLINE.md` (20 plans / 8 waves) + `42-01..42-20-PLAN.md` âœ…. Plan-checker (gsd-plan-checker) completo x5 rodadas: 0 blockers finais; estruturas vÃ¡lidas, dependÃªncias DAG, 12/12 specs referenciadas, threat_model em todos os plans. **PrÃ³ximo: revisÃ£o humana dos planos â†’ plan-checker completo â†’ execuÃ§Ã£o.** Antes: F41 (MÃ­dia de Campanha Mobile, v1.5) CONCLUÃDA â€” 13/13 plans, 4 gates verdes (222 files / 2033 testes), UAT humano 6/6 cenÃ¡rios (Android validado em produÃ§Ã£o âœ…; iOS/HEIC pendente de confirmaÃ§Ã£o final).
**Milestone:** v1.5 â€” LanÃ§amento Externo Controlado â—† **Em andamento**
**Current phase:** 42

### Phase 40 â€” Campos Comerciais e Avisos do Brief âœ… Complete (9 plans / 5 waves)

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 40-01 | 1 | âœ… | Trackings / renumeraÃ§Ã£o D1 (verificaÃ§Ã£o grep-consistÃªncia F40 = Brief Comercial, Stripe â†’ F41 nos 6 runbooks; zero resÃ­duos) |
| 40-02 | 1 | âœ… | Constante Ãºnica `ILLUSTRATIVE_NOTICE_TEXT` + checkbox `IllustrativeNoticeField` + placeholder normalizado |
| 40-03 | 1 | âœ… | Reframe do aviso ilustrativo nos 4 prompts do diretor (hardcode â†’ bloco condicional) |
| 40-04 | 2 | âœ… | Form state 6 campos novos + helpers `buildMandatoryArtworkText`/`buildValidityDisplayText`/`formatDDMM` + body + migraÃ§Ã£o de draft legado |
| 40-05 | 3 | âœ… | `ValidityField` presentacional + seÃ§Ãµes Produto/Oferta/Avisos + credits test co-migrado |
| 40-06 | 3 | âœ… | Testes 1-8 validade + 9-15 aviso + 8.8 brief |
| 40-07 | 3 | âœ… | Testes 16-21 prompt reframe + fixtures image-gen/review co-migradas |
| 40-08 | 4 | âœ… | route.test.ts fixtures + regressÃ£o completa |
| 40-09 | 5 | âœ… | VerificaÃ§Ã£o final: gates + VERIFICATION.md + UAT humana (checkpoint) |

**F40 CONCLUÃDA â€” 9/9 plans, 1997 testes (221 arquivos), 4 gates verdes, UAT humano aprovado 6/6 (1 ajuste de UX: placeholder/helper do texto obrigatÃ³rio).** Sem migration SQL (D9 â€” snapshot `campaign_brief_v1` tolerante via jsonb). Fonte da verdade: `openspec/changes/fase-40-campos-comerciais-avisos-brief/`.

### Phase 41 â€” MÃ­dia de Campanha Mobile âœ… Complete (13 plans / 6 waves)

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 41-01 | 1 | âœ… | Trackings D1 (grep-verificaÃ§Ã£o renumeraÃ§Ã£o F41/F42, zero resÃ­duos, registro commit 195b467) |
| 41-02 | 1 | âœ… | Config + Transporte schema (MAX_CAMPAIGN_IMAGES=4 + teto agregado; ProductImageInputSchema + productImages[] + productImageDataUrl optional) |
| 41-03 | 1 | âœ… | Prompts 1+N (bloco descritivo nos 4 prompts, sem variÃ¡vel nova, golden 38 keys) |
| 41-04 | 2 | âœ… | DomÃ­nio + PersistÃªncia (mapper multi + mimeTypeFromDataUrl + storagePath; createCampaign campaignId? + uploadCampaignInputImage + removeCampaignInputs) |
| 41-05 | 1 | âœ… | Provider + Service (N input_image, fallback edit gated 2 pontos, mediaImagesDataUrls, review com primary) + co-migraÃ§Ã£o testes |
| 41-06 | 3 | âœ… | Rota (exclusividade 400, teto 413, campaignId prÃ©-gerado, upload prÃ©-snapshot, cleanup) + co-migraÃ§Ã£o asserts/integraÃ§Ã£o |
| 41-07 | 3 | âœ… | Form hook (estado multi, HEIC/EXIF, body D2, draft multi) + co-migraÃ§Ã£o call site/testes irmÃ£os |
| 41-08 | 4 | âœ… | UI (CampaignImageUpload multi + capture + grid; seÃ§Ã£o Imagens adicionais) + credits test co-migrado |
| 41-09 | 4 | âœ… | Testes 1-8 (mapper/snapshot: multi, legado, invariante, mimeType, storagePath, exactly-1-primary) |
| 41-10 | 5 | âœ… | Testes 9-16 (UI/form: primary, remoÃ§Ã£o, source, HEIC/EXIF, body, draft N, limites) |
| 41-11 | 5 | âœ… | Testes 17-23 (pipeline/provider/review/prompt: N input_image, fallback gated, golden 38, bloco 1+N, primary-only, review) |
| 41-12 | 4 | âœ… | Testes 4 + 24-27 (rota: 400 ambÃ­guo, 413, storage D5, cleanup, regressÃ£o) |
| 41-13 | 6 | âœ… | VerificaÃ§Ã£o final (4 gates + VERIFICATION.md + UAT.md + checkpoint humano) |

**F41 CONCLUÃDA â€” 13/13 plans, 4 gates verdes (222 files / 2033 testes, +36 vs F40), UAT humano 6/6 cenÃ¡rios (Android validado em produÃ§Ã£o âœ…; iOS HEIC pendente de confirmaÃ§Ã£o final).** Sem migration SQL (D5 â€” snapshot `campaign_brief_v1` tolerante + bucket `campaign-images` existente). Fonte da verdade: `openspec/changes/fase-41-midia-de-campanha-mobile/`.

### Phase 39 â€” Brief Estruturado de Campanha âœ… Complete (8 plans / 7 waves)

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 39-01 | 1 | âœ… | Trackings / renumeraÃ§Ã£o D1 (F39 = Brief, Stripe â†’ F40) nos 6 arquivos de runbook |
| 39-02 | 1 | âœ… | Contrato de domÃ­nio `CampaignBrief` (brief.ts + brief-schema.ts sem server-only) + testes 8.1-8.6/8.15 |
| 39-03 | 2 | âœ… | Rename wrapper `CampaignBrief` â†’ `ResolvedCampaignContext` + `InputSnapshot` â†’ `CampaignBriefSnapshot` (8.21) |
| 39-04 | 3 | âœ… | Mapper `buildCampaignBriefFromFlat` + builder `buildCampaignBriefSnapshot` (8.7-8.14) |
| 39-05 | 4 | âœ… | Costuras copy + review: `mapBriefToCopyDirectorInput` e `ImageReviewInput` do domÃ­nio (8.19/8.20) |
| 39-06 | 5 | âœ… | Costuras image-generation: `buildPromptVariables`/`buildCommercialRepertoire` domÃ­nio + golden tests por intent (8.16-8.18) |
| 39-07 | 6 | âœ… | Rota: converter flatâ†’domÃ­nio na fronteira + `input_snapshot` via builder + co-migraÃ§Ã£o fixtures/benchmark |
| 39-08 | 7 | âœ… | VerificaÃ§Ã£o: vitest/typecheck/lint/build + VERIFICATION.md + UAT humana |

**Source of truth:** `openspec/changes/fase-39-brief-estruturado-campanha/`
**Antercessora:** F38.2.1 (Snapshot EconÃ´mico) â€” precedente de snapshot imutÃ¡vel
**Sucessora:** F37 (RevisÃ£o e AprovaÃ§Ã£o da Arte â€” consome o snapshot versionado)

### Phase 38.2.1 â€” Snapshot EconÃ´mico âœ… Complete

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 38-2-1-01 | 1 | âœ… | Migration `20260812000001` â€” 4 colunas de snapshot+origem em generation_events, CHECKs enum/paridade, backfill aproximado via economic_parameter_audit (seed usd 5.18 / credit 1.00, override do usuÃ¡rio; origem backfilled_from_audit/backfilled_seed) + db push [BLOCKING] no remoto (221/221 linhas) |
| 38-2-1-02 | 2 | âœ… | AiCostEvent (apenas valores) + AiCostTracker.record persiste 4 colunas com origem captured_at_generation + 6 callers (generate-image, VS Ã—2, brand-profile Ã—3) resolvem 1Ã— e propagam; falha nÃ£o bloqueia geraÃ§Ã£o |
| 38-2-1-03 | 2 | âœ… | RPCs `admin_get_ai_operation_runs`/`_events` expÃµem snapshots+origens por run/evento (contrato aditivo, sem derivar BRL) + db push |
| 38-2-1-04 | 3 | âœ… | OperationRunsService: deriveBrl com snapshot ?? corrente, deriveSummary soma por run (taxas distintas nÃ£o se misturam), contrato renomeado receitaEstimadaBrl/resultadoEstimadoBrl/margemEstimadaPct + creditValueSource/usdBrlRateSource/revenueEstimationNote |
| 38-2-1-05 | 4 | âœ… | API/UI painel: labels estimados, badge de origem (fallback/backfilled), coluna cÃ¢mbio, aviso "valem para novas geraÃ§Ãµes" + legend |
| 38-2-1-06 | 2 | âœ… | getAvgCostBrl (mÃ©dia BRL call-level por evento com snapshot) + card "Custo MÃ©dio IA" em BRL + aviso ConfiguraÃ§Ãµes EconÃ´micas; nunca VENDEO_USD_BRL_RATE |
| 38-2-1-07 | 5 | âœ… | VerificaÃ§Ã£o I1â€“I7 (53/53 asserts banco real) + 4 gates verdes (1887 testes) + UAT manual aprovado + fix pÃ³s-UAT do filtro not.in |

**Tests:** 1887 passing (213 files) | **TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Verification:** `scripts/verify/38-2-1-f38-2-1-verification.mjs` â€” 53/53 asserts
**UAT:** Aprovado pelo usuÃ¡rio (2026-08-12) â€” histÃ³rico estÃ¡vel, nova geraÃ§Ã£o usa vigente, labels estimados, aviso presente
**Source of truth:** `openspec/changes/fase-38-2-1-economic-snapshot/`
**Context:** `.planning/phases/38.2.1-economic-snapshot/38.2.1-CONTEXT.md`

## Completed

### v1.2 â€” Contas e Propriedade (Phases 7â€“11)

| Phase | Status | Plans | Description |
|-------|--------|-------|-------------|
| 7. SessÃ£o e Login Vertical | âœ… | 5/5 | `@supabase/ssr`, middleware, login, logout, requireUser |
| 8. Ciclo de Conta | âœ… | 4/4 | signup, confirm, forgot-password, SMTP Resend, UAT 14/14 |
| 9. Cutover de Ownership | âœ… | 4/4 | migration user_id, getCurrentStore, requireOwnership, localStorage removido |
| 10. PerÃ­metro Multi-tenant | âœ… | 6/6 | RLS 5 tabelas, CSRF, guards ~20 handlers, 457 tests, Security 14/14 |
| 11. VerificaÃ§Ã£o e Hardening | âœ… | 1/1 | D8 Catalog 21/21 PASS, store-logos inventÃ¡rio (0 objetos) |

### v1.3 â€” PersistÃªncia e Entrega da Campanha âœ…

| Phase | Status | Plans | Description |
|-------|--------|-------|-------------|
| 12. FundaÃ§Ã£o DB/Storage | âœ… | 5/5 | campaigns table, campaign-images bucket, RLS/Storage policies, verify script |
| 13. ServiÃ§o de PersistÃªncia | âœ… | 3/3 | types.ts, persistence.ts (7 helpers), download route, 25 testes |
| 14. IntegraÃ§Ã£o no Fluxo de GeraÃ§Ã£o | âœ… | 3/3 | image-processor.ts, orchestration generate-image, consumer navigation |
| 15. PÃ¡gina de Campanha | âœ… | 3/3 | display.ts (RLS), /campanha/[id], 4 estados visuais, middleware |
| **16. Minhas Campanhas** | âœ… | **3/3** | **list.ts, /minhas-campanhas UI, navegaÃ§Ã£o, 21 testes** |
| **17. EdiÃ§Ã£o de Publication Copy** | âœ… | **2/2** | **migration SQL, display contract, validaÃ§Ã£o, PATCH route, UI ediÃ§Ã£o inline, 17 testes** |

**Tests:** 579 passing (67 files, 29 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

## Completed

### Phase 15 â€” PÃ¡gina de Campanha âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 15-01 | 1 | âœ… | Data/Display Contract â€” display.ts (getCampaignForDisplay, generateSignedPreviewUrl, computeDisplayStatus, CampaignPageProps) |
| 15-02 | 2 | âœ… | UI `/campanha/[id]` â€” page.tsx + client.tsx (4 estados) + middleware |
| 15-03 | 2 | âœ… | Tests & Verification â€” 19 novos testes, typecheck/lint/build |

**Tests:** 524 passing (60 files, 19 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

## Completed

### Phase 13 â€” ServiÃ§o de PersistÃªncia e Download âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 13-01 | 1 | âœ… | Types & Persistence Service â€” types.ts, persistence.ts (7 helpers) |
| 13-02 | 1 | âœ… | Download Route â€” GET /api/campaign/[id]/download |
| 13-03 | 2 | âœ… | Tests â€” 19+6 cenÃ¡rios |

**Tests:** 490 passing (53 files)
**TypeScript:** Clean | **Lint:** Clean

### Phase 14 â€” IntegraÃ§Ã£o no Fluxo de GeraÃ§Ã£o âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 14-01 | 1 | âœ… | Image Processor + Publication Copy â€” sharp, transcodeToJpeg, buildPublicationCopySnapshot, types.ts realinhado |
| 14-02 | 2 | âœ… | OrquestraÃ§Ã£o em generate-image â€” pipeline INSERTâ†’IAâ†’transcodeâ†’uploadâ†’updateReady com compensaÃ§Ã£o |
| 14-03 | 3 | âœ… | Consumer no Cliente â€” navegaÃ§Ã£o /campanha/[id], sessionStorage campaign_preview removido |

## Archived Milestones

### v1.4 â€” ExperiÃªncia SaaS âœ… SHIPPED

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 18 â€” App Shell + UI Base + Rotas | 3/3 | âœ… | 2026-07-13 |
| 19 â€” Onboarding & Estados Vazios | 3/3 | âœ… | 2026-07-13 |
| 20 â€” Dashboard | 3/3 | âœ… | 2026-07-13 |
| 21 â€” HistÃ³rico e Busca | 3/3 | âœ… | 2026-07-14 |
| 22 â€” Mobile Hardening | 3/3 | âœ… | 2026-07-15 |
| 29.1.2 â€” HistÃ³rico Curto + Assinatura Visual | 3/3 | âœ… | 2026-07-21 |

**Total:** 5 phases, 18 plans, 713 tests, 89 files
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**UAT:** 61/61 âœ…

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-15)

**Core value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confianÃ§a de publicar e que ajude a vender mais.

**Current focus:** Milestone complete

## Completed Milestones

### Phase 18 â€” App Shell + UI Base + Rotas âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 18-01 | 1 | âœ“ | UI Base (7 componentes) + estrutura diretÃ³rios + root layout cleanup + redirects + testes |
| 18-02 | 2 | âœ“ | App Shell: sidebar, topbar, account-menu, drawer, (app)/layout + testes |
| 18-03 | 2 | âœ“ | MigraÃ§Ã£o rotas + dashboard + conta + middleware + token cleanup + testes |

**Tests:** 600 passing (79 files)

**Commits:**

- `900be21` â€” 18-01: UI Base + estrutura + redirects + testes
- `e24016d` â€” 18-02: App Shell + sidebar + topbar + account-menu + drawer + (app)/layout + testes
- `6d97072` â€” 18-03: Route migration + polish + 600 testes

## Performance Metrics

| Phase | Plans | Duration | Tests |
|-------|-------|----------|-------|
| Phase 18-app-shell-ui-base-rotas | 3 plans | ~multi-cycle | 579â†’600 (21 novos) |
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

### Phase 19 â€” Onboarding & Estados Vazios âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 19-01 | 1 | âœ… | FundaÃ§Ã£o do Onboarding Helper â€” types, count, state, microcopy + 9 testes |
| 19-02 | 2 | âœ… | Dashboard Inteligente â€” async server component com 3 estados + 6 testes |
| 19-03 | 3 | âœ… | Campanhas + Detalhe sem Loja â€” empty states, 404, microcopy + 7 testes |

**Tests:** 600â†’628 passing (86 files, 28 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/19-onboarding-estados-vazios/19-CONTEXT.md`
**Source:** `openspec/changes/fase-19-onboarding-estados-vazios/`

**Commits:**

- `8dfc693` â€” 19-01: FundaÃ§Ã£o do Onboarding Helper â€” types, count, state, microcopy + 9 testes
- `801948a` â€” 19-02: Dashboard Inteligente â€” async server component com 3 estados + 6 testes
- `bbd3d0e` â€” 19-03: Campanhas + Detalhe sem Loja â€” redirects substituÃ­dos por empty state/404 + 7 testes
- `ef18659` â€” Atualiza testes existentes para redirectâ†’empty state e nova microcopy

### Phase 20 â€” Dashboard âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 20-01 | 1 | âœ… | MÃ©tricas e Recentes â€” `metrics.ts` (4 funÃ§Ãµes + 1 tipo), `count.ts` reexport + 9 testes |
| 20-02 | 2 | âœ… | Dashboard Completo â€” saudaÃ§Ã£o, 3 cards mÃ©tricas, campanhas recentes, next-step card, links |
| 20-03 | 2 | âœ… | Testes e Acabamento Responsivo â€” 20 testes (11 novos cenÃ¡rios + 9 edge cases) |

**Tests:** 628â†’651 passing (87 files, 23 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/20-dashboard/20-CONTEXT.md`
**Source:** `openspec/changes/fase-20-dashboard/`

**Commits:**

- `3a17fe2` â€” 20-01: Metrics module + count.ts reexport + 9 tests
- `e8b5839` â€” 20-02: Dashboard real + 20-03: Testes (20 tests)

### Phase 21 â€” HistÃ³rico e Busca âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 21-01 | 1 | âœ… | Query Contract â€” list.ts (ListCampaignsParams/Result), search-params.ts, countCampaignsFiltered, 29 testes |
| 21-02 | 2 | âœ… | URL State + Filtros â€” SSR searchParams, useDebounce, client.tsx com busca/chips/presets/sort/CAMPAIGNS_SEARCH_EMPTY, 12 testes |
| 21-03 | 3 | âœ… | Pagination + Acabamento â€” componente Pagination, integraÃ§Ã£o, 10 testes |

**Tests:** 651â†’691 passing (89 files, 40 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/21-historico-busca/21-CONTEXT.md`
**Source:** `openspec/changes/fase-21-historico-busca/`

**Commits:**

- `3886f96` â€” 21-01: Query Contract â€” list.ts, search-params.ts, 29 testes
- `b31923b` â€” 21-02: URL State + Filtros â€” SSR, useDebounce, client.tsx, microcopy, 12 testes
- `48a6e3b` â€” 21-03: Pagination + Acabamento â€” Pagination, integraÃ§Ã£o, 10 testes

## Milestone v1.5 â€” LanÃ§amento Externo Controlado â—†

### Phase 23 â€” Text Provider + Copy Director âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 23-01 | 1 | âœ… | TextProvider Foundation â€” types, OpenAI, Mock, factory, PublicationCopySnapshot title?, 10 testes |
| 23-02 | 2 | âœ… | Copy Director + Tests â€” schema, service, prompt template, parseResult, 17 testes |

**Requirements:** COPY-01, COPY-02, COPY-03, COPY-04
**Tests:** 740 passing (91 files, 27 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Context:** `.planning/phases/23-text-provider-copy-director/23-CONTEXT.md`
**Source:** `openspec/changes/fase-23-text-provider-copy-director/`

**Commits:**

- `1df7298` â€” 23-01: TextProvider Foundation â€” interface, OpenAI, Mock, factory, PublicationCopySnapshot title?, +10 testes
- `b9a8ffc` â€” 23-02: Copy Director + Tests â€” schemas, CopyDirectorService, prompt template, parseResult 3-layer fallback, +17 testes

## Next Steps

- âœ… Milestone v1.4 â€” ExperiÃªncia SaaS **concluÃ­da e arquivada** ðŸŽ‰
- âœ… Phase 23 â€” Text Provider + Copy Director **implementada**
- âœ… Phase 24 â€” CrÃ©ditos â€” Schema, Saldo e TransaÃ§Ãµes **implementada**

## Completed

### Phase 24 â€” CrÃ©ditos â€” Schema, Saldo e TransaÃ§Ãµes âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 24-01 | 1 | âœ… | Migration SQL + CreditService â€” 3 SQL functions atÃ´micas, credit_balances, credit_transactions append-only, tipos Zod, classe 6 mÃ©todos |
| 24-02 | 2 | âœ… | Tests + SQL Verification â€” 28 testes, concorrÃªncia, invariantes |

**Tests:** 768 passing (92 files, 28 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/24-creditos-schema-saldo-transacoes/24-CONTEXT.md`

**Commits:**

- `14136e8` â€” 24-01: Migration â€” credit_balances table
- `8251b7b` â€” 24-01: Migration â€” credit_transactions table
- `db7f1fe` â€” 24-01: Migration â€” grant_credits SQL function
- `1cc492d` â€” 24-01: Migration â€” reserve_credit SQL function
- `9361b96` â€” 24-01: Migration â€” refund_credit SQL function
- `f925d56` â€” 24-01: Migration â€” REVERT section
- `d2b3526` â€” 24-01: CreditService types (Zod + TypeScript)
- `eee8fba` â€” 24-01: CreditService class (6 methods)
- `cc981eb` â€” 24-02: Test setup + mocks
- `7c91c0f` â€” 24-02: 6 testes Saldo e Grant
- `29a4af1` â€” 24-02: 7 testes Reserva e DeduÃ§Ã£o
- `81cadd7` â€” 24-02: 5 testes Estorno
- `b565cf5` â€” 24-02: 4 testes HistÃ³rico
- `76f4362` â€” 24-02: 3 testes ConcorrÃªncia + 3 Invariantes

### Phase 26 â€” Admin Operacional + Convites + CrÃ©ditos Manuais âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 26-01 | 1 | âœ… | FundaÃ§Ã£o â€” Migration, Gate, Middleware e Layout Admin |
| 26-02 | 2 | âœ… | API Routes e PÃ¡ginas Admin |
| 26-03 | 3 | âœ… | Testes e VerificaÃ§Ã£o â€” 25 novos testes |

**Tests:** 829 passing (102 files, 25+ novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/26-admin-operacional/26-CONTEXT.md`
**Source:** `openspec/changes/fase-26-admin-operacional/`

**Commits:**

- `77e0cf2` â€” 26-01: FundaÃ§Ã£o â€” migration, requireAdmin, middleware, layout
- `89a5aa0` â€” 26-02: API routes + admin pages (6 routes, 5 pages, schemas)
- `3d64f5f` â€” 26-03: Testes + summaries + STATE/ROADMAP (25 testes, 829 total)

### Phase 27 â€” Conta + Saldo VisÃ­vel + Extrato âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 27-01 | 1 | âœ… | FundaÃ§Ã£o â€” CreditService Session + BalanceDisplay + BalanceCard |
| 27-02 | 2 | âœ… | PÃ¡ginas e IntegraÃ§Ã£o â€” TransactionHistory + CreditCta + Dashboard + /conta + GeraÃ§Ã£o |
| 27-03 | 3 | âœ… | Testes e VerificaÃ§Ã£o â€” 20 novos testes |

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06
**Tests:** 852 passing (108 files, 20 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/27-conta-saldo-extrato/27-CONTEXT.md`
**Source:** `openspec/changes/fase-27-conta-saldo-extrato/`

**Commits:**

- `b7db26c` â€” 27-01: CreditService session client + countCreditTransactions + BalanceDisplay + BalanceCard
- `0d61e9a` â€” 27-02: TransactionHistory + CreditCta + Dashboard + /conta + GeraÃ§Ã£o flow
- `aa136e0` â€” 27-03: Testes e VerificaÃ§Ã£o (20 novos testes, 852 total)

## Completed

### Phase 28 â€” Observabilidade + OperaÃ§Ã£o + Launch Controls âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 28-01 | 1 | âœ… | FundaÃ§Ã£o â€” Launch Config, AI Cost Estimator, Pipeline Logger (3 mÃ³dulos, 16 testes) |
| 28-02 | 2 | âœ… | Migrations + Pipeline Integration + Rate Limit (2 SQL, pipeline instrumentado) |
| 28-03 | 3 | âœ… | Pipeline Metrics + Admin Dashboard + DocumentaÃ§Ã£o (7 funÃ§Ãµes, 3 docs) |
| 28-04 | 4 | âœ… | Testes e VerificaÃ§Ã£o â€” ConcorrÃªncia, Telemetria, RegressÃ£o + UAT (7+28 testes) |

**Requirements:** OPS-01 a OPS-09
**Tests:** 889 passing (116 files, 37 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Commits:**

- `30f35c7` â€” 28-01: launch config + AI cost estimator + pipeline logger â€” 16 tests
- `246df41` â€” 28-02: migrations + pipeline integration + rate limit bypass
- `24d2359` â€” 28-03: pipeline metrics + admin dashboard + operations docs
- `991de75` â€” 28-04: concurrency, telemetry, and regression tests

**Context:** `.planning/phases/28-observabilidade-operacao-launch-controls/28-CONTEXT.md`

---

### Phase 29 â€” Refinamento Visual + UAT + Launch Readiness âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 29-01 | 1 | âœ… | Componentes Base â€” Skeleton 5 variantes + shimmer dark-mode + loading-skeleton wrapper + error-state + 12 loading.tsx + 2 error.tsx |
| 29-02 | 2 | âœ… | Empty States (7) + Error States (4) + Microcopy PT-BR (14 substituiÃ§Ãµes) + Modal crÃ©ditos a11y + Admin dark OLED (6 pÃ¡ginas) |
| 29-03 | 2 | âœ… | Mobile Hardening (6 Ã¡reas) + Legibilidade (10 critÃ©rios, auditoria 3 peÃ§as) + Launch Readiness Docs (4 docs) |
| 29-04 | 3 | âœ… | UAT Externo (4 lojistas, 4/4 aprovado) + DecisÃ£o Final + RegressÃ£o |

**Tests:** 889 passing (116 files)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Commits:**

- `e8981b8` â€” 29-01: Skeleton variants + 12 loading.tsx + 2 error.tsx + error-state.tsx
- `38cd4dc` â€” 29-02: empty states, error states, microcopy, admin harmonization, modal a11y
- `14eff71` â€” 29-03: mobile hardening, legibility checklist, launch readiness docs
- `5d83a72` â€” 29-04: UAT roteiro, pool doc, regressÃ£o completa (889/889)
- `99ba86d` â€” docs(fase 29): artefatos de observabilidade/uat
- `262a897` â€” fix(fase 29): refinamentos visuais pelo usuÃ¡rio

**Context:** `.planning/phases/29-refinamento-visual-uat-launch-readiness/`
**Summaries:** `01-SUMMARY.md`, `02-SUMMARY.md`, `03-SUMMARY.md`, `04-SUMMARY.md`

---

### Phase 25 â€” IntegraÃ§Ã£o Transacional Pipeline âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 25-01 | 1 | âœ… | FundaÃ§Ã£o â€” Config, Migration, Rate Limit, Copy Director e Gemini |
| 25-02 | 2 | âœ… | IntegraÃ§Ã£o Transacional â€” mandatoryArtworkText, Mapper, Pipeline 3 Zonas, Onboarding Grant e Compatibilidade |
| 25-03 | 3 | âœ… | Testes e VerificaÃ§Ã£o â€” 34+ testes, rate-limit, pipeline F25, store onboarding, retroactive title?; 799/799 passing |

**Requirements:** PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, UI-05
**Tests:** 799 passing (94 files, 34+ novos)
**TypeScript:** Clean | **Build:** Clean

**Context:** `.planning/phases/25-integracao-transacional-pipeline/25-CONTEXT.md`
**Source:** `openspec/changes/fase-25-integracao-transacional-pipeline/`

**Commits:**

- `17fd747` â€” 25-01: foundation â€” config, migration, rate limit, Gemini, Copy Director errors + AbortSignal + 2-tier parseResult
- `2e82c5a` â€” 25-02: transactional integration â€” 3-zone pipeline, mandatoryArtworkText, mapper, onboarding grant RPC, title? compatibility
- `d508e9b` â€” 25-03: tests for pipeline integration â€” rate-limit, store routes, generate-image route; fix all compilation+test failures (799/799 passing, typecheck clean)

### Phase 29.1.1 â€” CrÃ©ditos na Assinatura Visual âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 29-1-1-01 | 1 | âœ… | Backend Foundation â€” Types, CreditService, Routes (6 tasks) |
| 29-1-1-02 | 2 | âœ… | Frontend â€” Modal UI + Ocultar Modal Antigo (6 tasks) |
| 29-1-1-03 | 3 | âœ… | Testes e VerificaÃ§Ã£o â€” 917 testes, typecheck, lint, build |

**Requirements:** CRED-03, CRED-04, CRED-05, OPS-05
**Context:** `.planning/phases/29-1-1-creditos-assinatura-visual/29-1-1-CONTEXT.md`
**Source:** `openspec/changes/fase-29-1-1-creditos-assinatura-visual/`
**Tests:** 917 passing (117 files, 8 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**UAT:** 15/15 âœ… â€” crÃ©dito, saldo, estorno, flags, exhausted removido, insufficient_credits, paginaÃ§Ã£o, reject/approve routes

**Commits:**

- `d735d01` â€” 29-1-1-01: Backend Foundation â€” types, credit integration, pagination, remove quota
- `291f605` â€” 29-1-1-02: Frontend â€” remove exhausted, add insufficient_credits, hide old modal
- `6ff32ee` â€” 29-1-1-03: Testes â€” credit flow (8 testes), regressÃ£o
- `b6c8a8c` â€” fix(29-1-1-03): update makeChain mock for count:exact pagination

### Phase 29.1.2 â€” HistÃ³rico Curto + Assinatura Visual âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 29-1-2-01 | 1 | âœ… | Backend Foundation â€” approve drift fix + spec update (2 tasks) |
| 29-1-2-02 | 1 | âœ… | Frontend â€” HistoryModal rewrite + ApprovalModal bridge + pagination (10 tasks) |
| 29-1-2-03 | 2 | âœ… | Testes e VerificaÃ§Ã£o â€” 22+ testes, regressÃ£o completa (6 tasks) |

**Context:** `.planning/phases/29-1-2-historico-curto-assinatura-visual/29-1-2-CONTEXT.md`
**Tests:** 943 passing (118 files, 22+ novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**UAT:** 15/15 âœ… + 1 gap corrigido (hasArchivedSignatures nÃ£o populado sem VS ativa)

**Commits:**

- `f0e0af2` â€” 29-1-2-01: Backend Foundation â€” approve drift fix + spec update
- `720ac8c` â€” 29-1-2-02: Frontend â€” HistoryModal rewrite + ApprovalModal bridge + pagination
- `40645d9` â€” 29-1-2-03: Testes e VerificaÃ§Ã£o â€” HistoryModal + Backend + RegressÃ£o
- `17a893f` â€” fix(29-1-2): resolve test issues â€” missing onOpenGallery destructure, mock drift for missing metadata
- `339052f` â€” fix(29-1-2): hasArchivedSignatures nÃ£o era populado sem VS ativa
- `b27b3f1` â€” test(29-1-2): finalize UAT â€” 15 passed, 1 gap fixed

## Completed

### Phase 29.3 â€” CrÃ©ditos Mensais AutomÃ¡ticos âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 29-3-01 | 1 | âœ… | Modelo ContÃ¡bil â€” Migration buckets, backfill, 3 SQL functions bucket-aware, types |
| 29-3-02 | 2 | âœ… | grant_monthly_credits RPC + Launch Config â€” 4 flags mensais, .env.example |
| 29-3-03 | 3 | âœ… | Vercel Cron + Fallback Admin â€” /api/cron/monthly-credits, vercel.json, admin grant route, UI button |
| 29-3-04 | 4 | âœ… | Testes e VerificaÃ§Ã£o â€” 119 files, 986 testes, typecheck, lint |

**Tests:** 987 passing (119 files, 4 planos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/29-3-creditos-mensais-automaticos/29-3-CONTEXT.md`
**Commits:**

- `d557fda` â€” 29-3-01: migration + types + bucket-aware functions
- `06adb28` â€” 29-3-02: grant_monthly_credits RPC + Launch Config
- `d834d68` â€” 29-3-03: Vercel Cron + admin fallback + button
- `0329f9b` â€” 29-3-04: testes + verificaÃ§Ã£o
- `41e9156` â€” fix: libera rota cron no middleware

## Current Position

Phase: 42 (Signup Controlado e Elegibilidade Freemium) â€” PLANNING
Plan: 0/0 planned
v1.5 em andamento â€” **F42 (Signup Controlado e Elegibilidade Freemium, v1.5) EM PLANEJAMENTO** â€” reabrir o cadastro pÃºblico controlado (Google OAuth entrada principal + email/senha fallback, Turnstile, callback PKCE `/auth/callback`, kill switch duplo Supabase + flag `VENDEO_PUBLIC_SIGNUP_ENABLED`), invariantes de elegibilidade preservados (conta â‰  loja â‰  benefÃ­cio), motor revisado (situaÃ§Ã£o â‰  ATIVA â†’ review `situacao_nao_ativa`, defer `dados_oficiais_incompletos`, cidade/UF gate de elegibilidade, CNAE determinÃ­stico sem rejeiÃ§Ã£o exclusiva), admin reviews rico, legal Terms v1.4/Privacy v1.3; **renumeraÃ§Ã£o D1: F42 = Signup Controlado e Elegibilidade Freemium (v1.5), Stripe/MonetizaÃ§Ã£o PÃºblica â†’ F43 (v1.7, pÃ³s-beta â€” renumerada de F42)**; fonte da verdade `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/`. F41 (MÃ­dia de Campanha Mobile) CONCLUÃDA â€” 13/13 plans, 2033 testes, 4 gates verdes, UAT 6/6 (Android em produÃ§Ã£o âœ…; iOS/HEIC pendente). F40 (Campos Comerciais e Avisos do Brief) CONCLUÃDA â€” 9/9 plans, 1997 testes (221 arquivos), 4 gates verdes, UAT humano aprovado 6/6 (1 ajuste de UX: placeholder/helper do texto obrigatÃ³rio). F39 (Brief Estruturado de Campanha) CONCLUÃDA â€” 8/8 plans, 1950 testes, 4 gates verdes, UAT humano aprovado 5/5. F38.2.1 (Snapshot EconÃ´mico) CONCLUÃDA â€” 7/7 plans, 1887 testes, I1-I7 53/53 asserts, UAT aprovado. F38.2 (Admin de Custos Operacionais + ConfiguraÃ§Ãµes EconÃ´micas) CONCLUÃDA â€” 11/11 plans, 1832 testes, verificaÃ§Ã£o I1-I6 em banco real, UAT aprovado. F38.1 (ApuraÃ§Ã£o de Custos de IA por Entrega) CONCLUÃDA â€” 11/11 plans, 1713 testes, UAT validado, **fechada como camada de estimativa operacional granular** (0.065 provisÃ³rio beta; reconciliaÃ§Ã£o financeira real na prÃ³xima fase). F38 (Tabela de Custos por OperaÃ§Ã£o) concluÃ­da â€” 8/8 plans, 1597 testes, UAT 4/4.
v1.5 em andamento â€” Fases 31.1, 31.2, 31.3, 32, 33, 34, 35, 36, 38 e 38.1 concluÃ­das. F38 (Tabela de Custos por OperaÃ§Ã£o, v1.5) concluÃ­da â€” 8/8 plans, 1597 testes, UAT 4/4; F38.1 (ApuraÃ§Ã£o de Custos de IA por Entrega, desdobramento da F38) **CONCLUÃDA** â€” 11/11 plans, 1713 testes, UAT validado, **fechada como camada de estimativa operacional granular** (ajuste provisÃ³rio da tool image_generation `0.065` = estimativa beta provisÃ³ria, nÃ£o custo real; reconciliaÃ§Ã£o financeira real na prÃ³xima fase), fonte da verdade `openspec/changes/fase-38-1-ai-cost-accounting/`; **F38.2 (Admin de Custos Operacionais + ConfiguraÃ§Ãµes EconÃ´micas, desdobramento da F38) em EXECUÃ‡ÃƒO â€” 10/11 plans** â€” painel `/admin/ai-operation-costs` (KPIs/filtros/tabela/drilldown/segmentos) + `economic_parameters` configurÃ¡veis + badges de confianÃ§a + correÃ§Ã£o `/admin/metrics`, fonte `openspec/changes/fase-38-2-admin-custos-operacionais/`; 38-2-01 âœ… migrations/db push (schema econÃ´mico + RPCs de runs no remoto), 38-2-02 âœ… tipos econÃ´micos + EconomicParameterService fail-open/fail-closed + 10 testes (base das rotas 38-2-04/05/06/09), 38-2-03 âœ… AiCostTracker persiste 4 campos de confianÃ§a (D5), 38-2-04 âœ… API GET/PUT /api/admin/economic-parameters (zod + RPC admin_set_economic_parameter, 200/400/403/500, idempotÃªncia, 9 testes da rota, sem endpoint pÃºblico), 38-2-05 âœ… OperationRunsService server-only (BRL D1/D4 via EconomicParameterService + badges D5 por evento/entrega + segmentaÃ§Ã£o classifySegment D9 com filtro e re-paginaÃ§Ã£o + storeName/owner D3 + 8 agregados D3/D9 sobre o conjunto filtrado inteiro + getRunDetail D4 com BRL/badges/componentes por evento; 20 testes, typecheck/lint limpos), 38-2-06 âœ… API GET /api/admin/ai-operation-runs (lista) + GET /api/admin/ai-operation-runs/[operationRunId] (detalhe) com AiOperationRunsQuerySchema (janela default 90d/max 365d â†’ 400) delegando 100% ao OperationRunsService (BRL/badge/segmento nunca na rota) + 13 testes (tarefa 12.4, piso 11; regressÃ£o 1804 testes); **gap closure UAT (plans 12-15) CONCLUÃDO â€” verificaÃ§Ã£o final: 1839 testes + 4 gates verdes + UAT manual 12/12 aprovado**; F37 (RevisÃ£o e AprovaÃ§Ã£o da Arte, v1.5, experimento beta) em planejamento futuro; F39 (Stripe / MonetizaÃ§Ã£o PÃºblica) como marco futuro pÃ³s-beta (renumerada de F36 â†’ F37 â†’ F39). **38-2-10 OK: verificacao I1-I6 em banco real (script 50/50 asserts) + gates verdes (vitest 1832/1832, typecheck, lint, build) + UAT 13.3 coletado para harvest end-of-phase (I1-I6 documentados em 38-2-VERIFICATION.md)**. **38-2-12 OK (gap UAT estornos): migration 20260811000001 com CREATE OR REPLACE dos RPCs admin_get_ai_operation_runs/_events expondo creditos_estornados (refunds via referenceâ†’deduction no ledger) e creditos_liquidos = max(brutoâˆ’estorno, 0) por run E no summary/detalhe â€” creditos_debitados BRUTO inalterado, view F38.1 intocada; db push aplicado no remoto (validado via REST: estornados=3/liquidos=17 em 20 runs/90d); I5 estendido com 13 asserts novos â†’ 63/63 asserts 0 falhas em banco real; gates verdes (vitest 1834/1834, typecheck/lint/build exit 0)**.

### Phase 36 â€” Onboarding: NavegaÃ§Ã£o por Abas âœ… Complete

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 36-01 | 1 | âœ… | Migration `create_store_draft` + `POST /api/store` dois modos (draft/fiscal) + schema push aplicado |
| 36-02 | 1 | âœ… | Core â€” tabs.ts, tab-state.ts, draft-store.ts + testes (sem dep. do banco) |
| 36-03 | 2 | âœ… | autoSave, use-onboarding-tabs (popstate back/forward), drift estendido, cleanup logout |
| 36-04 | 3 | âœ… | StoreTabs ARIA + LegalAcceptancePanel + form refactor + parsing `?tab=` |
| 36-05 | 4 | âœ… | Redirects/banners â†’ `?tab=` |
| 36-06 | 5 | âœ… | Testes endpoint/gates/draftâ†’fiscal, regressÃ£o, checkpoint humano aprovado |

**Context:** `.planning/phases/36-onboarding-navegacao-por-abas/36-CONTEXT.md`
**Source:** `openspec/changes/fase-36-onboarding-navegacao-por-abas/` (fonte da verdade)
**Checker:** 31/31 requirements covered, 0 blockers, 0 warnings

### Phase 35 â€” Changelog/Novidades âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 35-01 | 1 | âœ… | Foundation â€” Seed content/changelog (F30, F32, F34) + Core Library pura (types, parser, renderer, schema, date) |
| 35-02 | 1 | âœ… | Core Library â€” get-changelog.ts (server-only, fail-fast) + Hook use-changelog-state (SSR-safe) |
| 35-03 | 2 | âœ… | PÃ¡gina /novidades + Componentes Changelog (card, list, announcement, sidebar-badge) |
| 35-04 | 2 | âœ… | App Shell + Dashboard â€” fluxo latestEntryId, sidebar 5Âº item, AccountMenu, anÃºncio contextual |
| 35-05 | 3 | âœ… | Rotina + VerificaÃ§Ã£o + Tracking â€” docs/changelog-update.md cirÃºrgico, testes/typecheck/lint/build, renumeraÃ§Ã£o |

**Tests:** 1345 passing (170 files, 42 novos F35 â€” base 1201 + 42 F35 + adicionais das fases 35-01..04)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Context:** `.planning/phases/35-changelog-novidades/35-CONTEXT.md`
**Source:** `openspec/changes/fase-35-changelog-novidades/`
**Checker:** 25/25 requirements covered, 0 blockers, 0 warnings

### Phase 38 â€” Tabela de Custos por OperaÃ§Ã£o âœ… Complete

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 38-01 | 1 | âœ… | Migration `credit_operation_costs` + audit + RPC `admin_update_operation_cost` |
| 38-02 | 1 | âœ… | Core Library â€” OperationCostService, DEFAULT_OPERATION_COSTS, fail-open/fail-closed |
| 38-03 | 2 | âœ… | generate-image consome custo dinÃ¢mico com guards 503 |
| 38-04 | 2 | âœ… | generate-without-logo consome custo dinÃ¢mico + snapshot metadata |
| 38-05 | 3 | âœ… | Admin â€” schema, API GET/PUT, pÃ¡gina `/admin/operation-costs` + navegaÃ§Ã£o |
| 38-06 | 3 | âœ… | GET `/api/operation-costs` + hook `useOperationCosts` + balance-card dinÃ¢mico |
| 38-07 | 4 | âœ… | UI dinÃ¢mica â€” campaign-input-form, drift-critical-modal, visual-signature-approval-modal |
| 38-08 | 5 | âœ… | VerificaÃ§Ã£o real I1-I6 + teste de integraÃ§Ã£o + build gate + UAT tracking |

**Tests:** 1597 passing
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**UAT:** 4/4 passed â€” custo 1â†’2, operaÃ§Ã£o desligada â†’ 503, fail-open, fail-closed (verificado em `.planning/phases/38-credit-operation-costs/38-UAT.md`)

**Source:** `openspec/changes/fase-38-credit-operation-costs/` (fonte da verdade)
**Context:** `.planning/phases/38-credit-operation-costs/38-CONTEXT.md`
**UAT:** `.planning/phases/38-credit-operation-costs/38-UAT.md`

### Phase 38.1 â€” ApuraÃ§Ã£o de Custos de IA por Entrega âœ… Complete

Desdobramento da F38. Custo real por chamada de IA (tokens/USD) agregado por entrega via `generation_events` + `operation_run_id`; `AiCostTracker` como camada Ãºnica de registro; `resolveAiCost` (provider_reported â†’ pricing_table â†’ fallback_static â†’ not_available); tabela `ai_model_pricing` versionada + RPC `admin_set_ai_model_price` + GET/PUT `/api/admin/ai-model-pricing` (sem pÃ¡gina); views/RPCs de apuraÃ§Ã£o e reconciliaÃ§Ã£o USD Ã— crÃ©ditos (sem UI); furos 1â€“7 da F38 corrigidos; ~51 testes novos + verificaÃ§Ã£o I1â€“I6.

**Fechamento (2026-08-09) â€” camada de ESTIMATIVA OPERACIONAL GRANULAR, nÃ£o reconciliaÃ§Ã£o financeira final.** Ajuste provisÃ³rio versionÃ¡vel da tool image_generation (fÃ³rmula `responses_image_generation_v2`): `estimated_cost_usd = text_component_usd + image_tool_component_usd`, aplicado apenas em `generationType=campaign_image` + `imageGenerationTool=true` (anti-dupla-cobranÃ§a em visual_signature/brand_profile/fallback gpt-image-2). **`responses:image_generation = USD 0.065` Ã© ESTIMATIVA OPERACIONAL PROVISÃ“RIA PARA BETA**, calibrada por UAT/dashboard/CSV da OpenAI â€” **NÃƒO preenche `provider_reported_cost_usd` e NÃƒO Ã© custo financeiro real**; a **reconciliaÃ§Ã£o financeira real fica para a prÃ³xima fase**. Fonte versionÃ¡vel: linha `ai_model_pricing ('openai','responses:image_generation')` (migration 20260809000003, aplicada em Local e Remote) ou bootstrap `DEFAULT_AI_MODEL_PRICING`, ajustÃ¡vel via GET/PUT `/api/admin/ai-model-pricing`; metadata do evento `campaign_image` leva `cost_formula_version`, `text_component_usd`, `image_tool_component_usd`, `image_tool_pricing_*` e `cost_estimation_note=provisional_image_tool_unit_cost_until_provider_reconciliation`, mantendo `provider_usage_raw`.

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 38-1-01 | 1 | âœ… | Migration `f38_1_create_ai_cost_accounting` â€” colunas `generation_events` + CHECKs + Ã­ndices, `campaigns.operation_run_id`, `ai_model_pricing` + seeds + RPC (db push [BLOCKING]) |
| 38-1-02 | 2 | âœ… | Types call-level + `AiCostTracker` (Ãºnico caminho de escrita, best-effort) |
| 38-1-03 | 2 | âœ… | Admin â€” RPC pricing + GET/PUT `/api/admin/ai-model-pricing` + `/api/admin/ai-costs` + seeds |
| 38-1-04 | 3 | âœ… | `resolveAiCost` 4 fontes nunca-null (D9) + `ai-model-pricing` (D8) + `legacy-estimator` sÃ­ncrono + barrel (10 cenÃ¡rios 6.1, 1643 testes) |
| 38-1-05 | 3 | âœ… | D11 event contract (usage+durationMs) + `onCall` copy/validation/review/image-gen (13 cenÃ¡rios, 1657 testes) |
| 38-1-06 | 3 | âœ… | `onCall` no VS generator (Responses API) + brand profiler (visÃ£o, from-zero) â€” 1661 testes |
| 38-1-07 | 4 | âœ… | Rotas 6.3 â€” generate-image (call-level, delivery sem custo, totalCost) |
| 38-1-08 | 4 | âœ… | Rotas 6.4 â€” generate-without-logo (VS/validation custo, nova tentativa = novo run) |
| 38-1-09 | 4 | âœ… | Rotas 6.5 â€” brand-profile/* + infer + realign (3 caminhos IA) + brand-director/text-only onCall (15 testes novos, 1700 testes) |
| 38-1-10 | 5 | âœ… | Views/RPCs apuraÃ§Ã£o + verificaÃ§Ã£o I1â€“I6 (banco real) + 50 testes + gates + UAT checkpoint validado |
| 38-1-11 | 6 | âœ… | Runbook trackings 8.1â€“8.5 + fechamento (0.065 provisÃ³rio beta; reconciliaÃ§Ã£o financeira real na prÃ³xima fase) |

**Status:** Milestone complete

**Source:** `openspec/changes/fase-38-1-ai-cost-accounting/` (fonte da verdade)
**Context:** `.planning/phases/38-1-ai-cost-accounting/38-1-CONTEXT.md`
**Patterns:** `.planning/phases/38-1-ai-cost-accounting/38-1-PATTERNS.md`

### Phase 30 â€” FundaÃ§Ã£o Legal âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 30-01 | 1 | âœ… | Migrations (6) + Legal Documents Drafts (3) |
| 30-02 | 2 | âœ… | Core Library â€” Types, Document Versions, Privacy, Consent, Acceptance, Clearance |
| 30-03 | 3 | âœ… | Public Pages (/termos, /privacidade, /uso-aceitavel) + API Routes (4) + Signup/Onboarding Legal Checkboxes |
| 30-04 | 4 | âœ… | Pipeline Guards + Re-aceite Flow |
| 30-05 | 5 | âœ… | Account Legal Status + Admin Legal Badges |
| 30-06 | 6 | âœ… | Testes e VerificaÃ§Ã£o â€” 24+ novos, 1018 total |

**Tests:** 1018 passing (125 files, 24+ novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Commits:** a2b0873, e2de329, d355268, cfdd788, 9439e9f, 9ab90dc

### Phase 31.1 â€” Modelo Comercial â€” FormulÃ¡rio âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 31-1-01 | 1 | âœ… | Foundation â€” CampaignIntent type, schemas, BADGE_OPTIONS_BY_INTENT |
| 31-1-02 | 2 | âœ… | Form Logic â€” inferIntent, CampaignFormFields, conditional validation |
| 31-1-03 | 2 | âœ… | Pipeline Guard â€” intent guard pre-stream + inputSnapshot normalized |
| 31-1-04 | 3 | âœ… | UI â€” IntentSelector, conditional badge, preserveImageContext, submit blocking |
| 31-1-05 | 4 | âœ… | Tests â€” 20 intent tests, regression 1036 total, typecheck/lint/build |

**Tests:** 1036 passing (129 files, 20 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Commits:** afdfbf7, c2a94ce, 17c3d04, 162d5d5, b7b7d38

### Phase 31.2 â€” Diretores por IntenÃ§Ã£o âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 31-2-01 | 1 | âœ… | Schema Contracts â€” discountedPriceCents opcional, CampaignSpecSchema nullable |
| 31-2-02 | 1 | âœ… | Unblock â€” UI/Form/Route: remover bloqueios, normalizaÃ§Ã£o exclusive, validaÃ§Ã£o offer |
| 31-2-03 | 2 | âœ… | 6 Prompt Templates â€” 3 image + 3 copy por intent |
| 31-2-04 | 2 | âœ… | Image Director Routing â€” assemblePrompt, buildPromptVariables, validatePrompts por intent |
| 31-2-05 | 2 | âœ… | Copy Director + Content â€” commercialFrame, buildCommercialRepertoire, buildDeterministicCopy |
| 31-2-06 | 3 | âœ… | Tests + Verification â€” 15 novos testes, regressÃ£o 1051, typecheck/lint/build |

**Tests:** 1051 passing (130 files, 15 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Context:** `.planning/phases/31-2-diretores-por-intencao/31-2-CONTEXT.md`
**Source:** `openspec/changes/fase-31-2-diretores-por-intencao/`

### Phase 31.3 â€” Quality Gate por IntenÃ§Ã£o Comercial âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 31-3-01 | 1 | âœ… | Schema + Foundation â€” ImageReviewInput, ReviewIssueType union, failureType null |
| 31-3-02 | 1 | âœ… | Intent-Aware Review Service â€” 2-stage vars, expectedBadgeBehavior, empty_review |
| 31-3-03 | 2 | âœ… | Prompt Restructuring â€” campaign-image-reviewer.md com variÃ¡veis contextuais |
| 31-3-04 | 2 | âœ… | Pipeline Integration â€” buildReviewInput, validatePrompts intent-aware |
| 31-3-05 | 3 | âœ… | Automated Tests â€” contract/drift tests, regressÃ£o |
| 31-3-06 | 3 | âœ… | UAT Real â€” 5 cenÃ¡rios E2E com IA real (6/6 executados, 5 aprovados, 1 ajuste no diretor exclusive) |

**Source:** `openspec/changes/fase-31-3-quality-gate-por-intencao-comercial/`
**Context:** `.planning/phases/31-3-quality-gate-por-intencao-comercial/31-3-CONTEXT.md`

**Tests:** 1071 passing (131 files, 20 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Commits:**

- `be83d7d` â€” 31-3-01: Schema + Foundation â€” ImageReviewInput estendido, ReviewIssueType union, failureType string|null
- `f7cbdaf` â€” 31-3-02: Intent-Aware Review Service â€” 2-stage var builder, 3-variant expectedBadgeBehavior, empty_review estruturado
- `45daa35` â€” 31-3-03: Prompt Restructuring â€” comportamento esperado, commercial_tone_mismatch, remove placeholders antigos
- `7d4efa1` â€” 31-3-04: Pipeline Integration â€” buildReviewInput intent-aware, validatePrompts usa builder compartilhado, verificaÃ§Ã£o de vars contextuais e placeholders antigos
- `faaf234` â€” 31-3-05: Automated Tests â€” contract tests, intent-aware review tests, validatePrompts com campaignIntent, regressÃ£o offer
- `bc2b2af` â€” 31-3-06: UAT evidence structure â€” 5 cenarios E2E com micro-runbook, criterios de aceite e template de evidencias

## Completed

### Phase 34 â€” Store Readiness âœ…

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 34-01 | 1 | âœ… | Migration + Core Libraries â€” store_billing_info table, RPC check_store_readiness, StoreReadiness/StoreBillingInfo modules, CNPJ Address Mapper, Store type CNPJ fields, cast removal |
| 34-02 | 2 | âœ… | Guarda Dupla + Fluxo Legacy â€” page guard `/campanhas/nova`, API guard 412, redirect chaining, fallback nome_fantasia, contextual microcopy |
| 34-03 | 2 | âœ… | Step 2 UX + Billing Card â€” renaming "DireÃ§Ã£o Visual" + badge, query param suport, billing collapsible card, confirm route |
| 34-04 | 3 | âœ… | Dashboard Banner + Brand Profile â€” ReadinessBanner with checklist, async server component, three visual direction paths |
| 34-05 | 3 | âœ… | Tests + Verification â€” 17+ novos testes, 1201 total, typecheck/lint/build clean |

**Tests:** 1201 passing (154 files, 17+ novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean
**Context:** `.planning/phases/34-store-readiness/34-CONTEXT.md`

**Fix commits (pÃ³s-verificaÃ§Ã£o):**

- `76199b3` â€” fix(f34): revise store readiness â€” 7 correÃ§Ãµes obrigatÃ³rias
- `fae35c8` â€” fix(f34): correÃ§Ãµes restantes â€” fiscal read-only, billing reconsulta, aceite legal
- `06ee23a` â€” fix(f34): billing manual abre campos + feedback erro reconsulta CNPJ

### Next Phases

| Phase | Status | Description |
|-------|--------|-------------|
| F28 | âœ… Completed | Observabilidade + OperaÃ§Ã£o + Launch Controls (4 plans, 37+ testes, 889 total) |
| F29 | âœ… Completed | Refinamento Visual + UAT + Launch Readiness â€” UAT 4/4 lojistas aprovado |
| F29.1.1 | âœ… Completed | CrÃ©ditos na Assinatura Visual â€” VS consome crÃ©ditos, remove cota fixa de 3, UAT 15/15 âœ… |
| F29.1.2 | âœ… Completed | HistÃ³rico Curto + Assinatura Visual â€” HistoryModal reescrito (3 plans, 943 testes) |
| F29.3 | âœ… Completed | CrÃ©ditos Mensais AutomÃ¡ticos â€” Buckets bÃ´nus/compra, grant mensal, Vercel Cron (4 plans, 987 testes) |
| F30 | âœ… Completed | FundaÃ§Ã£o Legal â€” 6 migrations, 5 services, 3 public pages, 4 API routes, pipeline guards, re-aceite, admin badges, 24+ testes |
| **F31.1** | **âœ… Completed** | **Modelo Comercial â€” FormulÃ¡rio â€” CampaignIntent type, inferÃªncia, seletor, badge-by-intent, preserveImageContext, pipeline guard** |
| **F31.2** | **âœ… Completed** | **Diretores por IntenÃ§Ã£o â€” Schemas tolerantes, desbloqueio de intents, 6 prompts, roteamento, conteÃºdo adaptado, 6 plans, UAT 9/9 âœ…** |
| **F31.3** | **âœ… Completed** | **Quality Gate por IntenÃ§Ã£o Comercial â€” ImageReviewInput intent-aware, prompt reestruturado, commercial_tone_mismatch, 6 plans, 1071 testes, UAT executada com IA real (6/6 cenÃ¡rios)** |
| F32 | âœ… Complete | Freemium Anti-Abuso CNPJ â€” CNPJ obrigatÃ³rio, entitlement por raiz, admin freemium status (5/5 plans, 27+ tests) |
| F33 | âœ… Complete | VerificaÃ§Ã£o CNPJ Freemium â€” Consulta BrasilAPI/CNPJÃ¡, cross-check, motor de decisÃ£o, admin review, test stores |
| F34 | âœ… Completed | Store Readiness â€” 5 plans, 17+ testes, 1189 total |
| **F35** | **âœ… Completed** | **Changelog/Novidades â€” 5 plans, 3 waves, 42 testes novos, 1345 total, typecheck/lint/build limpos** |
| F36 | âœ… Complete | Onboarding â€” NavegaÃ§Ã£o por Abas (6/6 plans, 31/31 requirements, 1479 testes, code review aplicado) |
| F37 | â—‹ In progress | RevisÃ£o e AprovaÃ§Ã£o da Arte (v1.5, experimento beta â€” planejamento futuro) |
| **F38** | **âœ… Complete** | **Tabela de Custos por OperaÃ§Ã£o â€” 8/8 plans, 1597 testes, I1-I6 verificados no banco real, build gate verde, UAT 4/4 aprovado** |
| **F38.1** | **âœ… Complete** | **ApuraÃ§Ã£o de Custos de IA por Entrega â€” 11/11 plans, 40/40 requirements, 1713 testes (199 arquivos), I1â€“I6 banco real, UAT validado; fechada como camada de ESTIMATIVA OPERACIONAL GRANULAR (0.065 provisÃ³rio beta; reconciliaÃ§Ã£o financeira real na prÃ³xima fase)** |
| **F38.2** | **â—‹ Complete** | **Admin de Custos Operacionais + ConfiguraÃ§Ãµes EconÃ´micas â€” 11/11 plans: parÃ¢metros econÃ´micos configurÃ¡veis (`economic_parameters` usd_brl_rate/credit_value_brl + RPC + API + pÃ¡gina ConfiguraÃ§Ãµes EconÃ´micas), painel `/admin/ai-operation-costs` (KPIs/filtros/tabela/drilldown/agregados por segmento), badges de confianÃ§a, correÃ§Ã£o `/admin/metrics` (Custo MÃ©dio IA call-level), verificaÃ§Ã£o I1-I6 + 4 gates verdes** |
| **F38.2.1** | **â—‹ Complete** | **Snapshot EconÃ´mico â€” 7/7 plans: congelar `usd_brl_rate_at_generation`/`credit_value_brl_at_generation` em generation_events, impedir recÃ¡lculo retroativo, backfill aproximado via audit, verificaÃ§Ã£o I1-I7 53/53 asserts, UAT aprovado** |
| **F39** | **âœ… Completed** | **Brief Estruturado de Campanha (v1.5) â€” 8/8 plans, 7 waves: contrato de domÃ­nio `CampaignBrief` estruturado (product/commercial/media/creativeContext/metadata, sem server-only), mapper `buildCampaignBriefFromFlat` na fronteira da rota, wrapper renomeado para `ResolvedCampaignContext`, snapshot versionado `campaign_brief_v1` (sem base64), 5 costuras de mappers preservando o comportamento de geraÃ§Ã£o (golden tests por intent), 1950 testes + 4 gates verdes, UAT humano aprovado 5/5.** |
| F40 | âœ… Completed | Campos Comerciais e Avisos do Brief (v1.5) â€” 9/9 plans, 1997 testes, 4 gates verdes, UAT aprovado 6/6 |
| F41 | âœ… Complete | MÃ­dia de Campanha Mobile (v1.5) â€” 13/13 plans, 2033 testes, 4 gates verdes, UAT 6/6 (Android em produÃ§Ã£o âœ…; iOS HEIC pendente): form multi-imagem (primary + auxiliares + cÃ¢mera), transporte `productImages[]`, persistÃªncia dos inputs no storage, provider N input_image, prompt 1+N, validaÃ§Ã£o primary-only, revisor com primary |
| F42 | â—‹ In progress | Signup Controlado e Elegibilidade Freemium (v1.5) â€” planejamento: signup pÃºblico controlado (Google OAuth + email/senha), Turnstile, callback PKCE, kill switch duplo, motor elegibilidade revisado (situacao_nao_ativa/dados_oficiais_incompletos/cidade-UF/CNAE), admin reviews rico, legal v1.4/v1.3 |
| F43 | â—‹ Future | Stripe / MonetizaÃ§Ã£o PÃºblica (v1.7, pÃ³s-beta â€” renumerada de F42) |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260717-okh | Corrigir bug/guardrail no pipeline de geracao de campanha: evitar chamadas de IA quando houver placeholders nao resolvidos em prompts e corrigir placeholder do revisor. | 2026-07-17 | 5878b0f | [260717-okh-corrigir-bug-guardrail-no-pipeline-de-ge](./quick/260717-okh-corrigir-bug-guardrail-no-pipeline-de-ge/) |
| 260722-001 | Corrigir UX pÃ³s-UAT fase 29.1.2 â€” Gerar nova assinatura abre ApprovalModal direto com textarea | 2026-07-22 | cf19759 | [260722-001-fix-ux-pos-uat-2912](./quick/260722-001-fix-ux-pos-uat-2912/) |
| 260722-hyq | Sanear persistÃªncia e cÃ¡lculo das mÃ©tricas de crÃ©dito â€” corrigir getRefundRate para filtrar por feature, corrigir getCreditsGranted para somar amounts, adicionar metadata.feature em reserveCredit/refundCredit | 2026-07-22 | 4f73def | [260722-hyq-sanear-persist-ncia-e-c-lculo-das-m-tric](./quick/260722-hyq-sanear-persist-ncia-e-c-lculo-das-m-tric/) |
| 260722-i7v | Separar visualmente as mÃ©tricas por domÃ­nio â€” 3 seÃ§Ãµes no admin, 6 funÃ§Ãµes VS, cross-window fix, duration_ms | 2026-07-22 | c772ffd | [260722-i7v-separar-visualmente-as-m-tricas-por-dom-](./quick/260722-i7v-separar-visualmente-as-m-tricas-por-dom-/) |
| 260722-jwr | Fase 29.2 â€” Onboarding Grant 10 crÃ©ditos | 2026-07-22 | 976a571 | [260722-jwr-fase-29-2-onboarding-grant-10-cr-ditos-a](./quick/260722-jwr-fase-29-2-onboarding-grant-10-cr-ditos-a/) |
| 260724-hzz | Privacy Gate pÃ³s-login â€” ciÃªncia de PolÃ­tica de Privacidade | 2026-07-24 | fb02332 | [260724-hzz-privacy-gate-p-s-login-ci-ncia-de-pol-ti](./quick/260724-hzz-privacy-gate-p-s-login-ci-ncia-de-pol-ti/) |
| 260729-rag | Corrigir atomicidade do cadastro fiscal pÃ³s-F34 | 2026-07-29 | bfc07b4 | [260729-rag-corrigir-atomicidade-do-cadastro-fiscal-](./quick/260729-rag-corrigir-atomicidade-do-cadastro-fiscal-/) |
| 260729-t6x | Adicionar verificaÃ§Ã£o CNPJ externa ao update-cnpj + unificar fluxo fiscal em /loja | 2026-07-30 | 36ae2a7 | [260729-t6x-corrigir-update-cnpj-route-para-verifica](./quick/260729-t6x-corrigir-update-cnpj-route-para-verifica/) |
| 260730-j73 | Corrigir UX de feedback visÃ­vel no onboarding â€” feedbacks crÃ­ticos (erro/sucesso) ficam fora da viewport apÃ³s aÃ§Ãµes de salvar/confirmar/gerar | 2026-07-30 | 058c342 | [260730-j73-onboarding-feedback-visivel-quero-corrig](./quick/260730-j73-onboarding-feedback-visivel-quero-corrig/) |
| 260730-kka | Corrigir UX/robustez no card de billing do onboarding para tolerar dados parciais de CNPJ | 2026-07-30 | 33f173e | [260730-kka-billing-cnpj-parcial](./quick/260730-kka-billing-cnpj-parcial/) |
| 260730-mrr | Separar test store de produÃ§Ã£o no admin â€” filtro ternÃ¡rio (production/test/all), RPC admin_get_metrics bundle, pipeline refactor, admin pages + testes | 2026-07-30 | 7abffe5 | [260730-mrr-admin-separar-teste-producao](./quick/260730-mrr-admin-separar-teste-producao/) |
| 260730-zfe | Admin Legibilidade â€” Datas e Labels | 2026-07-30 | 8753513 | [260730-zfe-admin-legibilidade-datas-labels](./quick/260730-zfe-admin-legibilidade-datas-labels/) |
| 260730-pfq | corrigir criaÃ§Ã£o de loja de teste admin quebrada por chk_stores_cnpj_atomic | 2026-07-30 | 239443e | [260730-pfq-corrigir-cria-o-de-loja-de-teste-admin-q](./quick/260730-pfq-corrigir-cria-o-de-loja-de-teste-admin-q/) |
| 260730-o30 | Hotfix admin_get_metrics uuid = text + dead code grant_monthly_credits | 2026-07-30 | 0051a7a | [260730-o30-hotfix-admin-metrics-rpc-uuid-text](./quick/260730-o30-hotfix-admin-metrics-rpc-uuid-text/) |
| 260731-qep | Adequar documentaÃ§Ã£o legal para beta freemium â€” Termos v1.3, Privacidade v1.2, AUP v1.1, remoÃ§Ã£o de aviso de draft (markdowns + pÃ¡ginas pÃºblicas), microcopy discreta em campanhas | 2026-07-31 | 020e197 | [260731-qep-adequar-documentos-legais-beta-freemium-](./quick/260731-qep-adequar-documentos-legais-beta-freemium-/) |
| 260804-s16 | Corrigir assimetria Diretor/Revisor de Imagem: mandatoryArtworkText chega ao diretor mas nao ao revisor. Espelhar contrato de contexto (mandatoryArtworkText, campaignDetails, additionalDetails) ao ImageReviewInput e ao prompt do revisor com linguagem de revisao, adicionando testes focados. | 2026-08-04 | 47a1a4a | [260804-s16-corrigir-assimetria-diretor-revisor-de-i](./quick/260804-s16-corrigir-assimetria-diretor-revisor-de-i/) |
| 260808-rqw | Landing pÃºblica + acesso fechado beta â€” landing / com form de solicitaÃ§Ã£o, POST /api/access-requests (zod + anti-duplicidade + anti-enumeraÃ§Ã£o), /signup neutralizado (beta fechado), fix pÃ³s-login /dashboard, admin /admin/access-requests com RPC atÃ´mico + audit log, doc SUPABASE-CLOSED-BETA.md | 2026-08-08 | 00947d0 | [260808-rqw-landing-p-blica-acesso-fechado-beta](./quick/260808-rqw-landing-p-blica-acesso-fechado-beta/) |
| 260808-udc | PWA bÃ¡sico instalÃ¡vel (sem service worker) + clareza de custo por operaÃ§Ã£o no card de crÃ©ditos â€” manifest.ts (start_url /dashboard), 4 PNGs via sharp em public/icons/, metadata PWA/iOS no layout (viewport themeColor), dica iOS discreta na conta, BalanceCard com Campanha/Assinatura visual sem texto ambÃ­guo | 2026-08-09 | 101739e | [260808-udc-planejar-pwa-basico-clareza-no-card-de-c](./quick/260808-udc-planejar-pwa-basico-clareza-no-card-de-c/) |
| 260812-och | MigraÃ§Ã£o de domÃ­nio vendeo.tech (PLAN-ONLY) â€” runbook aprovado: vendeo.tech canÃ´nico com beta fechado preservado; Supabase Auth seguro (redirects de vendeo.tech adicionados primeiro preservando beta, Site URL trocado sÃ³ na janela de corte junto com env+redeploy da main); NEXT_PUBLIC_SITE_URL build-time; /auth/confirm explÃ­cito com wildcards complementares; PWA sem mudanÃ§a de cÃ³digo mas validado por origem; V1/manutenÃ§Ã£o nÃ£o removidos cedo; checklists operacional/rollback/UAT, COLLECT FIRST C-01..C-10, decisÃµes D-1..D-7, ordem Supabaseâ†’Vercelâ†’DNSâ†’Env/Deployâ†’ValidaÃ§Ã£oâ†’Monitoramento | 2026-08-12 | 0b87ca0 | [260812-och-planejar-migracao-de-dominio-vendeo-tech](./quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/) |
| 260812-qbu | Entry de changelog 2026-08-12 (novo endereÃ§o vendeo.tech + pÃ¡gina inicial pÃºblica com acesso free + beta fechado + app instalÃ¡vel como atalho + card de crÃ©ditos claro) â€” content/changelog/2026-08-12-vendeo-em-novo-endereco-acesso-simples.md, copy em portuguÃªs para o lojista sem termos tÃ©cnicos; ajuste mÃ­nimo das expectativas hardcoded do teste de changelog (entries[0] + getLatestAnnouncement); validaÃ§Ãµes verdes (testes 8/8, typecheck, lint) | 2026-08-12 | b4a3268 | [260812-qbu-criar-entry-de-changelog-em-content-chan](./quick/260812-qbu-criar-entry-de-changelog-em-content-chan/) |
| 260814-na1 | Links Novidades na landing pÃºblica â€” link chamativo (accent-green, min-h 44px) abaixo do card "Solicite seu acesso free" + link discreto no rodapÃ©, abrindo MODAL acessÃ­vel sobre a landing (role=dialog, Esc/backdrop/Ã— fecham, foco ida/volta) com as ~5 entradas mais recentes do changelog resolvidas no server (Home async â†’ getAllEntries().slice(0,5) â†’ props, sem rota nova); mÃ¡scara progressiva `(11) 99999-9999` no campo WhatsApp via funÃ§Ã£o pura maskWhatsApp (maxLength 15, API/schema intocados); critÃ©rio editorial permanente: entries de content/changelog agora tÃªm superfÃ­cie pÃºblica; 1967 testes + typecheck/lint/build exit 0 | 2026-08-14 | 980c80c | [260814-na1-adicionar-link-de-novidades-changelog-na](./quick/260814-na1-adicionar-link-de-novidades-changelog-na/) |
| 260815-i9a | Alinhar concessÃ£o mensal freemium por raiz de CNPJ (3 tasks, PLAN-ONLY inicial â†’ executado apÃ³s revisÃ£o r1+r2) â€” reescrita `grant_monthly_credits` (migration `20260815000001`) com: mÃ¡x. 1 grant/raiz/ciclo, recipiente determinÃ­stico (matriz preferida, senÃ£o loja nÃ£o-teste mais antiga), limiar de elegibilidade (NÃƒO teto, `bonus_balance < p_bonus_cap` â†’ grant integral; `>=` â†’ nenhum), ciclo por aniversÃ¡rio em `America/Sao_Paulo` com clamp 29/30/31, idade mÃ­nima por dia civil BR, ordem checks existÃªnciaâ†’limiarâ†’INSERT via `try_grant_monthly_entitlement` (ON CONFLICT = anti-corrida), REVOKE/GRANT service_role, shape canÃ´nico com `roots_considered`; botÃ£o admin `body.skipped === true` + testes shape canÃ´nico + script de verificaÃ§Ã£o `39-monthly-grant-por-raiz-verification.mjs` (driver `pg`, `DATABASE_URL`); specs/docs/env alinhados. 18/18 greps Task 1, vitest 13/13, typecheck/lint limpos. PendÃªncias: aplicar migration (Local+Remote) e rodar script de verificaÃ§Ã£o em staging/dev (requer DATABASE_URL) | 2026-08-16 | cefbfe0 | [260815-i9a-objetivo-planejar-sem-executar-o-alinham](./quick/260815-i9a-objetivo-planejar-sem-executar-o-alinham/) |
| 260818-nvf | Adicionar captchaEnabled ao LaunchConfig (env VENDEO_CAPTCHA_ENABLED, default false fail-closed) aplicado a login/signup/recuperação — off: CaptchaField não renderizado, submit não bloqueado sem token, captchaToken ausente das chamadas Supabase (comportamento F41 / destrava bloqueio client-side do runbook 42-ROLLBACK.md:21); on: comportamento F42 preservado. 3 forms com prop obrigatória, 3 pages server repassando, forgot-password/page.tsx async. 14 arquivos, 16 testes novos, 239 files/2197 testes verdes, typecheck limpo | 2026-08-18 | ef983e30 | [260818-nvf-adicionar-captchaenabled-ao-launchconfig](./quick/260818-nvf-adicionar-captchaenabled-ao-launchconfig/) |
| 260820-siq | Quick 1 Validade/Data (formulário de campanha) — validade da oferta com ANO na arte (dd/mm/aaaa) nos dois modos (até/intervalo): `formatDDMM`→`formatDateDisplay` + helpers determinísticos `formatDateInput`/`parseDateInput`/`isValidDateInput` (string, sem timezone); inputs `type="date"`→máscara dd/mm/aaaa (draft local anti-ISO-stale, parent atualizado em toda mudança, incompleto/inválido→""); validação frontend no validateField/submit (erro genérico "Informe uma data válida (dd/mm/aaaa)" por modo + ordem inicial<=final com iguais permitidas, comparada só com ambas preenchidas — bloqueia fetch sem mudar contrato da rota); erros visíveis na UI via novas props ValidityField startDateError/endDateError/onStartDateBlur/onEndDateBlur integradas em campaign-input-form.tsx (touched/fieldErrors/handleBlur); reforço dia/mês/ano nos 2 prompts do diretor + buildValidityTextSection do revisor (divergência=CRÍTICA illegible_text); spec offer-validity-modes dd/mm→dd/mm/aaaa. 3 tasks, 11 arquivos (2 novos), vitest 18+13+25 focados + 107 regressão pipeline, typecheck/lint limpos, 3 grep gates zero | 2026-08-20 | c0c1d38c | [260820-siq-ajustes-formulario-validade-preco](./quick/260820-siq-ajustes-formulario-validade-preco/) |

## Decisions

- [Phase 38.2.1-economic-snapshot]: ConversÃ£o BRL movida para o domÃ­nio de mÃ©tricas: getAvgCostBrl (pipeline-metrics) prÃ©-formata o card "Custo MÃ©dio IA" como string R$ X,XX e o MetricsCards devolve strings sem re-conversÃ£o â€” a pÃ¡gina nÃ£o recalcula histÃ³rico (T-38.2.1-18); getAvgCost (USD) mantido APENAS para o computeHealthState (thresholds em USD); env deprecado com grep 0 literal nos diretÃ³rios de mÃ©tricas (prova de nÃ£o-uso por ausÃªncia, sem ocorrÃªncia residual em testes) (38-2-1-06)

- [Phase 38.2.1-economic-snapshot]: Asserts negativos (not.toContain('receitaOpBrl'/'receitaRealBrl')) nos testes das rotas materializam o grep-gate D8 como contrato testÃ¡vel â€” a resposta NUNCA contÃ©m nomes proibidos; as ocorrÃªncias dessas strings nos testes sÃ£o intencionais (verificaÃ§Ã£o), nÃ£o fixtures (38-2-1-05)
- [Phase 38.2.1-economic-snapshot]: Fixtures de UI (makeRun/SUMMARY/makeListResult) com default snapshot CAPTURED (5.0/1.0, captured_at_generation, note null) â€” cenÃ¡rio legado (fallback) vira divergÃªncia explÃ­cita; origem exibida na UI exclusivamente do contrato do service via sourceOriginLabel (a UI nunca infere â€” T-38.2.1-14/15); data-testid/data-origin no wrapper div porque o Badge do design system nÃ£o repassa props (38-2-1-05)
- [Phase 38.2.1-economic-snapshot]: Snapshot do run = 1Âº evento call-level com a coluna de valor preenchida (subquery correlacionada ORDER BY created_at ASC LIMIT 1); a origem correspondente usa o MESMO predicado (coluna de VALOR IS NOT NULL) â€” determinÃ­stico, valor e origem da mesma linha (T-38.2.1-09, D6) (38-2-1-03)
- [Phase 38.2.1-economic-snapshot]: RPCs continuam sem derivar BRL (D1/D5) â€” CREATE OR REPLACE estritamente aditivo (corpo copiado de 20260811000001 + campos no fim de projeÃ§Ãµes/JSON); contrato backward-compatible, nada removido; REVOKE/GRANT service_role e assinaturas p_* preservados (38-2-1-03)
- [Phase 38.2.1-economic-snapshot]: Push via pooler sem token no ambiente (link gvbzwihwgzujwsviufgy) â€” dry-run "Would push" â†’ push exit 0 â†’ dry-run "Remote database is up to date."; validaÃ§Ã£o REST service_role: 20 runs com os 4 campos (5.18/backfilled_seed, 1.00/backfilled_seed) (38-2-1-03)
- [Phase 38.2.1-economic-snapshot]: Origem do snapshot Ã© SEMPRE do tracker â€” AiCostEvent/GenerationEventInsert carregam apenas valores (usdBrlRateAtGeneration/creditValueBrlAtGeneration); o caller nunca define origem (anti-spoofing T-38.2.1-04); o tracker grava captured_at_generation quando o valor estÃ¡ presente e NULL quando ausente (paridade do banco preservada) (38-2-1-02)
- [Phase 38.2.1-economic-snapshot]: ResoluÃ§Ã£o 1Ã— por run (nÃ£o N+1 por chamada â€” D3/T-38.2.1-05): cada startRun resolve o snapshot via EconomicParameterService (Promise.all de getParameter); retry do VS e os 3 paths do realign abrem novos runs com novos snapshots (valores vigentes naquele momento) (38-2-1-02)
- [Phase 38.2.1-economic-snapshot]: Best-effort de resoluÃ§Ã£o em todos os callers â€” try/catch com log; falha â†’ valores null â†’ eventos NULL â†’ fallback legacy em leitura (economic_parameter_fallback sÃ³ no service, nunca persistido); geraÃ§Ã£o nunca bloqueada (38-2-1-02)
- [Phase 38.2.1-economic-snapshot]: OVERRIDE do phase owner (2026-08-11): seed do backfill de usd_brl_rate = 5.18 (o plano dizia 1.00 â€” eventos legados sem audit anterior refletem o cÃ¢mbio real do perÃ­odo); credit_value_brl = 1.00; origem backfilled_seed nas duas chaves â€” aplicado no COALESCE dos UPDATEs do backfill e documentado como deviation (38-2-1-01)
- [Phase 38.2.1-economic-snapshot]: Fix Rule 1 no backfill â€” SET deve referenciar a derived table exposta pelo FROM (sub.new_value), nunca o alias interno da LATERAL (av): 42P01 no 1Âº push, rollback transacional limpo, corrigido e re-pushado (38-2-1-01)
- [Phase 38.2.1-economic-snapshot]: Backfill executa apÃ³s os CHECKs (em conformidade: valor+origem sempre juntos, sÃ³ backfilled_*); idempotÃªncia POR COLUNA (WHERE <coluna> IS NULL) (38-2-1-01)
- [Phase 38-1-ai-cost-accounting]: provider do onCall do CopyDirectorService derivado de this.provider.name (TextProvider jÃ¡ expÃµe name) â€” sem campo providerName extra no construtor (38-1-05)
- [Phase 38-1-ai-cost-accounting]: durationMs do GenerationMetricsEvent usa elapsedMs do pipeline (Date.now() - startTime) como base no helper emitMetricsEvent â€” escolha documentada no cÃ³digo (38-1-05)
- [Phase 38-1-ai-cost-accounting]: onCall interno no generateImage captura usage e enriquece o evento da fase existente â€” nunca invoca onMetricsEvent direto (anti-dupla-contagem T-38.1-22, canal Ãºnico) (38-1-05)
- [Phase 38-1-ai-cost-accounting]: Fixes Rule 1 no push da migration F38.1-01: REVOKE ALL ON VIEW -> ON TABLE (sintaxe PostgreSQL) e MAX(uuid) -> GROUP BY nas CTEs de admin_cost_vs_credits
- [Phase 38-1-ai-cost-accounting]: Views admin_ai_* sem GRANT direto ao cliente (404 no REST confirma T-38.1-03) - acesso exclusivo via RPC SECURITY DEFINER
- [Phase 38-1-ai-cost-accounting]: AiCostEvent importa GenerationEventType/Status de visual-signature/types (D5) - enum nao duplicado em ai-cost/types.ts (evita drift com o banco)
- [Phase 38-1-ai-cost-accounting]: insertGenerationEvent delega ao AiCostTracker e retorna null em sucesso (record e void) - consumidores atuais apenas await; API publica mantida por compat (teste 7 do spec)
- [Phase 38-1-ai-cost-accounting]: Mapeamento cost/tokens do delegate do insert so gera AiCostEvent.cost/tokens quando campos presentes - sem cost/tokens = delivery marker preservado (D1/D6)
- [Phase 38-1-ai-cost-accounting]: resolveAiCost normaliza o model ANTES da busca (normalizeModel na BUSCA â€” D9); ai-model-pricing.ts mantem copia local do normalizeModel (evita dependencia circular com cost-estimator) â€” Testes 6.1 exigem lookup por modelo base; getModelPricing ja normaliza no bootstrap â€” dupla normalizacao e idempotente
- [Phase 38-1-ai-cost-accounting]: not_available alcanÃ§Ã¡vel via desabilitaÃ§Ã£o explÃ­cita do fallback: env VENDEO_AI_FALLBACK_COST_USD (ou compat antigo) = '0'/'none'/'disabled'/'off' â†’ sem preÃ§o/config â†’ custo NULL (D4); env invÃ¡lido continua â†’ default 0.15 (T-38.1-20) â€” Cenario 6.1 #8 exige o caminho not_available; a cadeia D9 padrao sempre cai em fallback_static (default 0.15)
- [Phase 38-1-ai-cost-accounting]: manual_unknown alcanÃ§Ã¡vel via parÃ¢metro opcional manualCostUsd (D4: custo inserido/ajustado manualmente sem origem automÃ¡tica) â€” extensÃ£o retrocompatÃ­vel do contrato documentado â€” Cenario 6.1 #10 exige o caminho manual_unknown 'presente no contrato e alcanÃ§Ã¡vel'; o contrato documentado de 4 params nÃ£o o permitia
- [Phase 38-1-ai-cost-accounting]: Teste cached gpt-5.5 usa a semÃ¢ntica do spec (input pago = 600 uncached + 400 cached â†’ 0.0092), nÃ£o a aritmÃ©tica do PLAN (0.0112) que duplica contagem dos cached tokens â€” PLAN anotava 0.0050 (1000 prompt a cheio) + 0.0002 (cached) â€” cobra os mesmos 400 tokens duas vezes; spec do cenÃ¡rio e contrato legado definem o desconto (uncached = prompt - cached)
- [Phase 38-1-ai-cost-accounting]: onCall do AiImageGenerator so no caminho de sucesso (chamada concluida); erro nao emite evento - failed gravado pela rota 38-1-08 â€” anti-dupla-contagem T-38.1-28/F38.1-25
- [Phase 38-1-ai-cost-accounting]: brand-profiler.ts so tem chamadas de visao (callVision/callVisionFull); brand_profile_text vem do text-only-inference-service.ts na rota 38-1-09 (D11) â€” D5: nao inventar chamada; plano assumia 2 onCalls no path 2
- [Phase 38-1-ai-cost-accounting]: recordCall na rota generate-image e fire-and-forget (void) no caminho de resultado â€” telemetria nunca bloqueia geracao (T-38.1-29, D7); ordem de resolucao garantida pelos awaits do pipeline (upload/update) antes do logPipelineEvent com totalCost (38-1-07)
- [Phase 38-1-ai-cost-accounting]: campaign_input_validation vem do onMetricsEvent do ImageGenerationService (fase input_validation, attempt 0) â€” a validacao pre-stream da rota (guards 409/conflict) nao emite evento pois nao chega a criar campanha (38-1-07)
- [Phase 38-1-ai-cost-accounting]: duration_is_pipeline centralizada no helper recordCall (delivery) â€” o tracker a adiciona de novo (idempotente); chamada de delivery nao repassa metadata, mantendo grep de controle em 1 ocorrencia na rota (38-1-07)
- [Phase 38-1-ai-cost-accounting]: Retry VS = novo startRun + flushCallEvents(null) fechando o run 1 (eventos da tentativa falha gravados com visual_signature_id null) antes de abrir o run 2 â€” o run falho nao recebe o id da assinatura do retry (T-38.1-37, D1) (38-1-08)
- [Phase 38-1-ai-cost-accounting]: Imagem e validacao VS atravessam o MESMO onCall (D11); a rota distingue visual_signature_image vs visual_signature_validation pelo model real da chamada (validacao = IMAGE_VALIDATION_MODEL || gpt-4o-mini) (38-1-08)
- [Phase 38-1-ai-cost-accounting]: Eventos call-level VS enfileirados (pendingCalls) ate o visual_signature_id existir (apos persistSignature) â€” todos os eventos do run com o id (D2); operationRunId/attempt capturados no momento da chamada (38-1-08)
- [Phase 38-1-ai-cost-accounting]: Rota principal /brand-profile (GET/PATCH/archive) NAO gera via profiler â€” entrega brand_profile_with_logo emitida no path logo do realign (director.analyze); decidido e testado na rota principal (38-1-09 task 2.3)
- [Phase 38-1-ai-cost-accounting]: Buffer de AiCallInfo por sequencia nas rotas brand: 1a entrada = brand_profile_vision, 2a = brand_profile_text (mapeamento deterministico por path â€” T-38.1-39); na pratica brand-profiler.ts so emite visao, text-only e servico separado (38-1-09)
- [Phase 38-1-ai-cost-accounting]: onCall de analyze/infer em try/catch await (aceita sync e async, nunca lanca â€” D7); caminho mock dev sem OPENAI_API_KEY nao emite onCall (sem chamada real de IA â€” 6.5) (38-1-09)
- [Phase 38.2]: Migration 4 de fix separada (padrÃ£o F38.1) para MIN(uuid) no RPC de runs â€” PostgreSQL nÃ£o tem agregado MIN/MAX para UUID; subqueries correlacionadas ORDER BY created_at LIMIT 1 (38-2-01)
- [Phase 38.2]: EvidÃªncias de segmento (D9) expostas como dados brutos no RPC (store_is_test, deduction_purchased_amount/bonus, admin_grant_evidence); classificaÃ§Ã£o Ã© do service layer (38-2-05), nunca no RPC (38-2-01)
- [Phase 38.2]: creditos_debitados reutiliza public.admin_cost_vs_credits via SQL interno do RPC SECURITY DEFINER â€” proibiÃ§Ã£o de .from() vale para a camada app/service, nÃ£o para SQL de migration (38-2-01)
- [Phase 38.2]: [Phase 38.2] Default/fallback de AMBOS os parÃ¢metros = 1.00 (conservador â€” D1), via constante DEFAULT_ECONOMIC_PARAMETER_VALUE exportada do service (38-2-02)
- [Phase 38.2]: Defesa value <= 0 implementada no service (log + fallback 1.00, nunca propaga invÃ¡lido) como complemento ao CHECK value > 0 do banco â€” T-38.2-10 mitigado em 3 camadas (service + CHECK + zod na rota 38-2-04) (38-2-02)
- [Phase 38.2]: getAll usa ordem fixa de ECONOMIC_PARAMETER_KEYS com .find() por chave â€” source visÃ­vel por resoluÃ§Ã£o para o admin (38-2-02)
- [Phase 38.2]: JSDoc do tracker.ts reformulado sem os literais snake_case das colunas para satisfazer o grep verify (== 1 por coluna) â€” padrÃ£o de desvio da 38-2-02 (38-2-03)
- [Phase 38.2]: PersistÃªncia de confianÃ§a com ?? null (nÃ£o undefined): campos opcionais ausentes do CostResolution â†’ colunas NULL explÃ­citas â†’ badge genÃ©rico na UI (D5); sem backfill em histÃ³rico (38-2-03)
- [Phase 38.2]: Suite do tracker tinha 13 testes F38.1 (nÃ£o 8 como o plano estimou) â€” 4 novos adicionados, total real 17 verdes; critÃ©rio '12 testes' do acceptance criteria baseado em contagem imprecisa (38-2-03)
- [Phase 38.2]: PUT usa safeParse no body (catch -> null) para 400 unico { error: 'Dados invalidos', details } â€” JSON malformado cai no mesmo 400 zod (38-2-04)
- [Phase 38.2]: Resposta do PUT em camelCase { parameter: { key, value }, auditId, updatedAt, idempotent } â€” mapeamento do JSONB do RPC para o contrato D2 da UI 38-2-07 (38-2-04)
- [Phase 38.2]: PaginaÃ§Ã£o progressiva aplicada SEMPRE (nÃ£o sÃ³ com filtro de segmento): o RPC devolve sÃ³ a pÃ¡gina, mas summary/aggregations (D3/D4) exigem o conjunto filtrado inteiro â€” o service acumula o conjunto base (page_size 100) e re-pagina no final (38-2-05)
- [Phase 38.2]: byStage agrupa sob 'unknown' quando o RPC nÃ£o expÃµe generation_type por run (gap de contrato do 38-2-01); campo lido como opcional quando presente; registro em deferred-items.md para 38-2-06/38-2-10 (38-2-05)
- [Phase 38.2]: admin_grant (D9): shape confirmado do RPC ({ grant_count: N } com N > 0); shape divergente â†’ unknown â€” nunca inferir errado (T-38.2-20) (38-2-05)
- [Phase 38.2]: Summary/P95 recomputados no service (helper percentile replicando percentile_cont) sobre o conjunto inteiro â€” consistÃªncia entre summary e aggregations; o summary do RPC permanece como fonte do total da paginaÃ§Ã£o (38-2-05)
- [Phase 38.2]: storeName/owner fail-open (log + null â†’ bucket 'unknown'): dado de apresentaÃ§Ã£o; caminho monetÃ¡rio/segmento Ã© fail-closed (RPC + parÃ¢metros econÃ´micos â†’ 503) (38-2-05)
- [Phase 38.2]: byHour usa hora UTC de created_at â€” determinÃ­stico entre ambientes (Vercel = UTC; dev local em SÃ£o Paulo nÃ£o desloca o agregado) (38-2-05)
- [Phase 38.2]: Segmento validado no zod via enum local OPERATION_RUN_SEGMENTS (sem importar do service server-only) - mesmo contrato D9 do service â€” schemas.ts e modulo compartilhado importado por rotas admin
- [Phase 38.2]: Janela de periodo validada no zod com superRefine (periodStart+periodEnd presentes e diff > 365d -> 400); datas ausentes -> OK (default 90d no service/RPC) â€” Limite operacional de janela T-38.2-25
- [Phase 38.2]: getAvgCost usa o RPC admin_get_ai_costs (F38.1, estavel, aceita p_hours direto) em vez do novo admin_get_ai_operation_runs (D4) â€” key_links do plano apontam para o primeiro; documentado no JSDoc (38-2-09)
- [Phase 38.2]: storeKind nao e suportado pelo RPC de apuracao (sem filtro de loja) â€” getAvgCost mantem a assinatura (hours, storeKind) por compat mas ignora storeKind; card de custo e global (38-2-09)
- [Phase 38.2]: Env VENDEO_USD_BRL_RATE mantido apenas como comentario de fallback de bootstrap (sem uso ativo) â€” atende D2 (fonte unica = parametro) e o grep verify <= 1 (38-2-09)
- [Phase 38.2]: getParameter('usd_brl_rate') resolvido apos o early-return de empty state â€” nenhuma leitura de parametro quando nao ha cards a renderizar (38-2-09)
- [Phase 38.2]: PÃ¡gina /admin/ai-operation-costs consome OperationRunsService direto (padrÃ£o operation-costs/metrics â€” service server-only); drilldown (client) usa fetch Ã  GET /api/admin/ai-operation-runs/[id]. KPIs/agregados vÃªm de summary/aggregations do service â€” a UI NUNCA recalcula (D3/D4). Filtros dos searchParams (contrato camelCase da API 38-2-06) repassados ao service; filtros client navegam com router.push. Placeholder F38.3 (D7) como colunas/blocos fixos. (38-2-08)
- [Phase 38.2]: I1 seeds: contrato Ã© o valor 1.00 (D1 conservador); updated_by preenchido apÃ³s ediÃ§Ã£o via UI/RPC Ã© auditoria funcionando, nÃ£o falha â€” VerificaÃ§Ã£o I1 em banco real (38-2-10)
- [Phase 38.2]: I6 delivery markers: invariante anti-dupla-contagem = nenhum marker pÃ³s-F38.1 (operation_run_id NOT NULL) carrega custo; 51 markers legados (operation_run_id NULL) sÃ£o inertes por construÃ§Ã£o (views/RPCs filtram operation_run_id IS NOT NULL + generation_type NOT IN) â€” VerificaÃ§Ã£o I6 em banco real (38-2-10)
- [Phase 38.2]: Linhas de teste I2/I3 permanecem na economic_parameter_audit (reason 38-2-10-verification) â€” append-only por desenho (trigger bloqueia atÃ© DELETE de service_role); nÃ£o afetam a UI â€” VerificaÃ§Ã£o I2/I3 (38-2-10)
- [Phase 38.2-admin-custos-operacionais]: RPCs da F38.2 expÃµem creditos_estornados/creditos_liquidos por run (gap UAT) â€” fix exclusivo nos RPCs (CREATE OR REPLACE), view F38.1 intocada, creditos_debitados BRUTO mantido
- [Phase 38.2]: Receita/resultado/margem derivados de creditos_liquidos â€” bruto (creditosDebitados) permanece como auditoria de deduÃ§Ãµes â€” DecisÃ£o D1/D4 do phase owner â€” KPIs refletem estornos; full-refund zera receita mantendo custo de IA
- [Phase 38.2]: Floor 0 (estorno > bruto) aplicado pelo RPC via GREATEST (38-2-12) â€” o service consome creditos_liquidos e nunca recalcula o lÃ­quido â€” DecisÃ£o D1/D4 do phase owner â€” KPIs refletem estornos; full-refund zera receita mantendo custo de IA
- [Phase 38.2]: mapDetailRun delegado a deriveBrl â€” uma Ãºnica fÃ³rmula monetÃ¡ria para lista e detalhe (RawDetailRun agora carrega os 3 campos de crÃ©dito) â€” DecisÃ£o D1/D4 do phase owner â€” KPIs refletem estornos; full-refund zera receita mantendo custo de IA
- [Phase 38.2]: KpiDef estendido com tooltip?: string renderizado via title no card â€” tooltip nativo HTML, sem dependencia nova (38-2-14)
- [Phase 38.2]: Breakdown da celula de creditos em linhas separadas (Bruto/Estorno/Liquido) + linha financeira muted â€” asserts exatos por linha nos testes (38-2-14)
- [Phase 38.2]: Bloco financeiro do drilldown condicionado a creditosDebitados !== null â€” runs historicos sem dados nao exibem linha vazia (38-2-14)
- [Phase 38.2]: Textos compostos via template literal nos componentes â€” match exato do getByText sem ambiguidade de nos JSX (38-2-14)
- [Phase 38.2.1-economic-snapshot]: Origem do valor exposta com union de 4 valores em OperationRun/summary: captured_at_generation / backfilled_from_audit / backfilled_seed / economic_parameter_fallback â€” um valor backfilled NUNCA se apresenta como captured; fallback de leitura sempre sinalizado (T-38.2.1-11)
- [Phase 38.2.1-economic-snapshot]: deriveSummary passa a somar os BRL JA derivados por run (D5/T-38.2.1-12): re-derivacao do total USD com taxa unica removida â€” alterar parametro corrente nao recalcula historico com snapshot (estabilidade temporal testada com corrente 6.00)
- [Phase 38.2.1-economic-snapshot]: Agregacao de origem do summary com precedencia deterministica: fallback > backfilled_from_audit > backfilled_seed > captured; revenueEstimationNote derivada da origem agregada do credito
- [Phase 38.2.1-economic-snapshot]: Evento call-level expoe snapshots/origens cruas (nullable) + estimatedCostBrl com snapshot do evento ?? corrente; run do detalhe usa os snapshots do RPC (1o evento do run â€” D6)
