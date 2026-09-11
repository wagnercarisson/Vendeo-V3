---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 13
subsystem: testing
tags: [vitest, unit-tests, f37.2, correction-analysis]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 06
    provides: CorrectionIntentService
provides:
  - testes 12.2-12.9 do CorrectionIntentService (8 casos)
affects: [37-2-18 (regressão)]

# Tech tracking
tech-stack:
  added: []
  patterns: [mock de TextProvider por injeção, mock de AiCostTracker via vi.hoisted]

key-files:
  created: [src/__tests__/lib/campaign/correction-intent-service.test.ts]
  modified: []

key-decisions:
  - "12.1 (validação de texto vazio/pontuação) é contratual da ROTA — coberta no plano 17; o serviço não expõe validador próprio"
  - "Provider e AiCostTracker mockados (sem IA real)"

patterns-established:
  - "Testes de serviço de IA com provider injetado + tracker mockado"

requirements-completed: [F37.2-13]

# Metrics
duration: 25min
completed: 2026-09-10
---

# Phase 37.2 Plan 13: Testes de Análise/Classificação Summary

**8 testes (12.2-12.9) do `CorrectionIntentService`: categorias elegíveis, blocked/unclear, JSON inválido → unclear, timeout/vazio → analysis_failed, saneamento de `{{ }}` e evento call-level `campaign_correction_analysis`**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3 (mesmo arquivo)
- **Files modified:** 1 (novo)

## Accomplishments

- **12.2** análise sobre o texto (prompt contém o relato, sem `data:image`).
- **12.3** cada uma das 7 categorias elegíveis → `eligible` + `category` + `normalizedInstruction`.
- **12.4** `blocked` → `guidance`, sem campos de geração.
- **12.5** `unclear` → orientação/exemplo, sem campos de geração.
- **12.6** texto livre/JSON fora do schema → `unclear`.
- **12.7** exceção de transporte e resposta vazia → `analysis_failed`.
- **12.8** `normalizedInstruction` com `{{ }}` saneada (`{ }`).
- **12.9** evento `campaign_correction_analysis` com `provider`/`model`/`usage`/`attemptNumber`/`operationRunId`/`operationRunType`; falha → `status: "failed"`.

## Task Commits

1. **12.2-12.9** — `49f03237` (test)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/__tests__/lib/campaign/correction-intent-service.test.ts` — 8 testes

## Decisions Made

- 12.1 (validação de vazio/pontuação) é contratual da rota `problem-report` e fica no plano 17 — o serviço não expõe validador próprio (a opção "se houver" do PLAN não se aplica).
- Mocks: provider injetado no construtor + `AiCostTracker`/`resolveAiCost` via `vi.mock`.

## Deviations from Plan

Nenhuma - 12.2-12.9 implementados; 12.1 explicitamente deferido ao plano 17 conforme o próprio PLAN.

## Issues Encountered

Ajuste de tipagem do mock (`vi.fn(async (_event: unknown) => ...)`) para o typecheck ficar limpo.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Testes de análise prontos; planos 14-17 cobrem RPCs/consumo/UI/rota.
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
