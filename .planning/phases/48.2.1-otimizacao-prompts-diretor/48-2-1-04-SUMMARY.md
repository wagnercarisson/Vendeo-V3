---
phase: 48.2.1-otimizacao-prompts-diretor
plan: 48-2-1-04
subsystem: lab
tags: [zod, vitest, react, supabase, rubric, human-evaluation]

# Dependency graph
requires:
  - phase: 48.2.1-otimizacao-prompts-diretor
    provides: director execution per intent, single campaign_image call and atomic budget settle/release (plan 03)
provides:
  - Nine-criterion rubric module (RUBRIC_CRITERIA/RUBRIC_STATES + typed LabRubricSchema) with no aggregate scoring
  - Required rubric on new evaluations, persisted append-only in lab_human_evaluations.rubric
  - Blind comparison with blind_order recorded only when blind and per-pair form reset
  - Canonical VALID_RUBRIC/buildValidRubric test fixture reused by later plans
affects: [48-2-1-05, lab-human-evaluation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed required rubric schema (LabRubricSchema) shared by domain, service and UI"
    - "Canonical shared test fixture (rubric-fixture.ts, no .test suffix) as single source of the nine criteria"
    - "Controlled rubric form composed of local LabRadioGroup/LabTextarea primitives, no automatic note"
    - "Form remount by scenario/repetition pair key to reset verdict/rubric/observation"

key-files:
  created:
    - src/lib/lab/domain/rubric.ts
    - src/lib/lab/domain/__tests__/rubric-fixture.ts
    - src/lib/lab/__tests__/lab-human-evaluation.contract.test.ts
    - src/app/(app)/admin/laboratorio/_components/rubric-form.tsx
  modified:
    - src/lib/lab/domain/schemas.ts
    - src/lib/lab/api/evaluation-service.ts
    - src/app/(app)/admin/laboratorio/_components/evaluation-form.tsx
    - src/app/(app)/admin/laboratorio/_components/comparison-view.tsx
    - src/lib/lab/api/__tests__/evaluation-service.test.ts
    - src/lib/lab/domain/__tests__/schemas.test.ts
    - src/lib/lab/domain/__tests__/lab-experiments.contract.test.ts
    - src/app/(app)/admin/laboratorio/_components/__tests__/evaluation-form.test.tsx
    - src/app/(app)/admin/laboratorio/_components/__tests__/comparison-view.test.tsx
    - src/app/(app)/admin/laboratorio/_components/__tests__/lab-admin-ui.contract.test.tsx

key-decisions:
  - "The rubric is mandatory on new evaluations: CreateLabEvaluationInputSchema uses LabRubricSchema without .optional(); the DB column stays nullable and reads tolerate F48.1 history without rubric"
  - "No aggregate scoring: rubric.ts exports only presence/critical-defect validators, and a contract test asserts the exact export surface"
  - "blind_order is null unless the choice was effectively blind; the form remounts on the scenario/repetition pair so a decision never migrates"

patterns-established:
  - "Canonical rubric fixture imported by all evaluation builders (plans 04 and 05) instead of duplicating the nine criteria"
  - "Rubric completeness gates the evaluation CTA; absence is rejected by the schema before any insert"

requirements-completed: ["lab-human-evaluation"]

# Metrics
duration: 14 min
completed: 2026-09-25
---

# Phase 48.2.1 Plan 04: Avaliação Humana, Rubrica e Cega Summary

**Nine-criterion human rubric (state + optional observation) required on new evaluations, persisted append-only with blind comparison and per-pair form reset — no automatic scoring.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-25T17:26:00-03:00
- **Completed:** 2026-09-25T17:40:12-03:00
- **Tasks:** 4
- **Files modified:** 14

## Accomplishments
- Pure `rubric.ts` module with the nine criteria, four states, PT-BR labels and presence/critical-defect validators — no aggregate scoring
- `CreateLabEvaluationInputSchema` now requires the typed nine-criterion rubric; `createEvaluation` persists it append-only with `blind_order` null unless blind
- Structured `rubric-form.tsx` (nine criteria via local primitives) integrated into the evaluation form, which resets with the scenario/repetition pair
- All evaluation consumers co-migrated to the canonical `VALID_RUBRIC` fixture with negative missing-rubric cases; 137 targeted tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure rubric module and required schema** - `2422c030` (feat)
2. **Task 2: Append-only rubric persistence and consumer co-migration** - `c4fcd11f` (feat)
3. **Task 3: Structured rubric form and blind comparison reset** - `2a075d88` (feat)
4. **Task 4: Append-only history, per-pair reset and no automatic metric tests** - `618922d4` (test)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `src/lib/lab/domain/rubric.ts` - Nine criteria, four states, typed schema and pure validators, no scoring
- `src/lib/lab/domain/__tests__/rubric-fixture.ts` - Canonical `VALID_RUBRIC`/`buildValidRubric`
- `src/lib/lab/__tests__/lab-human-evaluation.contract.test.ts` - Module, schema and service contract tests
- `src/app/(app)/admin/laboratorio/_components/rubric-form.tsx` - Nine-criterion structured form (state + optional observation)
- `src/lib/lab/domain/schemas.ts` - Required typed rubric replacing the generic record
- `src/lib/lab/api/evaluation-service.ts` - Persists `rubric` in the append-only insert
- `src/app/(app)/admin/laboratorio/_components/evaluation-form.tsx` - Rubric-aware submit and required-rubric gate
- `src/app/(app)/admin/laboratorio/_components/comparison-view.tsx` - Pair-dependent remount key and rubric context propagation
- Six consumer test files co-migrated to the canonical fixture

## Decisions Made
- Rubric mandatory on new evaluations (schema-level), DB column nullable for F48.1 history
- No automatic scoring; export surface pinned by test
- `blind_order` only when the choice was blind; per-pair form remount

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Relaxed `isRubricComplete` parameter type to accept drafts**
- **Found during:** Task 3 (rubric form integration)
- **Issue:** The UI holds a draft rubric with optional per-criterion `state`, which is not assignable to `Partial<LabRubric>` (required `state`), so `isRubricComplete` failed typecheck.
- **Fix:** Widened the parameter type to `Partial<Record<RubricCriterion, { state?: RubricState }>>` and kept the boolean return (no new runtime export, so Task 1's exact-export test still passes).
- **Files modified:** `src/lib/lab/domain/rubric.ts`
- **Verification:** `tsc --noEmit` exit 0; the module contract test still passes.
- **Committed in:** `2a075d88` (Task 3 commit)

**2. [Rule 3 - Blocking] Adjusted the "no automatic judgment" negative assertions to strip the mandated rubric instruction**
- **Found during:** Task 3 (UI test co-migration)
- **Issue:** The mandated rubric copy is "Avalie cada critério do par comparado. Não há nota automática." and contains the word "nota"; the existing negative assertions (`/nota|score|.../`) failed once the real rubric form rendered.
- **Fix:** Stripped the exact instruction before matching in `evaluation-form.test.tsx` and `lab-admin-ui.contract.test.tsx`; the assertion still forbids any automatic judgment text.
- **Files modified:** `evaluation-form.test.tsx`, `lab-admin-ui.contract.test.tsx`
- **Verification:** Both UI suites pass; the instruction is the only occurrence of "nota".
- **Committed in:** `2a075d88` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking)
**Impact on plan:** Both were necessary to keep typecheck and tests green; no scope creep.

## Issues Encountered
- A stray untracked `README.md` (128 bytes) appeared in the working tree during execution (likely a tool side effect). Left untracked and not committed; the pre-existing untracked `docs/alinhamento-fase-44-temas-de-campanhas` was preserved.
- `gsd-sdk query state.record-session` / `state.update-progress` did not apply because STATE.md uses PT-BR session labels; STATE.md was updated manually. `requirements.mark-complete lab-human-evaluation` found no matching REQUIREMENTS ID (it is a capability slug, not a requirement ID).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Rubric contract pinned and reusable by plan 48-2-1-05 (API/UI/budget) via the canonical `VALID_RUBRIC` fixture
- Ready for `48-2-1-05`; Checkpoint 2 (budget authorization) remains pending before any paid call

---
*Phase: 48.2.1-otimizacao-prompts-diretor*
*Completed: 2026-09-25*

## Self-Check: PASSED

- Created files exist on disk: `src/lib/lab/domain/rubric.ts`, `src/lib/lab/domain/__tests__/rubric-fixture.ts`, `src/lib/lab/__tests__/lab-human-evaluation.contract.test.ts`, `src/app/(app)/admin/laboratorio/_components/rubric-form.tsx`
- Commits exist: `2422c030`, `c4fcd11f`, `2a075d88`, `618922d4`
- `tsc --noEmit` exit 0; `eslint .` exit 0; targeted 7-file suite 137 tests passed
- `rg -i "score|average|média|nota"` on rubric.ts returns zero; on rubric-form.tsx only the prohibiting comment/instruction
