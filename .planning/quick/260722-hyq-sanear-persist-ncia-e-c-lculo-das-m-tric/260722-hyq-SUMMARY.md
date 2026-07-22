---
phase: quick
plan: 260722-hyq
type: fix
wave: 1
completed_date: "2026-07-22"
tasks:
  total: 2
  completed: 2
commits:
  - ebc98cf: "fix(quick-260722-hyq): add metadata.feature to credit reserve/refund calls"
  - 4f73def: "fix(quick-260722-hyq): fix getCreditsGranted SUM + getRefundRate classification + 10 new tests"
files_modified:
  - src/app/api/campaign/generate-image/route.ts
  - src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
  - src/lib/metrics/pipeline-metrics.ts
  - src/lib/metrics/__tests__/pipeline-metrics.test.ts
tech-stack:
  added: []
  patterns: []
key-decisions:
  - "getRefundRate uses single-query approach (fetch all tx types, classify in JS) for maintainability"
  - "operationId hoisted to try-block scope in VS route for refund metadata access"
metrics:
  duration: ~3min
  tests: 18 passing (1 file, all existing + 10 new)
  typecheck: clean
---

# Quick Task 260722-hyq: Sanear persistência e cálculo das métricas de crédito no pipeline

**One-liner:** Corrected `getCreditsGranted` to SUM amounts instead of counting rows, rewrote `getRefundRate` to exclude Visual Signature transactions and classify campaign-only refunds via metadata/campaign_id/reference chain, and tagged all campaign/VS credit operations with `metadata.feature` for reliable classification.

## Task Completion

### Task 1: Fix metadata persistence in reserveCredit/refundCredit calls

**Files:**
- `src/app/api/campaign/generate-image/route.ts` — Added `metadata: { feature: "campaign_pipeline" }` to 1 `reserveCredit` call (line 294) and all 4 `refundCredit` calls (lines 447, 597, 616, 653)
- `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` — Added `{ metadata: { feature: "visual_signature", mode, operationId } }` to the VS `refundCredit` call (line 394). Hoisted `operationId` to try-block scope to fix TS error TS18004.

**Verification:** All 5 campaign calls confirmed via grep. VS refundCredit confirmed via grep.

### Task 2: Fix getCreditsGranted and getRefundRate + update tests

**Part A: getCreditsGranted**
- Replaced `.select("id", { count: "exact", head: true })` with `.select("amount")` + `reduce` SUM
- Returns sum of `amount` for grant-type transactions in the time window
- Returns 0 for empty data (not null)

**Part B: getRefundRate**
- Single-query approach: fetches all `credit_transactions` with columns `id, type, amount, campaign_id, metadata, reference`
- Classification rules:
  - Campaign deductions: `metadata.feature = "campaign_pipeline"` OR (null/empty metadata + `campaign_id IS NOT NULL`)
  - VS deductions: `metadata.feature = "visual_signature"` → excluded
  - Anomaly deductions: null metadata + null campaign_id → excluded
  - Refunds: inherit classification from referenced deduction via `reference` column
  - Orphan refunds (reference not found in data): excluded
- Returns 0 when only VS transactions exist, 0 when empty data

**Part C: Tests (10 new + 8 existing)**
- 3 `getCreditsGranted` tests: sum calculation, empty returns 0, negative amounts
- 7 `getRefundRate` tests: VS exclusion, campaign_pipeline metadata, legacy campaign_id, reference inheritance, anomaly/orphan exclusion, VS-only returns 0, empty returns 0

**Deviations applied:**
- [Rule 1 - Bug] Line 394 VS refundCredit — `operationId` was declared with `const` inside the `if (creditsEnabled)` block, making it out of scope for the refund call. Hoisted declaration to try-block scope as `let operationId: string | undefined`.

## Results

| Check | Status |
|-------|--------|
| Task 1 implemented | ✅ |
| Task 2 implemented | ✅ |
| Tests passing (18/18) | ✅ |
| TypeScript clean | ✅ |
| All existing metrics tests preserved | ✅ |

## Verification

```
 ✓ 18 tests passed
 ✓ TypeScript: clean (0 errors)
 ✓ grep confirms: 5 campaign_pipeline + 2 visual_signature metadata.feature
```

## Self-Check: PASSED

- All 4 source files verified on disk
- Both commits found in git log (ebc98cf, 4f73def)
- SUMMARY.md created at expected path
