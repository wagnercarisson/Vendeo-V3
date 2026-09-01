---
phase: 37.1-approval-gate-candidata-unica
plan: 03
subsystem: api
tags: [feature-flag, feature-flag-service, fail-closed, f37, admin]

# Dependency graph
requires:
  - phase: fase-37-1-approval-gate-candidata-unica
    provides: OpenSpec F37.1 base (design.md D1, spec feature-flag-control) + migration seed campaign_approval_enabled=false (37-1-02)
  - phase: fase-43-revisao-brief-pre-geracao
    provides: infra feature_flags + FeatureFlagService + ALL_FEATURE_FLAG_KEYS + RPC admin_update_feature_flag (padrão F43)
provides:
  - Constante CAMPAIGN_APPROVAL_ENABLED_KEY = "campaign_approval_enabled" + inclusão em ALL_FEATURE_FLAG_KEYS
  - Método isCampaignApprovalEnabled(): Promise<boolean> → readFlag(key, false) fail-closed SEM envOverride
  - Export de conveniência isCampaignApprovalEnabled()
  - Flag listada na tela "Controles operacionais" e no GET /api/admin/feature-flags automaticamente (sem novo RPC/CHECK)
affects: [37-1-06 (generate-image v1), 37-1-07 (gates download/copy), 37-1-08 (rota approve), 37-1-09 (page), 37-1-14 (regressão)]

# Tech tracking
tech-stack:
  added: []
  patterns: [feature flag fail-closed without envOverride, ALL_FEATURE_FLAG_KEYS canonical order, convenience export per flag]

key-files:
  created: []
  modified: [src/lib/feature-flags/feature-flag-service.ts]

key-decisions:
  - "isCampaignApprovalEnabled fail-closed SEM envOverride (decisão 1 F37.1 — a decisão principal é a tabela; env var seria apenas fail-safe emergencial de infra)"
  - "Posição canônica no ALL_FEATURE_FLAG_KEYS após VISUAL_SIGNATURE_GENERATION_ENABLED_KEY (ordem de exibição no admin)"

patterns-established:
  - "Nova flag operacional = constante + ALL_FEATURE_FLAG_KEYS + método na classe + export de conveniência; admin sem mudança de RPC/CHECK (genérico por key, F43)"

requirements-completed: [F37.1-01, F37.1-02, F37.1-03]

# Metrics
duration: 18min
completed: 2026-09-01
---

# Phase 37.1 Plan 03: Flag campaign_approval_enabled Summary

**Flag `campaign_approval_enabled` adicionada à infraestrutura `feature_flags` (padrão F43/QCW, D1): constante `CAMPAIGN_APPROVAL_ENABLED_KEY = "campaign_approval_enabled"`, inclusão em `ALL_FEATURE_FLAG_KEYS`, método `isCampaignApprovalEnabled(): Promise<boolean>` → `readFlag(key, false)` — fail-closed SEM envOverride — e export de conveniência; flag exibida na tela admin "Controles operacionais" e no `GET /api/admin/feature-flags` automaticamente sem novo RPC/CHECK**

## Performance

- **Duration:** 18 min
- **Started:** 2026-09-01
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 1 (src/lib/feature-flags/feature-flag-service.ts)

## Accomplishments

- **Task 1 — Flag operacional no serviço (D1):**
  - `export const CAMPAIGN_APPROVAL_ENABLED_KEY = "campaign_approval_enabled";` junto às demais constantes (após `VISUAL_SIGNATURE_GENERATION_ENABLED_KEY`)
  - Adicionada a `ALL_FEATURE_FLAG_KEYS` (após `VISUAL_SIGNATURE_GENERATION_ENABLED_KEY` — ordem canônica de exibição no admin)
  - Método `isCampaignApprovalEnabled(): Promise<boolean>` na classe → `this.readFlag(CAMPAIGN_APPROVAL_ENABLED_KEY, false)` — **fail-closed** (falha/not-found → false → comportamento atual), **SEM envOverride** (decisão 1: a decisão principal é a tabela; env var seria apenas fail-safe emergencial de infra)
  - Export de conveniência `export async function isCampaignApprovalEnabled(): Promise<boolean>` junto aos demais exports
  - Nenhum outro método/constante/comportamento alterado
- **Task 2 — Verificação admin (F37.1-03, verification-only):**
  - `GET /api/admin/feature-flags` filtra por `.in("key", [...ALL_FEATURE_FLAG_KEYS])` → a nova key entra automaticamente (leitura de código confirmada; **nenhuma edição** em `route.ts`/`page.tsx`)
  - `PUT` usa o RPC genérico `admin_update_feature_flag` por `key` (motivo obrigatório + auditoria atômica — F43), sem mudança de RPC/CHECK/action
  - Tela "Controles operacionais" renderiza as flags do GET (exibição automática)
- **Verificação de aceitação:** `grep CAMPAIGN_APPROVAL_ENABLED_KEY` = 3 ocorrências (constante + array + método); array contém a key; `readFlag(CAMPAIGN_APPROVAL_ENABLED_KEY, false)` com 2 args (sem envOverride); export de conveniência presente; `npx vitest run src/lib/feature-flags/__tests__/feature-flag-service.test.ts` (14/14 PASS) e `npx vitest run src/app/api/admin/feature-flags/__tests__/route.test.ts` (4/4 PASS); `npm run typecheck` (tsc -p tsconfig.typecheck.json --noEmit) exit 0.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Constante + ALL_FEATURE_FLAG_KEYS + método isCampaignApprovalEnabled + export de conveniência** - `486bf666` (feat)
2. **Task 2: Verificação admin — nova flag listada sem novo RPC/CHECK (F37.1-03)** - verificação only, incluída no commit da Task 1

**Plan metadata:** `(commit deste SUMMARY)` (docs: complete plan)

## Files Created/Modified

- `src/lib/feature-flags/feature-flag-service.ts` - Constante + ALL_FEATURE_FLAG_KEYS + método fail-closed + export de conveniência

## Decisions Made

- `isCampaignApprovalEnabled` fail-closed SEM envOverride (decisão 1 F37.1) — a flag nunca habilita o fluxo por acidente e nunca derruba geração/entrega
- Posição canônica no `ALL_FEATURE_FLAG_KEYS` após `VISUAL_SIGNATURE_GENERATION_ENABLED_KEY` (ordem de exibição no admin)

## Deviations from Plan

Nenhuma - plano executado exatamente como escrito.

## Issues Encountered

Nenhum - testes existentes da flag (14) e da rota admin (4) continuaram verdes sem co-migração necessária.

## User Setup Required

Nenhum - sem configuração externa.

## Next Phase Readiness

- Flag `campaign_approval_enabled` operacional (fail-closed, seed false da migration 37-1-02) e listada no admin sem novo RPC/CHECK
- `isCampaignApprovalEnabled()` retorna `false` em falha/not-found/flag desligada — comportamento atual preservado
- Próximo: **37-1-04** (tipos `CampaignArtVersion` + persistência `createArtVersion`/`listArtVersions`), consumida pelos planos 37-1-05/06/07/08/09

---
*Phase: 37.1-approval-gate-candidata-unica*
*Completed: 2026-09-01*
