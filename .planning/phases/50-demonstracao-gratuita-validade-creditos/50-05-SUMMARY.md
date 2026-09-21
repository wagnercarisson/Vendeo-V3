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
- Both generation routes contain the `first_generation` integration after successful completion, fail-open, deduplicated by `origin_demo_grant_tx_id`.
- Administrative creation without CNPJ remains delegated to the zero-credit RPC path.

## Validation

- Route generation tests: 80/80 PASS with mocks co-migrated; dedicated emission assertions remain pending.
- `npm run typecheck`: PASS.
