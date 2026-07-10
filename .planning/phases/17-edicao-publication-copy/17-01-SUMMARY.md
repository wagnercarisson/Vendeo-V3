---
phase: 17-edicao-publication-copy
plan: 01
subsystem: database, types, validation, display
tags: supabase, migration, jsonb, typescript, validation, vitest

requires: []
provides:
  - Migration ADD COLUMN publication_copy_current JSONB
  - CampaignRecord with publication_copy_current field
  - validatePublicationCopy function with 8 validation rules
  - getEffectivePublicationCopy with current > snapshot > empty fallback
  - mapCampaignToProps with campaignId and isPublicationCopyEdited
  - 12 tests (8 validation + 4 fallback) all passing
affects:
  - 17-02 (PATCH route + UI edit mode — consumes validation + display contract)

tech-stack:
  added: []
  patterns:
    - Fallback por shape/tipo (não truthiness) para versionamento de dados
    - Validação isolada em módulo próprio (publication-copy.ts) reutilizável

key-files:
  created:
    - supabase/migrations/20260710000002_add_publication_copy_current.sql
    - src/lib/campaign/publication-copy.ts
    - src/__tests__/lib/campaign/publication-copy.test.ts
  modified:
    - src/lib/campaign/types.ts
    - src/lib/campaign/display.ts
    - src/__tests__/lib/campaign/display.test.ts

key-decisions:
  - "publication_copy_current como coluna JSONB direta em campaigns (sem tabela separada, sem JOIN)"
  - "Fallback por shape/tipo (não truthiness) — cta_post vazio é valor válido"
  - "Validação isolada em publication-copy.ts para reuso entre backend e frontend"
  - "Messages de erro em português para o lojista brasileiro"

patterns-established:
  - "Fallback de dados editáveis: current version > original snapshot > vazio"
  - "Campos editáveis armazenados como JSONB nullable, checks de shape no display layer"
  - "Identificador isPublicationCopyEdited derivado de null check no display contract"

requirements-completed:
  - REQ-MIGRATION-ADD-COLUMN
  - REQ-TYPES-CURRENT-FIELD
  - REQ-VALIDATION-FUNCTION
  - REQ-VALIDATION-ISSUE-TYPE
  - REQ-VALIDATION-RESTORE
  - REQ-DISPLAY-FALLBACK
  - REQ-DISPLAY-CAMPAIGN-ID
  - REQ-DISPLAY-EDITED-FLAG

duration: 2min
completed: 2026-07-10
---

# Phase 17 Plan 01: Migration + Validation + Display Contract Summary

**Publication copy editing infrastructure: migration column, types, validation function, display fallback, and 12 tests passing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-10T17:00:48-03:00
- **Completed:** 2026-07-10T17:02:59-03:00
- **Tasks:** 6
- **Files modified:** 6

## Accomplishments

- Migration SQL `20260710000002_add_publication_copy_current.sql` adiciona coluna `publication_copy_current` (JSONB, nullable) sem quebrar dados existentes
- `CampaignRecord` agora inclui `publication_copy_current: Record<string, unknown> | null`
- `validatePublicationCopy` criada com validação completa de caption (1-2200), hashtags (0-30, formato `#\w+`, 2-100 chars), cta_post (0-200) e suporte a `restore: true`
- `getEffectivePublicationCopy` implementa fallback por shape/tipo: current > snapshot > vazio
- `mapCampaignToProps` migrada para usar `getEffectivePublicationCopy` e expõe `campaignId` e `isPublicationCopyEdited`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration SQL** - `f512d5f` (feat)
2. **Task 2: Add publication_copy_current to CampaignRecord** - `0ca2134` (feat + Rule 3 fix)
3. **Task 3: Create publication-copy.ts with validation** - `af248c0` (feat)
4. **Task 4: Add getEffectivePublicationCopy and modify mapCampaignToProps** - `d78fde0` (feat)
5. **Task 5: Create publication-copy.test.ts (8 scenarios)** - `c1edff3` (test)
6. **Task 6: Add getEffectivePublicationCopy tests to display.test.ts (4 scenarios)** - `95f0a09` (test)

**Plan metadata:** (pending — SUMMARY commit)

## Files Created/Modified

### Created
- `supabase/migrations/20260710000002_add_publication_copy_current.sql` — ADD COLUMN IF NOT EXISTS + COMMENT
- `src/lib/campaign/publication-copy.ts` — validatePublicationCopy, PublicationCopyUpdate, ValidationIssue
- `src/__tests__/lib/campaign/publication-copy.test.ts` — 8 cenários de validação

### Modified
- `src/lib/campaign/types.ts` — Adicionado publication_copy_current a CampaignRecord
- `src/lib/campaign/display.ts` — CampaignPageProps (campaignId, isPublicationCopyEdited), getEffectivePublicationCopy, mapCampaignToProps atualizado
- `src/__tests__/lib/campaign/display.test.ts` — Mock atualizado + 4 testes de fallback

## Decisions Made

- **publication_copy_current como coluna JSONB direta** em vez de tabela separada — migração mínima, leitura sem JOIN, snapshot permanece imutável
- **Fallback por shape/tipo (não truthiness)** — `cta_post: ""` é valor válido e não causa fallback indevido para snapshot
- **Validação isolada em publication-copy.ts** — reutilizável entre rota PATCH (17-02) e futura validação frontend
- **Mensagens em português** nos ValidationIssue para o lojista brasileiro

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added publication_copy_current to mock campaign in display.test.ts**
- **Found during:** Task 2 (Add field to CampaignRecord)
- **Issue:** Adding the new required field to `CampaignRecord` interface broke TypeScript in `display.test.ts` where `mockCampaign: CampaignRecord` didn't include the new field
- **Fix:** Added `publication_copy_current: null` to the mock campaign object
- **Files modified:** `src/__tests__/lib/campaign/display.test.ts`
- **Verification:** `npm run typecheck` passes
- **Committed in:** `0ca2134` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for typecheck to pass after field addition. No scope creep.

## Issues Encountered

None — all tasks executed as planned.

## User Setup Required

None - no external service configuration required.

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/__tests__/lib/campaign/publication-copy.test.ts` | ✅ 8 passing |
| `npx vitest run src/__tests__/lib/campaign/display.test.ts` | ✅ 14 passing (10 existing + 4 new) |
| `npm run typecheck` | ✅ Zero errors |
| `npm run lint` | ✅ Zero errors |
| `npm run build` | ✅ Zero errors |

## Next Phase Readiness

- **17-02 (PATCH route + UI edit mode):** Ready to consume:
  - `validatePublicationCopy` from `publication-copy.ts` for PATCH body validation
  - `getEffectivePublicationCopy` from `display.ts` for display fallback (no changes needed)
  - `campaignId` and `isPublicationCopyEdited` passed through `mapCampaignToProps`
  - Migration already has the column ready for `publication_copy_current` writes

## Self-Check

- [x] `supabase/migrations/20260710000002_add_publication_copy_current.sql` exists with ADD COLUMN IF NOT EXISTS
- [x] `src/lib/campaign/types.ts` has `publication_copy_current: Record<string, unknown> | null`
- [x] `src/lib/campaign/publication-copy.ts` exists with validatePublicationCopy, PublicationCopyUpdate, ValidationIssue
- [x] `src/lib/campaign/display.ts` has getEffectivePublicationCopy and modified mapCampaignToProps
- [x] CampaignPageProps has campaignId and isPublicationCopyEdited
- [x] 22 tests passing (8 validation + 14 display)
- [x] TypeScript/lint/build clean

## Self-Check: PASSED

---

*Phase: 17-edicao-publication-copy*
*Completed: 2026-07-10*
