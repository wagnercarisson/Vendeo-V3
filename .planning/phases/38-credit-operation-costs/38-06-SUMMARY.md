---
phase: 38-credit-operation-costs
plan: 06
subsystem: api
tags: [operation-costs, hook, formatCredits, balance-card]

requires:
  - phase: 38-02
    provides: OperationCostService.getCost
provides:
  - GET /api/operation-costs autenticado (mapa costCredits/enabled)
  - useOperationCosts (cache + loading/unavailable/loaded)
  - formatCredits compartilhado
  - balance-card descrição dinâmica
affects:
  - 38-07

tech-stack:
  added: []
  patterns:
    - "Cache module-level + inflight dedupe no hook client"
    - "Resposta client sem source/updated_by/updated_at"

key-files:
  created:
    - src/app/api/operation-costs/route.ts
    - src/app/api/operation-costs/__tests__/route.test.ts
    - src/hooks/use-operation-costs.ts
    - src/hooks/__tests__/use-operation-costs.test.ts
    - src/lib/credit/format.ts
  modified:
    - src/components/credit/balance-display.tsx
    - src/components/credit/balance-card.tsx
    - src/components/credit/__tests__/balance-card.test.tsx

key-decisions:
  - "getCost uma vez por chave no GET (não getAllCosts admin)"
  - "unavailable omite número de custo na UI"

patterns-established: []

requirements-completed:
  - F38-API-01
  - F38-API-02
  - F38-API-03
  - F38-UI-02
  - F38-UI-05

duration: 20min
completed: 2026-08-07
---

# Phase 38: Plan 06 — Client Cost Data Layer Summary

**Endpoint autenticado + hook + formatCredits + balance-card dinâmico.**

## Verification

- vitest 4 files / 16 tests passed
- typecheck clean

## Deviations

- Nenhum
