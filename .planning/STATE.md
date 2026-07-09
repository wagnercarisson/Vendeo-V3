# Project State

**Last updated:** 2026-07-09
**Milestone:** v1.3 — Persistência e Entrega da Campanha 🔷 IN PROGRESS (3/5 phases)

## Completed

### v1.2 — Contas e Propriedade (Phases 7–11)

| Phase | Status | Plans | Description |
|-------|--------|-------|-------------|
| 7. Sessão e Login Vertical | ✅ | 5/5 | `@supabase/ssr`, middleware, login, logout, requireUser |
| 8. Ciclo de Conta | ✅ | 4/4 | signup, confirm, forgot-password, SMTP Resend, UAT 14/14 |
| 9. Cutover de Ownership | ✅ | 4/4 | migration user_id, getCurrentStore, requireOwnership, localStorage removido |
| 10. Perímetro Multi-tenant | ✅ | 6/6 | RLS 5 tabelas, CSRF, guards ~20 handlers, 457 tests, Security 14/14 |
| 11. Verificação e Hardening | ✅ | 1/1 | D8 Catalog 21/21 PASS, store-logos inventário (0 objetos) |

### v1.3 — Persistência e Entrega da Campanha

| Phase | Status | Plans | Description |
|-------|--------|-------|-------------|
| 12. Fundação DB/Storage | ✅ | 5/5 | campaigns table, campaign-images bucket, RLS/Storage policies, verify script |
| 13. Serviço de Persistência | ✅ | 3/3 | types.ts, persistence.ts (7 helpers), download route, 25 testes |
| 14. Integração no Fluxo de Geração | ✅ | 3/3 | image-processor.ts, orchestration generate-image, consumer navigation |

**Tests:** 505 passing (56 files)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

## Planned

### Phase 15 — Página de Campanha ◌

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 15-01 | 1 | ○ | Data/Display Contract — display.ts (getCampaignForDisplay, generateSignedPreviewUrl, computeDisplayStatus) |
| 15-02 | 2 | ○ | UI `/campanha/[id]` — page.tsx + client.tsx (4 estados) + middleware |
| 15-03 | 2 | ○ | Tests & Verification — display, page states, middleware matcher, build |

**Context:** `.planning/phases/15-pagina-de-campanha/15-CONTEXT.md`
**Source:** `openspec/changes/fase-15-pagina-de-campanha/`

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

**Status:** Phase 14 concluída (3/3 planos executados). Fase 15 planejada (3/3 planos criados).

**Critério de conclusão da milestone:** O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la. (Fases 15-16 pendentes)

**v1.3 phases identified:**
- **[✅] Phase 12: Fundação DB/Storage** — campaigns table, campaign-images bucket, RLS/Storage policies, verify script
- **[✅] Phase 13: Serviço de Persistência** — types.ts, persistence.ts, download route, 25 testes
- **[✅] Phase 14: Integração no Fluxo de Geração** — sharp, transcodeToJpeg, persistência, consumer navigation
- **[◌] Phase 15: Página de Campanha** — /campanha/[id] com preview e download (Planned — 3 planos)
- **[○] Phase 16: Lista de Campanhas** — /minhas-campanhas com thumbnails

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-08)

**Core value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais.

**Current focus:** v1.3 — Fase 15 (Página de Campanha) — planos prontos para execução
