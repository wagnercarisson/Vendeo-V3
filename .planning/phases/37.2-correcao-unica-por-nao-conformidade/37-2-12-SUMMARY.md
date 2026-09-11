---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 12
subsystem: admin
tags: [admin, server-components, f37.2, audit]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 05
    provides: listCorrectionReports/getCorrectionReportDetail/markReportReviewedBySupport
provides:
  - lista /admin/campaign-reports
  - detalhe /admin/campaign-reports/[reportId] (v1×v2 + histórico)
  - rota admin de marcação revisado + link no layout
affects: [37-2-17 (testes admin)]

# Tech tracking
tech-stack:
  added: []
  patterns: [server components admin com requireAdmin, filtros/paginação via searchParams + Link, signed URLs service_role]

key-files:
  created:
    - src/app/(app)/admin/campaign-reports/page.tsx
    - src/app/(app)/admin/campaign-reports/[reportId]/page.tsx
    - src/app/api/admin/campaign-reports/[reportId]/route.ts
    - src/components/admin/campaign-report-reviewed.tsx
  modified: [src/app/(app)/admin/layout.tsx]

key-decisions:
  - "Decisão corrente = analysis_state da tentativa de maior attempt_number (resolvido no serviço)"
  - "Detalhe usa detail.signedUrls (service_role, geradas via generateSignedPreviewUrl) incluindo v1 superseded"
  - "Marcação revisado ortogonal — só reviewed_by_support_at/_user"
  - "consume (rejection_count) derivado do status do caso (open=0; demais=1)"

patterns-established:
  - "Fila admin auditável com v1×v2 lado a lado e histórico determinístico por attempt_number"

requirements-completed: [F37.2-12]

# Metrics
duration: 45min
completed: 2026-09-10
---

# Phase 37.2 Plan 12: Fila Admin de Relatos Summary

**Fila administrativa `/admin/campaign-reports` (lista com filtros/paginação + decisão corrente por attempt_number), detalhe v1×v2 com histórico e operation_run_id linkável, marcação ortogonal "revisado pelo suporte" e link no layout admin**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3 (+1 componente client)
- **Files modified:** 5

## Accomplishments

- **Task 1 — Lista:** `/admin/campaign-reports` (server, `requireAdmin` em try/catch, `force-dynamic`); `listCorrectionReports({ filters, page })`; colunas campanha/loja/status/decisão corrente (maior `attempt_number`)/v1/v2/data/revisado; filtros status/analysisState/reviewed + paginação via `<Link>`.
- **Task 2 — Detalhe:** `/admin/campaign-reports/[reportId]` com `getCorrectionReportDetail`; grid de status/consumo/`operation_run_id` linkável a `/admin/ai-operation-costs?operationRunId=…`; aprovação derivada de `campaigns.approved_version_id`; **v1 × v2 lado a lado** com signed URLs (incl. v1 `superseded`); **histórico por `attempt_number`** (texto → estado → categoria → instrução → timestamps).
- **Task 3 — Marcação + link:** rota `POST /api/admin/campaign-reports/[reportId]` (`requireAdmin` + `requireSameOrigin` + UUID) chamando `markReportReviewedBySupport` (ortogonal); componente client `CampaignReportReviewed`; link "Relatos de correção" no layout admin.

## Task Commits

1. **Tasks 1-3 + componente** — `227b38c6` (feat)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/app/(app)/admin/campaign-reports/page.tsx` — lista/filtros/paginação
- `src/app/(app)/admin/campaign-reports/[reportId]/page.tsx` — detalhe v1×v2 + histórico
- `src/app/api/admin/campaign-reports/[reportId]/route.ts` — marcação revisado
- `src/components/admin/campaign-report-reviewed.tsx` — botão client
- `src/app/(app)/admin/layout.tsx` — link na nav

## Decisions Made

- `consume`/`rejection_count` derivado do status do caso (open=0; demais=1) — o relato não espelha a aprovação.
- Signed URLs vêm de `detail.signedUrls` (service_role) geradas no serviço via `generateSignedPreviewUrl`.

## Deviations from Plan

Nenhuma funcional. **Arquivo extra necessário:** `src/components/admin/campaign-report-reviewed.tsx` (botão client para a marcação) — o PLAN lista 4 arquivos, mas a UI de marcação exige um client component (padrão `AccessRequestActions`).

## Issues Encountered

Nenhum bloqueio. Typecheck limpo; gates verdes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Fila admin pronta; testes (37-2-17) e regressão (37-2-18) seguem.
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
