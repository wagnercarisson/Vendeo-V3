---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 07
subsystem: api
tags: [route, ndjson, f37.2, correction, problem-report]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 03
    provides: RPCs begin/complete_analysis
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 05
    provides: correction-reports.ts (completeCorrectionAnalysis)
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 06
    provides: CorrectionIntentService
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 08
    provides: generateCorrectionV2 (orquestrador da v2)
provides:
  - POST /api/campaign/[id]/problem-report (guards → begin → análise → NDJSON/JSON)
affects: [37-2-10 (UI modal), 37-2-11 (página), 37-2-17 (testes de rota)]

# Tech tracking
tech-stack:
  added: []
  patterns: [rota apiHandler + guards padrão, NDJSON ReadableStream, delegação ao orquestrador (dono único do consumo/upload/complete/fail)]

key-files:
  created: [src/app/api/campaign/[id]/problem-report/route.ts]
  modified: []

key-decisions:
  - "Texto vazio/só pontuação (regex \\p{P}\\p{S}\\s) → 400 sem criar caso e sem IA"
  - "begin antes da IA; conclusão SEMPRE via RPC complete_campaign_correction_analysis (lease/vigência)"
  - "eligible delega a generateCorrectionV2 (a rota NÃO chama fail/cleanup — dono único é o orquestrador)"
  - "Sem reserva de crédito; eventos sob campaign.operation_run_id"

patterns-established:
  - "Rota corretiva: begin → análise → 200 JSON (blocked/unclear/analysis_failed) ou NDJSON (eligible)"

requirements-completed: [F37.2-07]

# Metrics
duration: 30min
completed: 2026-09-10
---

# Phase 37.2 Plan 07: Rota problem-report Summary

**`POST /api/campaign/[id]/problem-report` com guards completos, validação 400 de texto vazio/pontuação, `begin` RPC (caso + tentativa antes da IA), análise textual, conclusão via RPC e bifurcação 200 JSON (blocked/unclear/analysis_failed) vs NDJSON (eligible → `generateCorrectionV2`), sem reserva de crédito**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3 (mesmo arquivo)
- **Files modified:** 1 (novo)

## Accomplishments

- **Task 1 — Guards + zod + 400 + begin:** `requireSameOrigin` → `requireApiUser` → UUID v4 (400) → `getCampaign` (404) → `requireOwnership` (404) → `isCampaignApprovalEnabled` (403) → `status === "ready"` (409); body `{ text }` zod `.strict()`; vazio/só pontuação → 400; `begin_campaign_correction_submission` com mapeamento 409 (`no_active_candidate`/`campaign_not_pending`/`already_consumed`/`analysis_in_progress`/`rate_limit_exceeded`).
- **Task 2 — Análise + conclusão + 200/NDJSON:** `CorrectionIntentService.analyzeReport`; `completeCorrectionAnalysis` (RPC `complete_campaign_correction_analysis`) com 409 para `submission_not_analyzing`/`analysis_lease_expired`/`submission_stale`; `blocked`/`unclear`/`analysis_failed` → `200 { analysisState, guidance }`; `eligible` → `ReadableStream` NDJSON (`application/x-ndjson`).
- **Task 3 — Delegação:** o stream chama `generateCorrectionV2` (fases `input_validation` skipped → `image_generation` → `result`/`error`); a rota **não** chama `fail_campaign_correction_v2`/`deleteCampaignImage`; sem `reserveCredit`; `operation_run_id` da campanha propagado à análise.

## Task Commits

1. **Tasks 1-3: rota problem-report** — `3fad5264` (feat)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/app/api/campaign/[id]/problem-report/route.ts` — rota completa do fluxo corretivo

## Decisions Made

- Vazio/só pontuação via regex Unicode `^[\s\p{P}\p{S}]*$` → 400.
- Erros de conclusão fora de lease/stale → 500 (indicam bug do caller); lease/stale → 409.
- `analysis_failed` retorna 200 (pode reformular enquanto houver tentativas).
- A rota apenas emite eventos NDJSON; o orquestrador é dono único do consumo/upload/complete/fail.

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito. (Tasks 1-3 editam o mesmo arquivo → commit único.)

## Issues Encountered

Nenhum bloqueio. Typecheck limpo; gates verdes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Rota pronta para o modal [Informar problema] (37-2-10) e para os testes de rota (37-2-17).
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
