---
phase: 38-credit-operation-costs
plan: 02
subsystem: api
tags: [credit, operation-cost, supabase, fail-open, fail-closed]

requires:
  - phase: 38-01
    provides: credit_operation_costs table no remoto
provides:
  - OPERATION_KEYS / OperationKey / OperationCostResolution / OperationCostSnapshot em types.ts
  - OperationCostService.getCost com fail-open (fallback) e fail-closed (OperationCostUnavailableError)
  - DEFAULT_OPERATION_COSTS versionado (campaign_generation=1, visual_signature_generation=1)
  - 6 testes unitários D5/D7
affects:
  - 38-03 (generate-image)
  - 38-04 (generate-without-logo)
  - 38-05 (admin getAllCosts)
  - 38-06 (GET /api/operation-costs)

tech-stack:
  added: []
  patterns:
    - "Fail-open só para linha inexistente (banco saudável); fail-closed em erro real de leitura"
    - "Tipos sem server-only; service com server-only"

key-files:
  created:
    - src/lib/credit/operation-cost-service.ts
    - src/lib/credit/__tests__/operation-cost-service.test.ts
  modified:
    - src/lib/credit/types.ts

key-decisions:
  - "DEFAULT_OPERATION_COSTS no módulo do service (mesma fonte do enum TS)"
  - "enabled=false retornado na resolução; 503 é decisão da rota"
  - "Sem métodos de escrita no service — mutação só via RPC admin"

patterns-established:
  - "OperationCostUnavailableError para fail-closed de leitura de custo"

requirements-completed:
  - F38-SERVICE-01
  - F38-SERVICE-02
  - F38-SERVICE-03
  - F38-SERVICE-04

duration: 20min
completed: 2026-08-07
---

# Phase 38: Plan 02 — OperationCostService Summary

**Camada de tipos + serviço de custo por operação com fail-open/fail-closed (D5/D7).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3/3
- **Files modified:** 3

## Accomplishments

- `OPERATION_KEYS` / `OperationKey` / `OperationCostResolution` / `OperationCostSnapshot` em `types.ts` (sem server-only)
- `OperationCostService.getCost` com source `table` | `fallback` e `OperationCostUnavailableError`
- 6 testes unitários passando (table, fallback, fail-closed, enum, enabled=false, invariante escrita)

## Task Commits

1. **Task 1: Tipos** - `1173ea8` (feat)
2. **Task 2: Service** - `ce63d69` (feat)
3. **Task 3: Testes** - `1665e7f` (test)

**Plan metadata:** (este SUMMARY)

## Files Created/Modified

- `src/lib/credit/types.ts` — OPERATION_KEYS + resolution/snapshot types
- `src/lib/credit/operation-cost-service.ts` — getCost + DEFAULT_OPERATION_COSTS + error
- `src/lib/credit/__tests__/operation-cost-service.test.ts` — cobertura D5/D7

## Verification

- `npx vitest run src/lib/credit/__tests__/operation-cost-service.test.ts` → 6 passed
- `grep server-only types.ts` → 0; service → 1

## Deviations

- Nenhum
