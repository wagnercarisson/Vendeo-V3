---
phase: 48.2.6-validacao-experimental-produto-intencoes-1-1
plan: 06
subsystem: lab-bench
tags: [policies, prompt-base, intent, registry, tests]

# Dependency graph
requires:
  - phase: 48.2.6
    provides: Price/intent validation, prompt composition and approved bench configuration registry
provides:
  - Versioned Oferta/Destaque/Exclusivo policies indexed by dimension and selected value
  - Shared neutral prompt base for all three Produto 1:1 intent signatures
  - Normative auxiliary-image instruction in UI and Produto policy
affects: [48.2.6-07, 48.2.6-08, lab-bench-prompt-policy, lab-bench-prompt-base]

# Tech tracking
tech-stack:
  added: []
  patterns: [dimension-to-value-to-policy registry lookup, fail-closed validation, shared immutable prompt-base object]

key-files:
  created:
    - src/lib/lab/bench/domain/policies/destaque.ts
    - src/lib/lab/bench/domain/policies/exclusivo.ts
  modified:
    - src/lib/lab/bench/domain/config-registry.ts
    - src/lib/lab/bench/domain/policies/registry.ts
    - src/lib/lab/bench/domain/policies/resolve-bench-prompt-policies.ts
    - src/lib/lab/bench/domain/prompt-base.ts
    - src/app/(app)/admin/laboratorio/bancada/_components/bench-image-upload.tsx

key-decisions:
  - "Enable only Oferta, Destaque and Exclusivo in the existing intent dimension; all other dimensions and values remain as previously configured."
  - "Resolve policy by registry[dimension][resolved[dimension]] and share one BENCH_DEFAULT_PROMPT_BASE object across the three signatures."

patterns-established:
  - "Prompt policy registries are keyed by dimension and value, validated against enabled config-registry values."
  - "Commercial instructions belong only to the corresponding intent policy; general/product policies remain disjoint."

requirements-completed: [lab-bench-prompt-policy, lab-bench-prompt-base, lab-bench-image-roles, lab-generation-bench, lab-bench-intent-validation, lab-bench-intent-uat, lab-bench-form-parity]

# Metrics
duration: 35min
completed: 2026-10-02
---

# Phase 48.2.6 Plan 06: Intent Policies and Shared Prompt Base Summary

**The bench now resolves the exact versioned policy for each selected intent while all three Produto 1:1 cuts reuse the same neutral prompt-base object.**

## Performance

- **Duration:** about 35 minutes
- **Tasks:** 2
- **Files modified/created:** 14

## Accomplishments

- Enabled only the two additional intent values, preserving baseline format, content type, structure and theme settings.
- Reworked the established policy registry to resolve by dimension and value, with explicit fail-closed identity/version checks.
- Added concise, versioned Destaque and Exclusivo policies and aligned Oferta and Produto wording to the approved normative instructions.
- Updated the supplementary prompt-base text and mapped Oferta/Destaque/Exclusivo signatures to the identical `BENCH_DEFAULT_PROMPT_BASE` object.
- Replaced the auxiliary-image help sentence without changing upload count, ordering or multipart transport.

## Task Commits

1. **Task 1: Resolver políticas versionadas pelo valor selecionado** — `a7ed6d02` (test/RED), `3d1911c9` (feat/GREEN)
2. **Task 2: Atualizar prompt-base e orientação das imagens auxiliares** — `5ddd70b7` (feat)

## Verification

- Focused config/policy/prompt-base/composer/UI contracts: **134 passed**.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `git diff --check`: passed.
- A broader bench/API regression invocation produced 617 passing tests, 1 skipped and failures/timeouts in pre-existing unrelated execution/boundary/run-history tests. Four execution tests attempted external pricing fetches and timed out (`fetch failed`); no provider generation was invoked. The failures were not modified because they are outside this plan and the requested boundary forbids remote access.
- No provider calls, paid generation, database/migration operations, adapter/pricing changes or production logic changes were made.

## Decisions Made

- Followed the user-approved design as written: no new resolver architecture and no additional enabled dimensions.
- Retained the established multidimensional prompt-base signature scheme and registered three explicit signatures to the same object.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the page's policy projection for the new value-indexed registry shape**
- **Found during:** Task 1
- **Issue:** Server-rendered policy props assumed one policy per dimension and failed TypeScript after the registry became dimension → value → policy.
- **Fix:** Projected all registered values for each dimension into the existing UI view model.
- **Files modified:** `src/app/(app)/admin/laboratorio/bancada/page.tsx`
- **Verification:** Typecheck and UI contract tests passed.
- **Committed in:** `3d1911c9`

**2. [Rule 1 - Test fixture] Made composer contract fixtures explicitly valid under the already-implemented commercial matrix**
- **Found during:** Task 1
- **Issue:** Existing composer tests created snapshots with incompatible intent/price/validity inputs.
- **Fix:** Set explicit compatible intent and validity in those fixtures; runtime enforcement was unchanged.
- **Files modified:** `src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts`
- **Verification:** Composer contract tests passed.
- **Committed in:** `3d1911c9`

---

**Total deviations:** 2 auto-fixed (1 blocking compatibility adjustment, 1 test-fixture correction)
**Impact on plan:** Required to integrate the approved nested registry with its existing consumer and validate contracts using supported commercial inputs; no scope expansion.

## Issues Encountered

- The broad regression command includes tests that exceed their 5-second timeout and exercise an external pricing fetch. These were not retried to respect the no-remote-read constraint. The focused offline contracts and static gates passed.
- Existing planning/OpenSpec edits present before execution remain untouched and uncommitted.

## User Setup Required

None.

## Next Phase Readiness

- Plan 06 implementation and local contracts are complete.
- Continue with Plan 07 after reviewing the broader-suite blockers; no generation or checkpoint authorization is implied by this plan.

## Self-Check: PASSED

- Summary and implementation files exist.
- Task commits `a7ed6d02`, `3d1911c9`, and `5ddd70b7` are present.
- Active pre-existing planning/OpenSpec changes were excluded from task commits.
