---
phase: 31-1-modelo-comercial-formulario
plan: 05
subsystem: testing
tags: [vitest, tests, regression]
requires:
  - phase: 31-1-modelo-comercial-formulario
    provides: all intent types, form logic, pipeline guard, UI components
provides:
  - 20 intent-specific tests (inference, validation, badge/preserve, schema/pipeline)
  - Full regression pass (1036 tests)
affects: []
tech-stack:
  added: []
  patterns: [pure-function testing of inferIntent, mock-based API route testing, renderHook testing of form state]
key-files:
  created:
    - src/components/flow/__tests__/intent-inference.test.ts
    - src/components/flow/__tests__/intent-validation.test.ts
    - src/components/flow/__tests__/intent-badge-preserve.test.ts
    - src/__tests__/api/campaign-intent-guard.test.ts
  modified:
    - src/components/flow/__tests__/use-campaign-form-navigation.test.ts
    - src/app/(app)/campanhas/nova/__tests__/campaign-flow-credits.test.tsx
requirements-completed: [INTENT-01, INTENT-02, INTENT-03, INTENT-04, INTENT-05, INTENT-06, INTENT-07, INTENT-08, INTENT-09, INTENT-10, INTENT-11, INTENT-12]
completed: 2026-07-24
---

# Plan 05: Tests — Inferência, Validação, Badge, Schema, Pipeline Guard

**20 intent tests across 4 files, full regression (1036 tests), typecheck, lint, build all clean**

## Performance
- **Files created:** 4 test files
- **Files modified:** 2 existing test files (regression fixes)
- **Tests:** 20 new + 1016 existing = 1036 passing ✓
- **TypeScript:** Clean ✓ | **Lint:** Clean ✓ | **Build:** Clean ✓

## Accomplishments
- `intent-inference.test.ts` — 4 tests for `inferIntent` (DE+POR, only price, no price, all zero)
- `intent-validation.test.ts` — 8 tests for `validateDiscountedPrice` and `validateBadge` (conditional by intent)
- `intent-badge-preserve.test.ts` — 2 tests for badge cleanup and preserveImageContext reset on intent change
- `campaign-intent-guard.test.ts` — 6 tests for schema parsing and pipeline guard behavior
- Fixed regressions in navigation tests (restore + offer form setup) and credit flow tests (mock updates)

## Decisions Made
- Badge cleanup effect moved from UI to hook for testability
- Used `isInitial` guard in inference effect to prevent stale EMPTY_FIELDS override on mount
- Navigation tests now use mock restore + sessionStorage for image data URL
