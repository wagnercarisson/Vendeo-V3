---
phase: 38-credit-operation-costs
plan: 03
subsystem: api
tags: [generate-image, operation-cost, credits, 503]

requires:
  - phase: 38-02
    provides: OperationCostService.getCost + OperationCostUnavailableError
provides:
  - generate-image resolve campaign_generation uma vez por request
  - Guards 503 operation_disabled / operation_cost_unavailable
  - Balance 402 dinâmico + reserva com snapshot de custo
  - COST_PER_GENERATION removido de config e src/
affects:
  - 38-07 (UI consome custo dinâmico)
  - 38-08 (verificação)

tech-stack:
  added: []
  patterns:
    - "Resolução de custo pós rate-limit/attempt, pré balance/reserva"
    - "503 error as string code (operation_disabled | operation_cost_unavailable)"

key-files:
  created: []
  modified:
    - src/app/api/campaign/generate-image/route.ts
    - src/lib/image-generation/config.ts
    - src/app/api/campaign/generate-image/__tests__/route.test.ts
    - src/__tests__/concurrency.test.ts
    - src/__tests__/regression-master-switch.test.ts
    - src/__tests__/api/campaign-generate.test.ts

key-decisions:
  - "enabled=false sempre 503, independente de creditsChargingEnabled"
  - "Metadata da reserva inclui operation_key/operation_cost_credits/operation_cost_source"

patterns-established:
  - "Mock OperationCostService via vi.hoisted + mockGetCost default table/1/enabled"

requirements-completed:
  - F38-ROUTES-01
  - F38-ROUTES-02
  - F38-ROUTES-04
  - F38-CONFIG-01
  - F38-CONFIG-02

duration: 25min
completed: 2026-08-07
---

# Phase 38: Plan 03 — generate-image Dynamic Cost Summary

**generate-image com custo dinâmico, guards 503 e COST_PER_GENERATION removido.**

## Task Commits

1. **Task 1: route + config** - `cb654fc` (feat)
2. **Task 2: route.test** - `7d76a07` (test)
3. **Task 3: integration tests** - `f9daf91` (test)

## Verification

- vitest 4 files / 43 tests passed
- COST_PER_GENERATION ausente em src/

## Deviations

- Nenhum
