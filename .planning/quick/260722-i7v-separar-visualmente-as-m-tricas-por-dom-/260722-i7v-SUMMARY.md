---
phase: quick
plan: 260722-i7v
subsystem: metrics
tags: [admin-dashboard, metrics, visual-signature, domain-sections, cross-window-refund, duration_ms]
requires: []
provides: [vs-metrics, domain-sections]
affects: [admin-metrics-page, pipeline-metrics, generation-events]
tech-stack:
  added: []
  patterns: [classifyDomainRefunds shared helper, mockFromImplementation for multi-query mocks]
key-files:
  created: []
  modified:
    - src/lib/metrics/pipeline-metrics.ts
    - src/lib/metrics/index.ts
    - src/lib/metrics/__tests__/pipeline-metrics.test.ts
    - src/app/(app)/admin/metrics/page.tsx
    - src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts
decisions:
  - "classifyDomainRefunds helper: shared across getRefundRate and getVsRefundRate"
  - "deductionCount (denominator) only counts in-window deductions; outside-resolved refunds added to numerator but not denominator"
  - "getVsCreditsRefunded has its own implementation (different from classifyDomainRefunds) because it returns total refunded amount, not rate"
  - "Wallet/Admin section shows only Créditos Concedidos (no Concessões Realizadas)"
  - "No MetricCard.domain field — separate arrays per domain"
metrics:
  duration_minutes: 8
  completed_at: 2026-07-22T13:25:00Z
  tests_total: 37
  tests_new: 19
  files_changed: 5
  commits: 3
---

# Quick Task 260722-i7v: Separar visualmente as métricas por domínio

**One-liner:** Admin dashboard reorganizado em 3 seções visuais (Pipeline de Campanhas, Assinatura Visual, Wallet/Admin) com 6 novas funções de métrica VS, persistência de duration_ms para VS, e correção de referência cross-window para estornos.

## Changes

### Task 1: VS metric functions + cross-window fix + duration_ms

**6 new VS metric functions in `pipeline-metrics.ts`:**
- `getVsSuccessRate` — percentage of "success" status for visual_signature generation events
- `getVsErrorRate` — percentage of "failed" status for visual_signature generation events
- `getVsAvgDuration` — average duration_ms for visual_signature events
- `getVsCreditsConsumed` — SUM(ABS(amount)) for deduction + metadata.feature=visual_signature
- `getVsCreditsRefunded` — SUM(ABS(amount)) for refunds with VS feature, resolved via reference chain for historical refunds
- `getVsRefundRate` — VS-scoped refund rate using shared `classifyDomainRefunds` helper

**Cross-window refund fix:**
- Extracted `classifyDomainRefunds(hours, isDomainDeduction)` shared helper used by both `getRefundRate` and `getVsRefundRate`
- When a refund's reference doesn't match any in-window eligible deduction, performs second query `.in("id", orphanRefs)` with no time filter
- If the referenced deduction is in the domain, the refund is counted (numerator only)
- Returns 0 when denominator=0

**duration_ms persistence:**
- `const startTime = performance.now()` measured before VS generation
- `duration_ms: Math.round(performance.now() - startTime)` passed to both success and failure `insertGenerationEvent` calls

### Task 2: Admin dashboard reorganization

- Page restructured into 3 domain sections with `border-b` headers:
  - **Pipeline de Campanhas** — Taxa de Sucesso, Taxa de Erro, Custo Médio, Tempo Médio, Taxa de Estorno Campanhas, Usuários Ativos
  - **Assinatura Visual** — Taxa de Sucesso VS, Taxa de Erro VS, Tempo Médio VS, Créditos Consumidos VS, Créditos Estornados VS, Taxa de Estorno VS
  - **Wallet/Admin** — Créditos Concedidos (only)
- HealthBanner remains campaign-only (unchanged)
- No `MetricCard.domain` field — separate `buildCampaignCards`, `buildVsCards`, `buildWalletCards` builders per domain
- Precise labels: "Taxa de Estorno Campanhas", "Taxa de Sucesso VS"

### Task 3: Tests

- 19 new test cases added (37 total):
  - 2 VS success rate, 2 VS error rate, 2 VS avg duration
  - 2 VS credits consumed, 3 VS credits refunded
  - 3 VS refund rate, 2 domain isolation
  - 3 cross-window refund reference
- Uses `mockFromImplementation` for multi-query mock scenarios (cross-window tests)

## Deviations from Plan

None — plan executed exactly as written.

### Key design decisions

1. **`getVsCreditsRefunded` vs `classifyDomainRefunds`**: Credits refunded returns total amount, not a rate, so it has its own implementation rather than using `classifyDomainRefunds` (which returns counts for rate calculation).

2. **Denominator source**: Only in-window deductions count toward the denominator for refund rate. Outside-resolved deductions contribute to the refund count but don't inflate the denominator — this prevents rate dilution from historical references.

3. **Cross-window first query safety**: The first cross-window test uses `mockFromImplementation` directly (not `mockSelect`) because `mockSelect`'s open chain can't distinguish first from second query.

## Verification

- ✅ TypeScript clean: `npx tsc --noEmit` passes
- ✅ All 37 tests passing: `npx vitest run src/lib/metrics/__tests__/pipeline-metrics.test.ts`
- ✅ 19 new VS metric tests
- ✅ All 18 existing tests unchanged and passing
- ✅ HealthBanner remains campaign-only

### Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | `c772ffd` | test(quick-260722-i7v): add VS metric tests + cross-window refund tests |
| 1 (GREEN) | `8b7d126` | feat(quick-260722-i7v): implement VS metric functions + cross-window fix + duration_ms |
| 2 | `fe90353` | feat(quick-260722-i7v): reorganize admin dashboard into 3 domain sections |

## Self-Check: PASSED

- ✅ `src/lib/metrics/pipeline-metrics.ts` — 200+ lines, exports all 6 VS functions
- ✅ `src/lib/metrics/index.ts` — exports all new VS functions
- ✅ `src/app/(app)/admin/metrics/page.tsx` — 180+ lines, 3 domain sections
- ✅ `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` — contains duration_ms
- ✅ `src/lib/metrics/__tests__/pipeline-metrics.test.ts` — 500+ lines, 37 tests
- ✅ Commit `c772ffd` exists
- ✅ Commit `8b7d126` exists
- ✅ Commit `fe90353` exists
- ✅ All 37 tests pass
- ✅ TypeScript clean
