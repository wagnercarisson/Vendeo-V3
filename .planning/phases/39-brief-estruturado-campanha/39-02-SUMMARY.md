---
phase: 39-brief-estruturado-campanha
plan: 02
subsystem: domain-contract
tags: [campaign, brief, zod, typescript, domain-model]

# Dependency graph
requires:
  - phase: fase-39-brief-estruturado-campanha
    provides: OpenSpec contract spec (campaign-brief-contract) + patterns (brief.ts type-module)
provides:
  - CampaignBrief domain contract (product/commercial/media/creativeContext/metadata) shared client/server
  - zod per-domain schemas with exactly-1-primary invariant
  - getCampaignLegalNotice helper
affects: [39-03, 39-04, 39-05, 39-06, 39-07, F37]

# Tech tracking
tech-stack:
  added: []
  patterns: [type-only domain module without server-only, zod per-domain .strict(), superRefine invariant]

key-files:
  created: [src/lib/campaign/brief.ts, src/lib/campaign/brief-schema.ts, src/lib/campaign/__tests__/brief.test.ts]
  modified: []

key-decisions:
  - "brief.ts and brief-schema.ts are shared contracts (no server-only) — D4"
  - "Runtime image type (CampaignProductImageInput, dataUrl?) vs Snapshot type (CampaignBriefSnapshotImage, no dataUrl) separated by construction — D6/D7"
  - "Type derivation: hand-written interfaces in brief.ts + z.infer type CampaignBrief in brief-schema.ts (D4 allows both; tests validate the crossing)"

patterns-established:
  - "Type boundary: dataUrl exists ONLY in CampaignProductImageInput; provided/storagePath/productAssetId exist ONLY in CampaignBriefSnapshotImage"

requirements-completed: [F39-01, F39-02, F39-03, F39-04, F39-05, F39-06, F39-07, F39-08, F39-12, F39-20]

# Metrics
duration: 25min
completed: 2026-08-13
---

# Plan 39-02: Contrato de Domínio CampaignBrief Summary

**Contrato de domínio estruturado `CampaignBrief` (product/commercial/media/creativeContext/metadata) em `src/lib/campaign/brief.ts` + zod per-domínio em `brief-schema.ts` com invariante de exatamente 1 imagem `primary`, ambos sem server-only (D4), validados por 21 testes de contrato (8.1-8.6, 8.15 + behaviors de schema)**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-13T15:30:00Z
- **Completed:** 2026-08-13T15:55:00Z
- **Tasks:** 3
- **Files modified:** 3 (criados)

## Accomplishments
- `brief.ts`: constantes (`CampaignBriefSchemaVersion`, unions), 8 interfaces do domínio com fronteira type-level runtime×snapshot explícita (D6/D7), e helper puro `getCampaignLegalNotice` (D9)
- `brief-schema.ts`: `productSchema`/`commercialSchema`/`mediaSchema`/`creativeContextSchema`/`metadataSchema`/`campaignBriefSchema` — `.strict()` em todos, `z.enum` para unions, uuid para id/catalogProductId, `.superRefine` contando `role === "primary"` === 1 (F39-08)
- `brief.test.ts`: 21 testes verdes cobrindo brief mínimo, validade aninhada em commercial, legalNotice on/off via helper, exatamente-1-primary (0/2 rejeitados), source default manual, themeId null, e clareza schemaVersion runtime×snapshot por asserts de runtime
- Validação: `npx vitest run` (21/21), `npm run typecheck` (exit 0), `npm run lint` (exit 0)

## Task Commits

1. **Task 1: brief.ts — constantes + interfaces do domínio + getCampaignLegalNotice** - `(hash)` (feat)
2. **Task 2: brief-schema.ts — zod por domínio + invariante exatamente-1-primary** - `(hash)` (feat, tdd)
3. **Task 3: brief.test.ts — testes de contrato do domínio (8.1-8.6, 8.15)** - `(hash)` (test)

## Files Created/Modified
- `src/lib/campaign/brief.ts` - Constantes, interfaces do domínio (CampaignBrief, CampaignBriefSnapshot, product/commercial/media/creativeContext/metadata) + getCampaignLegalNotice
- `src/lib/campaign/brief-schema.ts` - Schemas zod por domínio com .strict() e invariante exatamente-1-primary
- `src/lib/campaign/__tests__/brief.test.ts` - 21 testes de contrato (behaviors de schema + 8.1-8.6 + 8.15)

## Decisions Made
- Interfaces hand-written em brief.ts (D4 permite contrato em brief.ts); tipo `CampaignBrief` também derivado por `z.infer` em brief-schema.ts; testes validam o cruzamento (safeParse dos objetos tipados)
- `CampaignIntent` reutilizado de `@/lib/campaign/types` via import (não redefinido localmente)

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered
- Nenhum. Ajuste interno: helper de teste `productSchemaForTest` com `require()` substituído por import direto de `productSchema` no topo (padrão ESM do projeto)

## User Setup Required
None

## Next Phase Readiness
- 39-02 (contrato de domínio) completo — base para o rename do wrapper (39-03) e mapper/builder (39-04)
- Nenhuma migration; gates verdes; testes de contrato prontos

---
*Phase: 39-brief-estruturado-campanha*
*Completed: 2026-08-13*
