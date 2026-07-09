# Project State

**Last updated:** 2026-07-09
**Milestone:** v1.3 — Persistência e Entrega da Campanha 🔷 PLANNING

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

**Tests:** 465 passing (51 files)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

## In Progress

### Phase 13 — Serviço de Persistência e Download

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 13-01 | 1 | ○ | Types & Persistence Service — types.ts, persistence.ts (7 helpers) |
| 13-02 | 1 | ○ | Download Route — GET /api/campaign/[id]/download |
| 13-03 | 2 | ○ | Tests — 19+6 cenários |

**Fonte:** `openspec/changes/fase-13-servico-persistencia-download/`

## Current Position

**Status:** Phase 13 planejada — aguardando revisão dos artefatos antes da implementação.

**Critério de conclusão da milestone:** O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la.

**v1.3 phases identified:**
- **[✅] Phase 12: Fundação DB/Storage** — campaigns table, campaign-images bucket, RLS/Storage policies, verify script
- **[🔷] Phase 13: Serviço de Persistência** — types.ts, persistence.ts, download route, 22+ testes
- **[○] Phase 14: Integração no Fluxo de Geração** — salvar campanha pós-renderização
- **[○] Phase 15: Página de Campanha** — /campanha/[id] com preview e download
- **[○] Phase 16: Lista de Campanhas** — /minhas-campanhas com thumbnails

**Próximo passo:** Revisar artefatos da Phase 13 (CONTEXT.md + PLAN.md) antes de executar.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-08)

**Core value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais.

**Current focus:** v1.3 — Persistência e Entrega da Campanha
