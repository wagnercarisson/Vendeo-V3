---
phase: quick-261003-mne
plan: 261003-mne
subsystem: api
tags: [bench, campaign-intent, policy, preflight, vitest]
requires:
  - phase: 48.2.6
    provides: Bench policy registry and UI campaignIntent contract
provides:
  - Canonical conversion from UI intent values to bench policy identifiers
  - Compose and runs preflight intent parity coverage for all three choices
affects: [bench-api, prompt-preflight]
tech-stack:
  added: []
  patterns: [shared domain intent conversion]
key-files:
  created: []
  modified: [src/lib/lab/bench/domain/config-registry.ts, src/app/api/admin/laboratorio/bancada/compose/route.ts, src/app/api/admin/laboratorio/bancada/runs/route.ts, src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts]
key-decisions:
  - "UI intent remains offer/spotlight/exclusive; a single config-domain helper translates to oferta/destaque/exclusivo."
  - "Run contract cases deliberately stop on preflight evidence validation before set/persist, CAS, or execution."
patterns-established:
  - "Both POST handlers resolve policy config from the same domain-owned UI-to-policy mapping."
requirements-completed: []
duration: 9min
completed: 2026-10-03
---

# Quick 261003-mne Summary

**Canonical intent mapping now drives compose and `/runs` snapshot/briefing/recomposition/evidence, preventing Spotlight and Exclusive from inheriting Oferta policies.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-03
- **Completed:** 2026-10-03
- **Tasks:** 3
- **Files modified:** 1 follow-up test file (production implementation remains at `32bf7039`)

## Accomplishments

- Added `resolveBenchPolicyIntent`: `offer → oferta`, `spotlight → destaque`, `exclusive → exclusivo`.
- `/compose` resolves policies, prompt contributions and versions using the selected policy intent.
- `/runs` uses the corresponding config for campaign snapshot, briefing, recomposition, server evidence and persistence arguments. Its new route tests stop at evidence validation before persistence/CAS/provider.
- Coverage checks text and versions for all three UI values on both routes, with explicit anti-Oferta checks for Spotlight/Exclusive.
- Local Spotlight policy test asserts the exact instruction and version `48.2.6-destaque-v1`.

## Task Commits

1. **TDD route/domain intent mapping and contract coverage** - `32bf7039` (`fix(261003-mne): resolve selected bench intent`)
2. **Real resolver/composer API contract follow-up** - `ec8e6d35` (`test(261003-mne): exercise real bench intent composition`)

## Files Created/Modified

- `src/lib/lab/bench/domain/config-registry.ts` - canonical UI intent conversion.
- `src/app/api/admin/laboratorio/bancada/compose/route.ts` - resolves policy intent before policy configuration.
- `src/app/api/admin/laboratorio/bancada/runs/route.ts` - uses selected intent throughout server revalidation.
- `src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` - route and local policy regressions.

## Decisions Made

- Kept public/UI values stable; conversion belongs in one shared domain helper, not duplicated route code.
- `/runs` new cases intentionally return at the evidence gate and assert no persistence, CAS, or execution to honor the no-run constraint.

## Deviations from Plan

- The shared canonical helper required a fourth source file (`config-registry.ts`) beyond the two routes and contract-test file listed under `files_modified`; it is within the planned single-mapping domain design.
- The focused strict OpenSpec command has no implicit change discovery: `npx openspec validate --strict` returned “Nothing to validate”; validated the active change explicitly via `npx openspec validate --changes` (1 passed).
- Tried a guessed architecture-guard test path that does not exist; reran the actual existing global `src/lib/ai/__tests__/architecture-guard.test.ts` successfully.
- Follow-up review exposed that the test's hoisted policy-intent mock returned `undefined` and `/runs` mocked recomposition as resolver-only data. Replaced this with the actual helper and actual resolver+composer output, asserting exact versions and composed phrases without a fallback mapping; no production route defect was found.

## Issues Encountered

- First focused follow-up run: 3 `/runs` cases failed because the actual composer fixture lacked the `briefing.product.name` it requires. Completed the fixture from the actual route contract; rerun passed.

## Gates

- `npx vitest run src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` — PASS, 130/130.
- `npx vitest run src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts -t spotlight` — PASS, 2/2 (128 skipped). Real `/compose` Spotlight route test verifies compiled product line exactly `Nome do produto obrigatório: Mouse sem fio`, exact instruction `Destaque: priorize a apresentação do produto; preço informado é secundário.`, policy version `48.2.6-destaque-v1`, and excludes Oferta phrase/version. Uses real intent helper, policy resolver and composer; no invented product fields or image/database access.
- Final full contract rerun: `npx vitest run src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts` — PASS, 130/130.
- `npm run typecheck` — PASS, exit 0.
- `npm run lint` — PASS, exit 0.
- `npx openspec validate --strict` — no item discovered (“Nothing to validate”).
- `npx openspec validate --changes` — PASS, 1 active change validated.
- `npx vitest run src/lib/ai/__tests__/architecture-guard.test.ts` — PASS, 21/21.
- Guessed bench-specific architecture guard paths — no test files found (exit 1); actual existing architecture guard above passed.
- `git diff --check` — PASS.

## Safety Confirmation

- No provider or image-generation invocation. All route dependencies are mocked; new `/runs` cases stop before set-input/CAS/execution.
- No UAT/manual run, database operation, migration, deploy, or external service operation.
- No Plan 10, CHECKPOINT B, policy text/version, prompt-base, pricing, adapter, production, credit, UAT-evaluation or OpenSpec changes.
- Production files remain unchanged from `32bf7039`; follow-up commit contains only the contract test file. Summary remains uncommitted per request; STATE/HANDOFF were not changed.

## Self-Check: PASSED

- Commit `32bf7039` exists and includes exactly the four code/test paths listed above.
- Summary file is present and uncommitted; no STATE/HANDOFF changes were made.

## Final Follow-up

- Commit: `1107a86d` (`test(261003-mne): assert spotlight product text`) — narrowly scoped Spotlight route-contract improvement in `bench-api.contract.test.ts`.
- The test fixture now carries the campaign snapshot's actual product name into its briefing, preserving the existing real composer contract while retaining a safe fallback for tests without a product snapshot.
