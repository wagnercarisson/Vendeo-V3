---
phase: 39-brief-estruturado-campanha
plan: 03
subsystem: domain-contract
tags: [campaign, rename, typescript, wrapper, snapshot]

# Dependency graph
requires:
  - phase: 39-02
    provides: CampaignBriefSnapshot type in src/lib/campaign/brief.ts
provides:
  - ResolvedCampaignContext wrapper (rename of CampaignBrief) with preserved shape
  - CampaignBriefSnapshot alias replacing dead InputSnapshot interface
affects: [39-04, 39-05, 39-06, 39-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [type re-export, rename without shape change, Parameters<typeof> re-export]

key-files:
  created: []
  modified: [src/components/campaign/types.ts, src/lib/campaign/types.ts, src/lib/store-identity-service.ts, src/lib/copy/mapper.ts, src/lib/image-generation/services/image-generation-service.ts, src/lib/actions/__tests__/store.test.ts, src/lib/image-generation/services/__tests__/image-generation-service.test.ts]

key-decisions:
  - "Wrapper renamed to ResolvedCampaignContext with EXACT same shape (D4) — no caller breakage"

patterns-established:
  - "Type rename co-migrated in the same plan (global typecheck clean at plan end)"

requirements-completed: [F39-10, F39-14, F39-20]

# Metrics
duration: 20min
completed: 2026-08-13
---

# Plan 39-03: Rename Wrapper → ResolvedCampaignContext Summary

**Wrapper de transporte `CampaignBrief` renomeado para `ResolvedCampaignContext` em `src/components/campaign/types.ts` com shape `{ campaignInput, store, brandProfile, identity }` preservado, todos os call sites co-migrados, e `InputSnapshot` (interface morta) substituído pelo alias `CampaignBriefSnapshot` do domínio — validação global typecheck/lint limpa**

## Performance

- **Duration:** 20 min
- **Started:** 2026-08-13T16:00:00Z
- **Completed:** 2026-08-13T16:20:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- `src/components/campaign/types.ts`: `CampaignBrief` → `ResolvedCampaignContext` (shape idêntico + JSDoc distinguindo wrapper vs. domínio)
- `src/lib/campaign/types.ts`: `InputSnapshot` removida e substituída por `import type { CampaignBriefSnapshot } from "./brief"` + re-export; `CampaignRecord.input_snapshot` mantido `Record<string, unknown> | null` (jsonb tolerante — D6)
- Call sites co-migrados: `store-identity-service.ts` (import + `Promise<ResolvedCampaignContext>`), `copy/mapper.ts` (import + assinatura), `image-generation-service.ts` (import + 3 anotações de tipo), `store.test.ts` (import + teste 8.21), `image-generation-service.test.ts` (import + `createMinimalBrief`)
- Teste 8.21 adicionado em `store.test.ts`: shape preservado e compila como `ResolvedCampaignContext`
- Validação: `npx vitest run` (55/55 nos 3 arquivos), `npm run typecheck` (exit 0), `npm run lint` (exit 0)

## Task Commits

1. **Task 1: Rename no types.ts de componentes + swap InputSnapshot → CampaignBriefSnapshot** - `(hash)` (refactor)
2. **Task 2: Co-migração dos call sites + contrato 8.21 (shape preservado)** - `(hash)` (refactor, test)

## Files Created/Modified
- `src/components/campaign/types.ts` - Interface renomeada para ResolvedCampaignContext + JSDoc
- `src/lib/campaign/types.ts` - InputSnapshot removida; re-export CampaignBriefSnapshot
- `src/lib/store-identity-service.ts` - Import + return type → ResolvedCampaignContext
- `src/lib/copy/mapper.ts` - Import + assinatura → ResolvedCampaignContext
- `src/lib/image-generation/services/image-generation-service.ts` - Import + 3 anotações de tipo
- `src/lib/actions/__tests__/store.test.ts` - Import + teste 8.21
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` - Import + createMinimalBrief

## Decisions Made
None - followed plan as specified (rename puro, D4)

## Deviations from Plan
Nenhuma. `src/lib/actions/store.ts` (re-export por `Parameters<typeof>`) e `route.ts:241` (inferência) não exigiram touch de tipo — confirmado pelo typecheck global exit 0.

## Issues Encountered
- Nenhum. Reorganização cosmética do import do re-export em `src/lib/campaign/types.ts` (movido ao topo do arquivo para seguir a convenção)

## User Setup Required
None

## Next Phase Readiness
- 39-03 completo — domínio (39-02) + wrapper renomeado prontos; mapper e builder (39-04) podem consumir ambos
- Sem migration; gates verdes

---
*Phase: 39-brief-estruturado-campanha*
*Completed: 2026-08-13*
