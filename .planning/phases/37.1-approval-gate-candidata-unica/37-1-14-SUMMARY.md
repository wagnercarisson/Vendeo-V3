---
phase: 37.1-approval-gate-candidata-unica
plan: 14
subsystem: testing
tags: [regression, fixtures, co-migration, campaign-record, f37]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (tasks.md seção 18, F37.1-25) + CampaignRecord estendido (37-1-04) + flag (37-1-03) + testes 37-1-10/11/12/13
  - phase: fase-43-revisao-brief-pre-geracao
    provides: precedente de regressão e co-migração de fixtures (43-14)
provides:
  - feature-flag-service.test.ts co-migrado (18.3: flag campaign_approval_enabled fail-closed — ok true/false, not-found false, erro false, sem envOverride)
  - admin feature-flags route.test co-migrado (18.4: GET lista campaign_approval_enabled; PUT da nova key com motivo + auditoria F43)
  - Fixtures de CampaignRecord co-migradas (display.test.ts + campaign-detail-page.test.tsx — 4 campos de aprovação)
  - Regressão completa: 2379 testes verdes (255 arquivos) — geração/créditos/legado/flag off inalterados
affects: [37-1-15 (verificação — 4 gates)]

# Tech tracking
tech-stack:
  added: []
  patterns: [fixture co-migration for extended record, fail-closed flag test scenarios, minimal-delta regression fixes]

key-files:
  created: []
  modified: [src/lib/feature-flags/__tests__/feature-flag-service.test.ts, src/app/api/admin/feature-flags/__tests__/route.test.ts, src/__tests__/lib/campaign/display.test.ts, src/__tests__/app/campanhas/campaign-detail-page.test.tsx]

key-decisions:
  - "CampaignRecord estendido (4 campos obrigatórios) → fixtures co-migradas em display.test.ts e campaign-detail-page.test.tsx"
  - "Nova flag campaign_approval_enabled coberta com 5 cenários fail-closed (18.3)"
  - "Nenhuma mudança em código de produção de geração/créditos neste plano (apenas fixtures/testes)"

patterns-established:
  - "Regressão completa: npx vitest run zero falhas após extensão de contrato de CampaignRecord"

requirements-completed: [F37.1-25]

# Metrics
duration: 35min
completed: 2026-09-01
---

# Phase 37.1 Plan 14: Regressão + co-migração de fixtures Summary

**Regressão completa (F37.1-25): `feature-flag-service.test.ts` co-migrado com 5 cenários fail-closed da flag `campaign_approval_enabled` (leitura ok true/false, not-found → false, erro → false, sem envOverride); `admin/feature-flags` route.test co-migrado (GET lista `campaign_approval_enabled` via ALL_FEATURE_FLAG_KEYS; PUT da nova key com motivo obrigatório + RPC genérico F43); fixtures de `CampaignRecord` co-migradas para os 4 campos de aprovação (`display.test.ts` + `campaign-detail-page.test.tsx`); suíte completa verde — 255 arquivos / 2379 testes, geração/créditos/legado/flag off inalterados**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 4 (fixtures/testes — nenhum código de produção de geração/créditos)

## Accomplishments

- **Task 1 — Co-migrar feature-flag-service.test.ts (18.3) + admin feature-flags route.test.ts (18.4):**
  - **18.3** (novo describe "isCampaignApprovalEnabled (F37.1 D1, fail-closed)"): 5 cenários — leitura ok `enabled: true` → true; `enabled: false` → false; not-found (`data: null`) → false (fallback); erro de leitura → false; assert de que NENHUMA env var é consultada (sem envOverride — `readFlag(key, false)` com 2 args)
  - **18.4**: GET co-migrado — a lista mockada agora inclui `campaign_approval_enabled` (3 flags, length 3); novo teste "PUT da nova flag campaign_approval_enabled funciona com motivo obrigatório (RPC genérico, F43)" — assert de `admin_update_feature_flag` com `p_key: "campaign_approval_enabled"` + motivo + auditoria; **sem novo RPC/CHECK/action**
- **Task 2 — Co-migrar fixtures de CampaignRecord (18.5) + regressão completa (18.6):**
  - `display.test.ts`: fixture `mockCampaign` + 4 fixtures inline de `getEffectivePublicationCopy` receberam os 4 campos obrigatórios (`approval_status: "pending_approval"`, `rejection_count: 0`, `approved_version_id: null`, `approved_at: null`) → typecheck limpo
  - `campaign-detail-page.test.tsx`: co-migrado para a derivação de approval do page.tsx — mock de `@/lib/supabase/server` com `supabaseAdmin` stub; mocks de `isCampaignApprovalEnabled` (default false), `listArtVersions` (default `[]`), `computeApprovalState` (default not_enabled) e `getActiveCandidateArtVersion` (default null) → 6/6 PASS
  - **Regressão completa:** `npx vitest run` → **255/255 arquivos, 2379/2379 testes PASS** (base F43 = 2317 + ~62 novos da fatia; "Not implemented: Window's scrollTo()" é warning inofensivo de jsdom)
  - Nenhuma mudança em código de produção de geração/créditos (grep/diff confirmado) — apenas fixtures/testes

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Co-migrar feature-flag-service.test.ts (18.3) + admin feature-flags route.test.ts (18.4)** - `168c3e8c` (test)
2. **Task 2: Co-migrar fixtures de CampaignRecord (18.5) + regressão completa (18.6)** - `168c3e8c` (test, mesmo commit)

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/lib/feature-flags/__tests__/feature-flag-service.test.ts` - 5 cenários fail-closed da nova flag
- `src/app/api/admin/feature-flags/__tests__/route.test.ts` - GET co-migrado (3 flags) + PUT da nova key
- `src/__tests__/lib/campaign/display.test.ts` - Fixtures CampaignRecord com 4 campos de aprovação
- `src/__tests__/app/campanhas/campaign-detail-page.test.tsx` - Mocks da derivação de approval (page.tsx)

## Decisions Made

- CampaignRecord estendido (interface-first, 37-1-04) exige co-migração de todas as fixtures que o constroem — feita em `display.test.ts` e `campaign-detail-page.test.tsx`
- Flag fail-closed coberta em 5 cenários (18.3) — leitura ok/not-found/erro/sem envOverride
- Admin muta a nova flag via RPC genérico `admin_update_feature_flag` (motivo obrigatório + auditoria atômica — F43) sem novo RPC/CHECK/action

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito. Adicionada co-migração do arquivo `campaign-detail-page.test.tsx` (não listado explicitamente nos files_modified do plano, mas necessário — a derivação de approval do page.tsx 37-1-09 quebrou seu mock de supabase sem `supabaseAdmin`; mínimo delta).

## Issues Encountered

- `campaign-detail-page.test.tsx`: mock de `@/lib/supabase/server` sem `supabaseAdmin` + sem mocks da derivação → erro "No supabaseAdmin export" e depois "No computeApprovalState export"; resolvido com co-migração mínima (supabaseAdmin stub + mocks de flag/display)
- Suíte completa: 2379/2379 PASS; warning `scrollTo()` é do jsdom (inofensivo)

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- Regressão completa verde (255 arquivos / 2379 testes) — geração/créditos/legado/flag off inalterados
- Flag fail-closed e admin da nova flag cobertos por teste
- Próximo: **37-1-15** (verificação final — 4 gates: vitest/typecheck/lint/build + VERIFICATION.md + UAT.md com checkpoint humano)

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
