---
phase: 37.1-approval-gate-candidata-unica
plan: 05
subsystem: api
tags: [campaign, display, approval-state, gating, f37]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (design.md D2 + decisões 3/5, spec campaign-approval-gate) 
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: CampaignRecord estendido + CampaignArtVersion (37-1-04)
provides:
  - ApprovalDisplayState (5 variantes: not_enabled/legacy/pending/approved/regenerating)
  - computeApprovalState(campaign, versions, flagEnabled) — derivação na ordem do D2
  - isDeliveryReleased(state) — true: not_enabled/legacy/approved; false: pending/regenerating
  - getActiveCandidateArtVersion(versions) — candidata ativa (decisão 3)
  - CampaignPageProps.approval (contrato de tipo para a UI 37-1-09)
affects: [37-1-07 (gates download/copy), 37-1-08 (rota approve — usa estado), 37-1-09 (UI/page), 37-1-10 (testes estados), 37-1-14 (regressão)]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure state derivation functions, discriminated union display state, fail-closed delivery gate]

key-files:
  created: []
  modified: [src/lib/campaign/display.ts]

key-decisions:
  - "regenerating entra no contrato (derivado de correction_in_progress) mas é inalcançável na 37.1 — nenhum fluxo escreve true (decisão 5)"
  - "computeApprovalState NÃO deriva de campaign.status (decisão 5 — permanece generating|ready|error)"
  - "Fonte oficial da arte = candidata ativa (asset_status='active', decisão 3); legado/aprovada usam campaigns.storage_path"

patterns-established:
  - "Estado de aprovação puro e derivado (single source campaign_art_versions + campaigns) — consumido por gates, rota e UI"

requirements-completed: [F37.1-11, F37.1-12, F37.1-13, F37.1-14]

# Metrics
duration: 22min
completed: 2026-09-01
---

# Phase 37.1 Plan 05: Estado de aprovação + gating Summary

**Núcleo lógico da fatia (D2 + decisões 3/5) em `display.ts`: `ApprovalDisplayState` (5 variantes), `computeApprovalState` (derivação na ordem: not_enabled → legacy → approved → regenerating → pending, sem `campaign.status`), `isDeliveryReleased` (true: not_enabled/legacy/approved; false: pending/regenerating — fail-closed), `getActiveCandidateArtVersion` (candidata ativa, decisão 3) e `CampaignPageProps.approval` (contrato da UI)**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 1 (src/lib/campaign/display.ts)

## Accomplishments

- **Task 1 — ApprovalDisplayState + computeApprovalState + isDeliveryReleased (D2):**
  - `export type ApprovalDisplayState` — união discriminada com as 5 variantes EXATAS do design.md D2: `{ status: "not_enabled" }`, `{ status: "legacy" }`, `{ status: "pending" }`, `{ status: "approved"; approvedAt: string }`, `{ status: "regenerating" }`
  - `export function computeApprovalState(campaign: CampaignRecord, versions: CampaignArtVersion[], flagEnabled: boolean): ApprovalDisplayState` — ordem de derivação: `!flagEnabled → not_enabled`; `versions.length === 0 → legacy`; `campaign.approved_version_id != null → approved` (approvedAt = `approved_at ?? ""`); candidata ativa com `correction_in_progress === true → regenerating` (inalcançável na 37.1 — contrato reservado, decisão 5); senão `pending`. **NÃO referencia `campaign.status`** (decisão 5 — permanece generating|ready|error)
  - `export function isDeliveryReleased(state): boolean` — switch explícito: `true` para not_enabled/legacy/approved; `false` para pending/regenerating
- **Task 2 — Candidata ativa + contrato da UI (decisão 3):**
  - `export function getActiveCandidateArtVersion(versions): CampaignArtVersion | null` — primeira linha com `asset_status === "active"`, senão null (legado: `campaigns.storage_path`; aprovada: `campaigns.storage_path` repontado no approve — D8)
  - `CampaignPageProps` estendido com `approval?: { state: ApprovalDisplayState; candidateImageUrl?: string | null; candidateVersionId?: string | null }`
  - `mapCampaignToProps` **inalterado** (sem derivação de approval — a derivação acontece na página, plano 37-1-09)
- **Verificação de aceitação:** grep de `ApprovalDisplayState`/`computeApprovalState`/`isDeliveryReleased` presentes + 5 variantes presentes; confirmação por leitura de que `computeApprovalState` não usa `campaign.status`; grep de `getActiveCandidateArtVersion`/`approval?:`/`candidateImageUrl`/`candidateVersionId` presentes; `mapCampaignToProps` sem `approval`; typecheck com erros **apenas** em `src/__tests__/lib/campaign/display.test.ts` (fixtures antigas — co-migração 37-1-14; nenhum erro de produção).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: ApprovalDisplayState + computeApprovalState + isDeliveryReleased** - `3f3ea4e4` (feat)
2. **Task 2: Helper da candidata ativa + extensão de CampaignPageProps com approval** - `3f3ea4e4` (feat, mesmo commit)

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/lib/campaign/display.ts` - Estado de aprovação + gating + candidata ativa + contrato approval

## Decisions Made

- `regenerating` no contrato do módulo (derivado de `correction_in_progress`), inalcançável na 37.1 — preserva `isDeliveryReleased` para a 37.2 (decisão 5)
- Derivação NÃO usa `campaign.status` (decisão 5 — o enum `generating|ready|error` não representa correção)
- Candidata ativa (`asset_status='active'`) = fonte oficial da arte da revisão (decisão 3)

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito. Typecheck com falhas apenas nas fixtures de teste (esperado; co-migração no 37-1-14).

## Issues Encountered

- `src/__tests__/lib/campaign/display.test.ts` quebra no typecheck (fixture `CampaignRecord` sem os 4 campos novos) — **esperado**; co-migração no plano 37-1-14

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- Núcleo lógico da fatia pronto e puro (testável sem banco) — base dos gates (37-1-07), da rota approve (37-1-08) e da página (37-1-09)
- isDeliveryReleased fail-closed: entrega preservada para not_enabled/legacy/approved; apenas pending/regenerating bloqueiam
- Próximo: **37-1-06** (generate-image insere v1 quando a flag está ligada — fail-safe)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
