---
phase: 37.2-correcao-unica-por-nao-conformidade
plan: 05
subsystem: campaign
tags: [types, persistence, f37.2, correction, admin]

# Dependency graph
requires:
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 02
    provides: tabelas campaign_correction_reports/_submissions
  - phase: 37.2-correcao-unica-por-nao-conformidade
    plan: 03
    provides: RPC complete_campaign_correction_analysis
provides:
  - tipos CorrectionReportStatus/CorrectionAnalysisState/CorrectionReport/CorrectionSubmission + ArtAssetStatus superseded
  - CampaignRecord.operation_run_id (evita TS2339)
  - correction-reports.ts (leitura/escrita + consultas admin + marcação revisado)
affects: [37-2-06, 37-2-07, 37-2-08, 37-2-11, 37-2-12, testes 14-17]

# Tech tracking
tech-stack:
  added: []
  patterns: [persistência server-only via supabaseAdmin, conclusão de análise via RPC (nunca UPDATE TS direto), decisão corrente por attempt_number]

key-files:
  created: [src/lib/campaign/correction-reports.ts]
  modified: [src/lib/campaign/types.ts, src/__tests__/lib/campaign/display.test.ts, src/__tests__/lib/campaign/display-approval.test.ts]

key-decisions:
  - "Conclusão da análise SEMPRE via rpc complete_campaign_correction_analysis (guarda atômica), nunca UPDATE TS direto"
  - "Decisão corrente = tentativa de maior attempt_number; filtro por analysis_state aplicado após resolver a decisão corrente"
  - "Aprovação derivada de campaigns.approved_version_id/approved_at (nunca espelhada no relato)"

patterns-established:
  - "Artefato de correção: pai 1/campanha + filha 1:N sem campaign_id; signed URLs service_role incluem v1 superseded"

requirements-completed: [F37.2-05]

# Metrics
duration: 40min
completed: 2026-09-10
---

# Phase 37.2 Plan 05: Tipos + Persistência do Caso de Correção Summary

**Tipos de domínio (CorrectionReport/CorrectionSubmission/estados + ArtAssetStatus `superseded` + CampaignRecord.operation_run_id) e módulo `correction-reports.ts` com leitura/escrita, conclusão de análise via RPC, consultas admin com decisão corrente por attempt_number e marcação ortogonal revisado**

## Performance

- **Duration:** 40 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3
- **Files modified:** 4 (1 novo + 3 modificados)

## Accomplishments

- **Task 1 — Tipos:** `ArtAssetStatus = "active" | "discarded" | "superseded"`; `CorrectionReportStatus`; `CorrectionAnalysisState`; `CorrectionReport` (12 colunas do pai); `CorrectionSubmission` (10 colunas da filha, **sem `campaign_id`**); `CampaignRecord.operation_run_id: string | null`.
- **Task 2 — Persistência base:** `getCorrectionReport`, `listCorrectionSubmissions` (ordem `attempt_number` asc), `createCorrectionReport`, `completeCorrectionAnalysis` (via `rpc("complete_campaign_correction_analysis", ...)` — nunca UPDATE TS direto).
- **Task 3 — Admin + revisado:** `listCorrectionReports` (filtros status/revisado + decisão corrente por `attempt_number` + filtro `analysisState` + paginação), `getCorrectionReportDetail` (relato + submissões + versões v1/v2 incl. `superseded` + signed URLs + aprovação **derivada** de `campaigns`), `markReportReviewedBySupport` (só `reviewed_by_support_at`/`_user`). Invariantes documentadas em comentário.

## Task Commits

1. **Task 1: tipos + co-migração de fixtures** — `8f991bc8` (feat)
2. **Task 2 + Task 3: correction-reports.ts** — `6002f1db` (feat)

**Plan metadata:** `(commit do SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/lib/campaign/types.ts` — novos tipos + `ArtAssetStatus` + `CampaignRecord.operation_run_id`
- `src/lib/campaign/correction-reports.ts` — módulo de persistência/consultas do caso
- `src/__tests__/lib/campaign/display.test.ts` / `display-approval.test.ts` — co-migração dos fixtures (`operation_run_id: null`)

## Decisions Made

- Conclusão da análise via RPC (atômica) — o serviço nunca faz UPDATE TS na filha.
- Filtro por `analysis_state` da tentativa vigente aplicado após resolver a decisão corrente (resolução por `attempt_number`).
- Detalhe admin gera signed URLs service_role para todas as versões, incluindo a v1 `superseded` (path preservado).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixtures de `CampaignRecord` sem o novo campo obrigatório `operation_run_id`**
- **Found during:** verificação `npm run typecheck` (Task 1)
- **Issue:** adicionar `operation_run_id` obrigatório a `CampaignRecord` quebrou fixtures existentes (`display.test.ts`, `display-approval.test.ts`) com TS2322/TS2741/TS2345.
- **Fix:** adicionado `operation_run_id: null` aos fixtures (mockCampaign + campaignReady + 4 literais inline).
- **Files modified:** `src/__tests__/lib/campaign/display.test.ts`, `src/__tests__/lib/campaign/display-approval.test.ts`
- **Verification:** `npm run typecheck` limpo; `npx vitest run src/__tests__/lib/campaign` → 94/94.
- **Committed in:** `8f991bc8`.

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Co-migração necessária para o typecheck; sem scope creep.

## Issues Encountered

Nenhum bloqueio. A co-migração de fixtures foi resolvida no próprio plano.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tipos + persistência prontos para o `CorrectionIntentService` (37-2-06), rota `problem-report` (37-2-07), geração da v2 (37-2-08), página (37-2-11) e admin (37-2-12).
- Nenhum bloqueio.

---

*Phase: 37.2-correcao-unica-por-nao-conformidade*
*Completed: 2026-09-10*
