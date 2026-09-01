---
phase: 37.1-approval-gate-candidata-unica
plan: 04
subsystem: api
tags: [campaign, types, persistence, art-versions, f37]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (design.md D5/D7, spec campaign-art-versions "Tipos de domínio" e "Persistência de versões") + migration campaign_art_versions (37-1-02)
  - phase: fase-39-brief-estruturado-campanha
    provides: CampaignBriefSnapshot/campaign_brief_v1 (brief_snapshot jsonb da versão)
provides:
  - Tipos CampaignApprovalStatus, ArtVersionStatus, interface CampaignArtVersion (13 campos) + CampaignRecord estendido (approval_status, rejection_count, approved_version_id, approved_at)
  - Persistência createArtVersion(campaignId, versionNumber, storagePath, briefSnapshot) — INSERT pending/active
  - Persistência listArtVersions(campaignId) — ordenada por version_number; [] para legacy
  - NENHUMA função de correção criada (markVersionRejected/discardArtAsset/setCorrectionInProgress — 37.2)
affects: [37-1-05 (display), 37-1-06 (generate-image v1), 37-1-07 (gates), 37-1-08 (rota approve), 37-1-10 (testes), 37-1-14 (co-migração fixtures)]

# Tech tracking
tech-stack:
  added: []
  patterns: [interface-first domain contract, persistence functions with supabaseAdmin insert/select + throw on error]

key-files:
  created: []
  modified: [src/lib/campaign/types.ts, src/lib/campaign/persistence.ts]

key-decisions:
  - "CampaignRecord estendido com 4 campos obrigatórios (approval_status/rejection_count/approved_version_id/approved_at) — fixtures de teste quebram até a co-migração (37-1-14)"
  - "createArtVersion v1 nasce pending/active; render_snapshot/generation_metadata/rejection_reason NULL na 37.1 (D4)"
  - "listArtVersions ordena por version_number — fonte única do estado e da tela (decisão 3)"

patterns-established:
  - "Extensão de domínio via interface-first: tipos novos exportados + extensão de CampaignRecord + persistência com supabaseAdmin"

requirements-completed: [F37.1-09, F37.1-10]

# Metrics
duration: 20min
completed: 2026-09-01
---

# Phase 37.1 Plan 04: Tipos + Persistência das versões de arte Summary

**Contrato de dados da fatia (interface-first, D5/D7): tipos `CampaignApprovalStatus`, `ArtVersionStatus` e a interface `CampaignArtVersion` (13 campos do spec) em `types.ts`, `CampaignRecord` estendido com `approval_status`/`rejection_count`/`approved_version_id`/`approved_at`, e persistência `createArtVersion` (INSERT v1 pending/active) + `listArtVersions` (ordenada por `version_number`, [] para legacy) em `persistence.ts` — sem nenhuma função de correção (37.2)**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 2 (src/lib/campaign/types.ts, src/lib/campaign/persistence.ts)

## Accomplishments

- **Task 1 — Tipos (D5/D7, spec campaign-art-versions):**
  - `export type CampaignApprovalStatus = "pending_approval" | "approved";`
  - `export type ArtVersionStatus = "pending" | "approved" | "rejected";`
  - `export interface CampaignArtVersion` com TODOS os 13 campos do contrato: id, campaign_id, version_number (1..3), status, storage_path nullable, asset_status "active"|"discarded", asset_deleted_at nullable, brief_snapshot Record<string,unknown> (campaign_brief_v1, sem base64), render_snapshot nullable, generation_metadata nullable, rejection_reason nullable, correction_in_progress boolean (decisão 5 — inalcançável na 37.1), created_at
  - `CampaignRecord` estendido com os 4 campos obrigatórios: `approval_status: CampaignApprovalStatus`, `rejection_count: number`, `approved_version_id: string | null`, `approved_at: string | null`
  - **NENHUM tipo de correção criado** (`RejectionReason`/`ArtCorrectionStrategy`/`BriefPatch`/`CorrectionIntent` — grep zero, 37.2/37.3)
- **Task 2 — Persistência (D5, spec campaign-art-versions):**
  - `createArtVersion(campaignId, versionNumber, storagePath, briefSnapshot): Promise<void>` — INSERT em `campaign_art_versions` com `status: "pending"`, `asset_status: "active"`, `storage_path`, `brief_snapshot`; `if (error) throw new Error(error.message)`; comentário documentando que render_snapshot/generation_metadata/rejection_reason ficam NULL na 37.1 (D4)
  - `listArtVersions(campaignId): Promise<CampaignArtVersion[]>` — `select("*").eq("campaign_id", ...).order("version_number", { ascending: true })`; retorna `(data ?? []) as CampaignArtVersion[]` (lista vazia → estado legacy)
  - **NENHUMA função de correção criada** (`markVersionRejected`/`discardArtAsset`/`setCorrectionInProgress` — grep zero, 37.2)
  - Import de `CampaignArtVersion` adicionado ao import existente de `./types`
- **Verificação de aceitação:** grep de tipos presentes (CampaignApprovalStatus/ArtVersionStatus/CampaignArtVersion + 7 marcadores da interface) e zero tipos de correção; grep de `createArtVersion`/`listArtVersions`/`status: "pending"`/`asset_status: "active"`/`order("version_number")` presentes e zero funções de correção; `npx vitest run src/__tests__/lib/campaign/persistence.test.ts` (19/19 PASS); typecheck com erros **apenas** em `src/__tests__/lib/campaign/display.test.ts` (fixtures antigas construindo CampaignRecord sem os 4 campos — co-migração prevista no plano 37-1-14; nenhum erro em código de produção).

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Types — CampaignApprovalStatus, ArtVersionStatus, CampaignArtVersion, extensão de CampaignRecord** - `c7cad0e5` (feat)
2. **Task 2: Persistência — createArtVersion + listArtVersions** - `c7cad0e5` (feat, mesmo commit)

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/lib/campaign/types.ts` - Tipos de domínio das versões + extensão de CampaignRecord
- `src/lib/campaign/persistence.ts` - createArtVersion + listArtVersions

## Decisions Made

- `CampaignRecord` estendido com 4 campos **obrigatórios** (interface-first) — quebra de fixtures de teste esperada até a co-migração (37-1-14)
- `createArtVersion` v1 nasce `pending`/`active` (candidata da revisão); snapshots opcionais NULL na 37.1 (D4)
- `listArtVersions` ordenada por `version_number` (fonte única do estado de aprovação e da tela — decisão 3)

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito. Typecheck com falhas apenas nas fixtures de teste (esperado e documentado: co-migração no 37-1-14).

## Issues Encountered

- `src/__tests__/lib/campaign/display.test.ts` quebra no typecheck (fixture `CampaignRecord` sem os 4 campos novos) — **esperado** pelo plano (Task 1 acceptance criteria); co-migração no plano 37-1-14

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- Contrato de dados pronto (interface-first) — consumido por 37-1-05 (display), 37-1-06 (generate-image v1), 37-1-07 (gates), 37-1-08 (rota approve) e 37-1-09 (UI)
- Persistência funcional: createArtVersion (candidata pending/active) + listArtVersions (ordenada, [] para legacy)
- Próximo: **37-1-05** (`ApprovalDisplayState` + `computeApprovalState` + `isDeliveryReleased` + candidata ativa em `display.ts`)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
