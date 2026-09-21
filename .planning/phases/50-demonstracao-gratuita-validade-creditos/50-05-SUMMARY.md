---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 05
subsystem: routes
status: partial
updated: 2026-09-21
---

# Phase 50 Plan 05 Summary

## Completed

- Creation, CNPJ update and admin approval pass `p_demo_grant_enabled` from launch config to SQL wrappers.
- Admin exception remains a non-expiring bonus path without the demo flag.
- Monthly credits remain enabled until the coordinated 50-14 cut.
- Generation gate already uses `CreditService.getBalance`, preserving 402 and refund behavior.
- Administrative creation without CNPJ remains delegated to the zero-credit RPC path.

## Pending Dependency

The `first_generation` product event remains pending because `ProductEventService` belongs to plan 50-08. Task 5.4 remains open only for that integration.

## Validation

- Route tests: 36/36 PASS.
- `npm run typecheck`: PASS.
