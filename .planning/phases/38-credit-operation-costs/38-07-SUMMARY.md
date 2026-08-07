---
phase: 38-credit-operation-costs
plan: 07
subsystem: ui
tags: [operation-cost, ui, hook, visual-signature]

requires:
  - phase: 38-06
    provides: useOperationCosts + formatCredits
provides:
  - campaign-input-form custo dinâmico + disable por saldo/custo/indisponível
  - drift-critical-modal custo visual_signature_generation dinâmico
  - visual-signature-approval-modal custo dinâmico
affects:
  - 38-08

tech-stack:
  added: []
  patterns:
    - "Nunca presumir custo: loading/unavailable omite número"

key-files:
  modified:
    - src/components/flow/campaign-input-form.tsx
    - src/components/flow/drift-critical-modal.tsx
    - src/components/flow/visual-signature-approval-modal.tsx
    - src/components/flow/__tests__/visual-signature-approval-modal.test.tsx
    - src/components/flow/__tests__/drift-critical-modal.test.ts
    - src/components/flow/__tests__/store-identity-form.drift-tabs.test.ts
    - src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx

key-decisions:
  - "campaign-input-form disable quando balance < costCredits, enabled=false ou unavailable"
  - "Modais omitem frase de custo quando hook está unavailable"

patterns-established: []

requirements-completed:
  - F38-UI-01
  - F38-UI-03
  - F38-UI-04

duration: 20min
completed: 2026-08-07
---

# Phase 38: Plan 07 — UI Dynamic Costs Summary

**UI com custo dinâmico nos 3 componentes — sem custo presumido.**

## Verification

- vitest 4 files / 53 tests passed
- typecheck clean

## Deviations

- Nenhum
