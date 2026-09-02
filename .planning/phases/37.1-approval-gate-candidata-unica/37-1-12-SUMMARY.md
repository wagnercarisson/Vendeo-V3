---
phase: 37.1-approval-gate-candidata-unica
plan: 12
subsystem: testing
tags: [generate-image, download, publication-copy, tests, gates, f37]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (tasks.md seções 15/16, specs ai-image-generation/campaign-download-route/publication-copy-route) + generate-image v1 (37-1-06) + gates download/copy (37-1-07)
provides:
  - Testes 15.1-15.2 (generate-image insere v1 flag on/off + fail-safe)
  - Testes 16.1-16.5 (download/copy gated: 403 pending, 200 aprovada, 200 legacy, 200 flag off)
  - Mocks co-migrados (feature-flag-service + listArtVersions) sem quebrar suítes existentes
affects: [37-1-14 (regressão), 37-1-15 (verificação)]

# Tech tracking
tech-stack:
  added: []
  patterns: [mock co-migration with default false, fail-safe rejection test, gate scenarios per delivery route]

key-files:
  created: []
  modified: [src/app/api/campaign/generate-image/__tests__/route.test.ts, src/__tests__/api/campaign-download.test.ts, src/__tests__/api/publication-copy-route.test.ts]

key-decisions:
  - "Mock co-migrado com isCampaignApprovalEnabled default false — suíte existente preservada"
  - "computeApprovalState real (função pura) nos testes de download/copy — o núcleo não é mockado"
  - "Teste 16.4 asserta que update NÃO é chamado no 403 (nada persistido)"

patterns-established:
  - "Teste de gate de entrega: mock flag + listArtVersions + computeApprovalState real → cenários 403/200/legacy/flag off"

requirements-completed: [F37.1-24]

# Metrics
duration: 30min
completed: 2026-09-01
---

# Phase 37.1 Plan 12: Testes generate-image v1 + download/copy gated Summary

**Testes 15.1-15.2 (generate-image insere v1 quando a flag ligada; flag off → zero inserções; falha no insert → geração continua fail-safe) e 16.1-16.5 (download e publication-copy gated: pending+flag on → 403, após aprovação → 200, legacy → 200, flag off → 200), com mocks co-migrados sem quebrar as suítes existentes — 85 testes verdes nas 3 suítes**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 3 (3 suítes de teste)

## Accomplishments

- **Task 1 — Testes 15.1-15.2 (generate-image v1):**
  - Co-migração do mock de `@/lib/campaign/persistence` no `route.test.ts` do generate-image: adicionado `createArtVersion: vi.fn()` (e import); mock de `isCampaignApprovalEnabled` já co-migrado no 37-1-06 (default false)
  - **15.1 (Teste 29):** flag ON → `createArtVersion` chamada com `(CAMPAIGN_ID, 1, `${STORE_ID}/${CAMPAIGN_ID}.jpg`, expect.objectContaining({ schemaVersion: "campaign_brief_v1" }))`; flag OFF → `createArtVersion` NÃO chamada
  - **15.2:** flag ON + `createArtVersion` REJEITANDO → rota NÃO retorna 500 (resposta 200 — geração continua; `console.error` spy); fail-safe comprovado
- **Task 2 — Testes 16.1-16.5 (download/copy gated):**
  - **`campaign-download.test.ts`**: co-migrado com mocks de `listArtVersions` (persistence) + `isCampaignApprovalEnabled` (feature-flag-service, default false); cenários — **16.1** pending+flag on → 403 `{ error: "Campaign pending approval" }` (download não chamado); **16.2** após aprovação (`approved_version_id` + `approval_status: "approved"` + v1 approved) → 200; **16.3** legacy (flag on + `[]`) → 200; **16.5** flag off (mesmo com v1 pendente em banco) → 200 (fast path sem gate); cenários existentes (401/400/404/502) preservados
  - **`publication-copy-route.test.ts`**: co-migrado com os mesmos mocks; cenários — **16.4** pending+flag on → 403 E assert de que `supabaseAdmin.from("campaigns").update` NÃO foi chamado (nada persistido); após aprovação → 200 (edição); legacy → 200; **16.5** flag off → 200 (edição); cenários existentes (200/400/404/403 CSRF/401) preservados
  - `computeApprovalState` REAL (função pura) nos testes — o núcleo lógico não é mockado
- **Verificação de aceitação:** `npx vitest run` das 3 suítes — **85/85 PASS** (generate-image 63, download 10, copy 12); typecheck com erros apenas em `display.test.ts` (fixtures — 37-1-14); mock default false preserva as suítes existentes.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Testes 15.1-15.2 — generate-image insere v1 (flag on/off + fail-safe)** - `3cfe2d99` (test)
2. **Task 2: Testes 16.1-16.5 — download e publication-copy gated (403/200/legacy/flag off)** - `3cfe2d99` (test, mesmo commit)

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/app/api/campaign/generate-image/__tests__/route.test.ts` - Mock createArtVersion + testes 15.1/15.2
- `src/__tests__/api/campaign-download.test.ts` - Mocks + testes 16.1/16.2/16.3/16.5
- `src/__tests__/api/publication-copy-route.test.ts` - Mocks + testes 16.4/16.5

## Decisions Made

- Mock co-migrado com `isCampaignApprovalEnabled` default false (suíte existente intacta — 63 generate-image PASS)
- `computeApprovalState` real nos testes de rota (o núcleo lógico não é mockado)
- Teste 16.4 asserta `update` NÃO chamado no 403 (nada persistido — decisão 4)

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered

Nenhum - 85/85 testes PASS; typecheck segue com erro apenas nas fixtures de `display.test.ts` (37-1-14).

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- generate-image: v1 inserida (flag on), zero inserções (flag off), fail-safe provado
- Download gated: 403 pending / 200 aprovada / 200 legacy / 200 flag off
- Copy gated: 403 pending sem persistir / 200 aprovada / 200 legacy / 200 flag off
- Próximo: **37-1-13** (testes da UI de revisão 17.1-17.5 + co-migração campaign-page/campaign-page-server)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
