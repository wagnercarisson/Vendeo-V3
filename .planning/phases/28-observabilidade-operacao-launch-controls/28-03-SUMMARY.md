# 28-03: Pipeline Metrics + Admin Dashboard + Documentation

**Status:** ✅ Completed
**Commit:** `24d2359`

## Deliverables

- `src/lib/metrics/types.ts` — `HealthState`, `TimeRange`, `MetricCard` types
- `src/lib/metrics/pipeline-metrics.ts` — 7 query functions via supabaseAdmin
- `src/lib/metrics/health.ts` — `computeHealthState()` with 5-indicator thresholds
- `src/lib/metrics/index.ts` — barrel export
- `src/lib/metrics/__tests__/pipeline-metrics.test.ts` — 10 tests
- `src/lib/metrics/__tests__/health.test.ts` — 4 tests
- `src/app/(app)/admin/metrics/page.tsx` — SSR page with admin guard, 3 time periods
- `src/app/(app)/admin/metrics/health-banner.tsx` — Client component (green/yellow/red)
- `src/app/(app)/admin/metrics/metrics-cards.tsx` — Client component with BRL formatting
- `src/app/(app)/admin/layout.tsx` — Added "Métricas" nav link
- `docs/operations/deploy-checklist.md` — Pre-reqs, deploy steps, rollback
- `docs/operations/support-runbook.md` — Credit grant, refund, cleanup, health procedures
- `docs/operations/environment-variables.md` — Complete env vars catalog

## Commits

- `24d2359` — feat(28-03): pipeline metrics + admin dashboard + operations docs

## Design Decisions

- Cost displayed in BRL using `VENDEO_USD_BRL_RATE` (default 5.50)
- Health state = worst-case across 5 indicators (success rate, error rate, avg cost, avg duration, refund rate)
- Cards show "N/D" for null/empty values (graceful when no data yet)
