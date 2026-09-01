---
phase: 37.1-approval-gate-candidata-unica
plan: 10
subsystem: testing
tags: [approval-state, tests, display, f37]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (tasks.md seção 13, spec campaign-approval-gate) + computeApprovalState/isDeliveryReleased (37-1-05) + CampaignRecord/CampaignArtVersion (37-1-04) + migration 20260901000001 (37-1-02)
provides:
  - Testes 13.1-13.7 dos estados de aprovação (funções puras, sem banco)
  - Constraint 1-approved ancorada na fonte da migration (13.6)
  - Contrato regenerating + campaign.status ready (13.7, decisão 5)
affects: [37-1-14 (regressão), 37-1-15 (verificação)]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure function unit tests with local fixtures, source-anchored constraint assertion (readFileSync migration)]

key-files:
  created: [src/__tests__/lib/campaign/display-approval.test.ts]
  modified: []

key-decisions:
  - "Teste 13.6 (índice único parcial) por FONTE (lê a migration SQL) — testes unitários sem banco; constraint real aplicada no remoto via db push (37-1-02)"
  - "Teste 13.7 exercita o ESTADO regenerating (função pura), NÃO um fluxo — correção é 37.2 (decisão do usuário 2026-09-01: nenhum fluxo exercita, mas testes de contrato puro são permitidos)"

patterns-established:
  - "Teste de estado derivado: fixtures mínimas de CampaignRecord/CampaignArtVersion + asserção de fonte para constraints de banco"

requirements-completed: [F37.1-24]

# Metrics
duration: 16min
completed: 2026-09-01
---

# Phase 37.1 Plan 10: Testes dos estados de aprovação Summary

**Testes 13.1-13.7 dos estados de aprovação (tasks.md seção 13): `computeApprovalState` (flag off → not_enabled; flag on + zero versões → legacy; versões sem aprovada → pending; approved_version_id → approved+approvedAt), `isDeliveryReleased` (true para not_enabled/legacy/approved; false para pending/regenerating), índice único parcial ancorado por FONTE na migration (13.6) e contrato `regenerating` + `campaign.status` ready (13.7, decisão 5) — 7/7 testes verdes, funções puras sem banco**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 1 (src/__tests__/lib/campaign/display-approval.test.ts — criado)

## Accomplishments

- **Task 1 — Testes 13.1-13.5 (estados + isDeliveryReleased):**
  - Fixtures `campaignReady(overrides?)` (CampaignRecord com os 4 campos de aprovação: `approval_status: "pending_approval"`, `rejection_count: 0`, `approved_version_id: null`, `approved_at: null`) e `versionV1(overrides?)` (CampaignArtVersion `version_number: 1`, `status: "pending"`, `asset_status: "active"`, `correction_in_progress: false`, `storage_path`, `brief_snapshot: {}`)
  - **13.1:** `computeApprovalState(campaignReady(), [], false)` → `{ status: "not_enabled" }`
  - **13.2:** `computeApprovalState(campaignReady(), [], true)` → `{ status: "legacy" }`
  - **13.3:** `computeApprovalState(campaignReady(), [versionV1()], true)` → `{ status: "pending" }`
  - **13.4:** `computeApprovalState(campaignReady({ approved_version_id, approved_at, approval_status: "approved" }), [versionV1({ status: "approved" })], true)` → `{ status: "approved", approvedAt: "2026-09-01T10:00:00Z" }`
  - **13.5:** `isDeliveryReleased` → true para not_enabled/legacy/approved; false para pending/regenerating
- **Task 2 — Teste 13.6 (fonte) + 13.7 (contrato regenerating):**
  - **13.6:** lê `supabase/migrations/20260901000001_f37_1_create_campaign_art_versions.sql` via `readFileSync` (node:fs) e asserta que contém `campaign_art_versions_one_approved_per_campaign` e `WHERE status = 'approved'` (constraint real aplicada no remoto via db push 37-1-02; unit tests sem banco)
  - **13.7:** `computeApprovalState(campaignReady(), [versionV1({ correction_in_progress: true })], true)` → `{ status: "regenerating" }` E asserta que `campaign.status` permanece `"ready"` (função NÃO altera campaign e não deriva de status) — exercita o ESTADO puro, não fluxo de correção (37.2)
  - Garantido que NENHUM teste importa `setCorrectionInProgress`/`markVersionRejected`/`discardArtAsset` (grep zero)
- **Verificação de aceitação:** `npx vitest run src/__tests__/lib/campaign/display-approval.test.ts` — **7/7 PASS**; shapes assertados presentes (not_enabled/legacy/pending/approved/regenerating); teste 13.6 lê a migration e asserta as 2 strings; teste 13.7 asserta regenerating + status ready; zero funções de correção importadas.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Testes 13.1-13.5 — estados + isDeliveryReleased** - `5dfddfad` (test)
2. **Task 2: Teste 13.6 (índice único parcial via fonte) + 13.7 (contrato regenerating/campaigns.status)** - `5dfddfad` (test, mesmo commit)

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/__tests__/lib/campaign/display-approval.test.ts` - Testes 13.1-13.7 dos estados de aprovação

## Decisions Made

- Constraint 1-approved verificada por FONTE (migration SQL) nos testes unitários — sem banco; db push real no remoto (37-1-02) aplica a constraint de fato
- Teste 13.7 cobre o estado `regenerating` como contrato puro (decisão do usuário 2026-09-01) — sem exercitar fluxo de correção (37.2)

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered

Nenhum - 7/7 testes PASS na primeira execução.

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- Núcleo lógico da fatia provado por teste unitário puro (sem banco)
- Constraint 1-approved ancorada na migration (fonte + db push real)
- Próximo: **37-1-11** (testes da rota approve — 14.1-14.4: RPC transacional via fonte, mapeamento de erros, guards)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
