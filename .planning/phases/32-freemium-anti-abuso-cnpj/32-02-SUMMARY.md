# Plan 02 — Summary

**Phase:** 32 — Freemium Anti-Abuso CNPJ
**Plan:** 02 — Freemium Service + Store Route
**Wave:** 2
**Status:** ✅ Complete
**Date:** 2026-07-27

## Tasks

### Task 1: Freemium Core Library
- `src/lib/freemium/types.ts`: Zod schemas (BenefitTypeEnum, FreemiumEntitlementSchema, FreemiumHistoryQuerySchema) + FreemiumStatus type
- `src/lib/freemium/entitlement-service.ts`: FreemiumEntitlementService class with 6 methods — checkOnboardingEligibility, grantOnboardingEntitlement (via RPC), checkMonthlyEligibility, grantMonthlyEntitlement (via RPC), getHistoryByStore, getHistoryByRoot
- `src/lib/freemium/index.ts`: reexports

### Task 2: Store Route — POST /api/store
- Accepts `cnpj` (required), `razaoSocial?`, `nomeFantasia?` in body
- Validates CNPJ via validateCnpj(), computes rootHash via hashCnpjRoot()
- Checks CNPJ duplication before RPC
- Calculates compareBusinessName score (non-blocking)
- Calls `create_store_with_cnpj` RPC with p_cnpj_root_hash + p_cnpj_validation_score
- Response includes cnpjMasked + onboardingGranted
- Error handling: no CNPJ → 400, invalid → 400, duplicate → 409

## Files Created/Modified
- `src/lib/freemium/types.ts` (new)
- `src/lib/freemium/entitlement-service.ts` (new)
- `src/lib/freemium/index.ts` (new)
- `src/app/api/store/route.ts` (modified)
