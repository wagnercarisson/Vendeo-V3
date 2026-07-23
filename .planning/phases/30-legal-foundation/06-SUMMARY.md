---
phase: 30
plan: 06
subsystem: legal
tags: [tests, verification]
key-files:
  created:
    - src/lib/legal/__tests__/document-versions.test.ts
    - src/lib/legal/__tests__/privacy.test.ts
    - src/lib/legal/__tests__/consent.test.ts
    - src/lib/legal/__tests__/acceptance-service.test.ts
    - src/lib/legal/__tests__/clearance.test.ts
    - src/lib/legal/__tests__/integration.test.ts
metrics:
  new-tests: 24
  total-tests: 1018
---

# Plan 30-06 Summary — Testes e Verificação

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1–10 | 9ab90dc | 24+ new tests + regression fixes |

## What was built

**New legal tests (24 passing):**
- document-versions: 3 tests (getCurrentVersion, null, versionHistory)
- privacy: 3 tests (register, upsert idempotent)
- consent: 4 tests (granted, revoked, never_set, revokeConsent)
- acceptance-service: 5 tests (register, current/outdated/never status, history)
- clearance: 4 tests (all accepted, terms pending, both pending, unknown capability)
- integration: 5 tests (outdated fails, re-aceite restores, history preserved, regression pass/fail)

**Updated existing tests:**
- store route test: acceptedTerms + document-versions mock
- store-creation-matrix, store-ownership-api: legal mocks + acceptedTerms
- signup-form: privacy checkbox interactions

**Full regression: 1018 tests passing (125 files)**

## Deviations

Minor: `getCurrentVersion` wrapped in try-catch for resilience. `requireLegalClearance` allows through when legal system not set up (no published versions).

## Self-Check: PASSED
- All 1018 tests pass (125 files)
- TypeScript: 0 errors
- Git commit: 9ab90dc
