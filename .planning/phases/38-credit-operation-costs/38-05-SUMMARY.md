---
phase: 38-credit-operation-costs
plan: 05
subsystem: admin
tags: [admin, operation-cost, rpc, zod]

requires:
  - phase: 38-01
    provides: RPC admin_update_operation_cost
  - phase: 38-02
    provides: OperationCostService base
provides:
  - UpdateOperationCostRequestSchema (XOR + reason min 1)
  - getAllCosts merge table/fallback
  - GET/PUT /api/admin/operation-costs
  - Página /admin/operation-costs + nav
affects:
  - 38-08

tech-stack:
  added: []
  patterns:
    - "Mutação admin somente via RPC (nunca query builder)"
    - "Email join users na API/página (updatedByUserId → email)"

key-files:
  created:
    - src/app/api/admin/operation-costs/route.ts
    - src/app/api/admin/operation-costs/__tests__/route.test.ts
    - src/app/(app)/admin/operation-costs/page.tsx
    - src/app/(app)/admin/operation-costs/operation-costs-form.tsx
    - src/app/(app)/admin/operation-costs/__tests__/page.test.tsx
  modified:
    - src/lib/admin/schemas.ts
    - src/lib/credit/operation-cost-service.ts
    - src/lib/credit/__tests__/operation-cost-service.test.ts
    - src/app/(app)/admin/layout.tsx

key-decisions:
  - "reason min(1) conforme F38-ADMIN-03 (não min 10)"
  - "Form envia XOR: botão separado para custo vs habilitação"

patterns-established: []

requirements-completed:
  - F38-ADMIN-01
  - F38-ADMIN-02
  - F38-ADMIN-03
  - F38-ADMIN-04

duration: 25min
completed: 2026-08-07
---

# Phase 38: Plan 05 — Admin Operation Costs Summary

**Admin completo: schema, getAllCosts, API GET/PUT via RPC, página e nav.**

## Verification

- vitest 3 files / 23 tests passed
- typecheck clean

## Deviations

- Nenhum
