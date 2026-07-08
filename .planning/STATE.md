# Project State

**Last updated:** 2026-07-08
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

## Current Position

**Status:** Phase 12 executada — infraestrutura de banco e Storage criada, smoke tests 9/9 PASS, UAT manual 5/10 verificado (RLS, CHECK, trigger, isolation). Próximo passo: Phase 13 — Serviço de Persistência.

**Critério de conclusão da milestone:** O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la.

**v1.3 phases identified:**
- **[✅] Phase 12: Fundação DB/Storage** — campaigns table, campaign-images bucket, RLS/Storage policies, verify script
- **[○] Phase 13: Serviço de Persistência** — persistence.ts, write/read helpers, signed URL
- **[○] Phase 14: Integração no Fluxo de Geração** — salvar campanha pós-renderização
- **[○] Phase 15: Página de Campanha** — /campanha/[id] com preview e download
- **[○] Phase 16: Lista de Campanhas** — /minhas-campanhas com thumbnails

**Próximo passo:** Planejar e executar Phase 13 — Serviço de Persistência.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-07-08)

**Core value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais.

**Current focus:** v1.3 — Persistência e Entrega da Campanha
