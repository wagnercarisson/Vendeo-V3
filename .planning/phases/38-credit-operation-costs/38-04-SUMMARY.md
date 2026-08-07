---
phase: 38-credit-operation-costs
plan: 04
subsystem: api
tags: [visual-signature, operation-cost, credits, 503]

requires:
  - phase: 38-02
    provides: OperationCostService.getCost
provides:
  - generate-without-logo resolve visual_signature_generation
  - Guards 503 operation_disabled (sempre) / operation_cost_unavailable
  - Reserva dinâmica + metadata snapshot em store_visual_signatures
affects:
  - 38-07 (modais VS)
  - 38-08

tech-stack:
  added: []
  patterns:
    - "Guard enabled SEMPRE antes do gate creditsEnabled (D4 freemium)"
    - "Snapshot de custo no metadata VS ao lado de credit_tx_id"

key-files:
  created: []
  modified:
    - src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
    - src/app/api/store/[id]/visual-signature/__tests__/credit-flow.test.ts
    - src/app/api/store/[id]/visual-signature/__tests__/generate-without-logo.test.ts
    - src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts

key-decisions:
  - "Refund mantém metadata de feature sem snapshot de custo"
  - "cost declarado no escopo do handler para success path"

patterns-established: []

requirements-completed:
  - F38-ROUTES-01
  - F38-ROUTES-03
  - F38-VS-01
  - F38-CONFIG-01
  - F38-CONFIG-02

duration: 20min
completed: 2026-08-07
---

# Phase 38: Plan 04 — VS Dynamic Cost Summary

**generate-without-logo com custo dinâmico, guards 503 e snapshot no metadata.**

## Task Commits

1. **Task 1: route** - feat(38-04)
2. **Task 2: tests** - test(38-04)

## Verification

- vitest 3 files / 28 tests passed

## Deviations

- Nenhum
