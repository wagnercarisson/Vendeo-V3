---
phase: 29-1-1
plan: 03
name: "Testes e Verificação"
subsystem: "testing"
tags: ["tests", "verification", "regression"]
key-files:
  - src/app/api/store/[id]/visual-signature/__tests__/credit-flow.test.ts
  - src/app/api/store/[id]/visual-signature/generate-without-logo/__tests__/generate-route.test.ts
  - src/app/api/store/[id]/visual-signature/__tests__/generate-without-logo.test.ts
  - src/app/api/store/[id]/visual-signature/__tests__/visual-signature-route.test.ts
metrics:
  test-files-changed: 4
  new-tests: 8 (credit flow)
  updated-tests: 4 (existing test files)
  total-tests: 917 passing (117 files)
  commits: 2
---

## Testes e Verificação

### Tests created/updated

**New: credit-flow.test.ts (8 tests)**
- Saldo suficiente: reserve + generate + credit_tx_id in metadata
- Saldo zero: returns 402 insufficient_credits
- IA failure: reserveCredit called, IA fails → refundCredit called
- Storage failure: reserveCredit called, storage fail → refund + 503
- creditsChargingEnabled=false: no balance check, no reserve
- generationPaused=true: returns 503 before any operation
- v15Enabled=false: generation without credit consumption
- Idempotency: multiple calls with same operationId OK

**Updated: generate-route.test.ts**
- Added credit mocks (getLaunchConfig, CreditService)
- Replaced exhausted/attempts tests with credit tests

**Updated: generate-without-logo.test.ts**
- Added credit mocks
- Replaced exhausted test with "no limit" assertions

**Updated: visual-signature-route.test.ts**
- makeChain supports `count: "exact"` for pagination

### Final verification results

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | ✓ Clean |
| Lint (`next lint`) | ✓ Clean |
| Tests (`vitest run`) | ✓ 917/917 across 117 files |
| Build (`next build`) | ✓ Compiled successfully |

### Deviations

None.

### Self-Check: PASSED
