# Plan 05 — Summary

**Phase:** 32 — Freemium Anti-Abuso CNPJ
**Plan:** 05 — Tests + Verification
**Wave:** 3
**Status:** ✅ Complete
**Date:** 2026-07-27

## Tasks

### Task 1: CNPJ + Freemium Unit Tests
- `validate.test.ts`: 9 tests (valid with punctuation, digits only, invalid digits, short, long, known sequence 11, known sequence 00, empty, letters)
- `normalize.test.ts`: 2 tests (remove punctuation, remove non-digits)
- `hash.test.ts`: 3 tests (hex output, deterministic, changes with pepper)
- `mask.test.ts`: 2 tests (mask format, preserve suffix)
- `similarity.test.ts`: 2 tests (match >= 0.8, mismatch < 0.8 without error)
- `entitlement-service.test.ts`: 9 tests (check onboarding eligibility true/false, grant onboarding first/idempotent, check monthly eligibility true/false, grant monthly first/idempotent, getHistoryByStore, getHistoryByRoot)

### Task 2: Integration Tests
- `route.test.ts`: Store route tests with mocked CNPJ validation and RPC calls

### Task 3: Verification
- TypeScript check: clean
- Lint: clean
- Test suite: 1071+ existing + 27 new = ~1098 passing
- Build: successful
- Security audit: CNPJ only in migration SQL and mask.ts; no raw exposure in responses

## Files Created
- `src/lib/cnpj/__tests__/validate.test.ts`
- `src/lib/cnpj/__tests__/normalize.test.ts`
- `src/lib/cnpj/__tests__/hash.test.ts`
- `src/lib/cnpj/__tests__/mask.test.ts`
- `src/lib/cnpj/__tests__/similarity.test.ts`
- `src/lib/freemium/__tests__/entitlement-service.test.ts`
- `src/app/api/store/__tests__/route.test.ts` (updated)
