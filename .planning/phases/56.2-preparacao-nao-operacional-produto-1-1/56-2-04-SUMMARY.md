---
phase: 56.2-preparacao-nao-operacional-produto-1-1
plan: 04
subsystem: database
tags: [append-only, supabase, image-generation, snapshot, vitest]

# Dependency graph
requires:
  - phase: 56.2-preparacao-nao-operacional-produto-1-1
    provides: F56.1 original config snapshot contract and F56.2a selection/prompt foundations
provides:
  - typed append-only image-generation operations relation linked to campaign and original snapshot
  - server-only insert/read repository keyed by campaign and operation identifiers
  - tests for attempt history, model-quality correlation, snapshot reuse, and historical run/trace retention
affects: [56-2-05, 56-2-06, 56.2b1]

# Tech tracking
tech-stack:
  added: []
  patterns: [typed append-only Supabase relation, injected server-only repository, operation-scoped ordered attempt lookup]

key-files:
  created:
    - supabase/migrations/20261006000002_f56_2a_operations_append_only.sql
    - src/lib/ai/image-generation-operations-repository.ts
    - src/lib/ai/__tests__/image-generation-operations-repository.test.ts
    - src/lib/ai/__tests__/image-generation-config-snapshot.reuse.test.ts
  modified:
    - .planning/phases/56.2-preparacao-nao-operacional-produto-1-1/56-2-04-PLAN.md
    - .planning/phases/56.2-preparacao-nao-operacional-produto-1-1/56-2-06-PLAN.md
    - openspec/changes/fase-56-2a-preparacao-nao-operacional-produto-1-1/design.md
    - openspec/changes/fase-56-2a-preparacao-nao-operacional-produto-1-1/specs/image-generation-config-snapshot/spec.md
    - openspec/changes/fase-56-2a-preparacao-nao-operacional-produto-1-1/tasks.md

key-decisions:
  - "Keep the immutable snapshot's run_id/trace_id untouched; store each attempt's pair, target, and correlation identifiers in its own typed row."
  - "Vector health is an observed operational anomaly, not a Plan 04/06 pass criterion; required-service health and isolation gates determine whether a database command may proceed."
  - "Reserve real invalid-FK insertion checks for Plan 06, as specified by Plan 04; Plan 04 validates migration syntax with isolated local db lint."

patterns-established:
  - "Operation history is append-only at both database privilege/trigger and repository insert-only layers."
  - "Operation lookup filters campaign_id and operation_id and orders attempts by attempt_number ascending."

requirements-completed: [REQ-56.2a-15, REQ-56.2a-16, REQ-56.2a-17]

# Metrics
duration: ~20m
completed: 2026-10-07
---

# Plan 04: Append-only operation history and original snapshot reuse

**Typed append-only operation records and an insert-only repository now preserve per-attempt model/quality and correlation while correction resolution reuses the original snapshot unchanged.**

## Performance

- **Duration:** ~20 minutes (approximate; start time was not recorded by the harness)
- **Started:** 2026-10-07T15:55:00-03:00 (approximate)
- **Completed:** 2026-10-07
- **Tasks:** 3/3
- **Files modified:** 14 unique paths (4 implementation artifacts and 10 plan/spec/tracking documents)

## Accomplishments

- Added the local-only `image_generation_operations` table with typed campaign/snapshot foreign keys, attempt identifiers, target, model/quality, and optional run/trace fields; RLS is service-role-only, table grants are SELECT/INSERT, and a deterministic trigger blocks UPDATE/DELETE.
- Post-review correction: a `BEFORE INSERT` trigger now rejects a valid campaign paired with an existing snapshot owned by another campaign (`image_generation_operations_snapshot_campaign_mismatch`). Missing campaign/snapshot IDs are left to their respective independent FKs; snapshot tables/data remain untouched.
- Added an injected, server-only Supabase repository. `recordOperation` performs INSERT only and returns row/operation identifiers; `listByOperationId` filters by campaign and operation and orders attempts ascending.
- Added tests proving append-only behavior, snapshot/campaign correlation, pair mapping, filtered ordered reads, original snapshot reuse despite current-config changes, legacy null tolerance, and preservation of original `run_id`/`trace_id`.
- Validation passed after the correction: isolated `supabase db lint --workdir "C:\Users\wagne\AppData\Local\Temp\opencode\vendeo-f562a-isolated" --local --fail-on error` exit 0 (`No schema errors found`); `npm run typecheck` exit 0; focused Vitest **5/5 passed**; OpenSpec strict validation reports the change valid. Static checks confirm independent FKs, the same-campaign trigger predicate, no snapshot writes, and the cross-campaign scenario in Plan 06.
- The immediately preceding isolation gate passed both before the original lint and again after the review correction: BASE_SHA `335bfb70` exists/is an ancestor; project ID matches; API is loopback; dedicated F56.2a DB/Auth/Kong are healthy and PostgREST running; F56.1 required services, DB volume, and network remain present; no Vendeo_V3/Mailpit active and no dedicated-port conflicts. Status output was filtered; no credential values were emitted.
- No `db reset`, remote `db push`, provider call, activation, or production wiring occurred. Real invalid-campaign/snapshot FK insertions remain assigned to Plan 06.

## Task Commits

1. **Task 1: Migration append-only de operações/tentativas** — `d71226e2`
2. **Task 2: Repositório append-only server-only com client injetável** — `7cbff149`
3. **Task 3: Testes estruturais e de reuso do snapshot original** — `06a96926`, `e0aa4b60` (follow-up para provar run/trace após inserir nova tentativa)

**Post-review correction:** `5e1bd527` — enforces same-campaign ownership in the migration; the Plan 06 real integration scenario is specified but remains to be executed there.

## Files Created/Modified

- `supabase/migrations/20261006000002_f56_2a_operations_append_only.sql` — typed append-only relation, service-role-only RLS/grants, immutability trigger, local-only notice, and revert block.
- `src/lib/ai/image-generation-operations-repository.ts` — insert-only recording and ordered lookup with snake_case-to-camelCase mapping.
- `src/lib/ai/__tests__/image-generation-operations-repository.test.ts` — in-memory append-only, links, mapping, and query contract tests.
- `src/lib/ai/__tests__/image-generation-config-snapshot.reuse.test.ts` — original snapshot reuse and run/trace preservation tests.
- `.planning/phases/56.2-preparacao-nao-operacional-produto-1-1/56-2-ISOLATED-INSTANCE.md` — pre-lint gate and Vector interpretation evidence.
- OpenSpec `design.md`, `specs/image-generation-config-snapshot/spec.md`, and `tasks.md`; Plans 04/06 — same-campaign invariant and real cross-campaign integration case.

## Decisions Made

- Vector remained `restarting` during the authorized rechecks. Its restart count was 122, 128, and 147 immediately before the correction `db lint` (13 in the earlier recovery record). Per the user-confirmed interpretation, Vector health is not itself a required gate for Plans 04/06. Do not restart/remove it to satisfy the gate; recheck it and stop only if it affects a required service or the DB command fails.
- Migration syntax was validated with local `db lint`; real invalid-FK insertions are explicitly reserved for Plan 06.
- The responsible reviewer found that independent FKs allowed two valid IDs from different campaigns to be paired. The fix preserves the independent FK checks and rejects only the cross-campaign association; the real PostgreSQL case is now a Plan 06 acceptance criterion.

## Deviations from Plan

**1. [Reviewer-requested correction] Enforce campaign/snapshot ownership together**
- **Found during:** Post-plan review.
- **Issue:** Independent FKs accepted two existing IDs even when the snapshot belonged to a different campaign.
- **Fix:** Added a read-only `BEFORE INSERT` ownership check with deterministic error; kept independent FK behavior for missing IDs; aligned OpenSpec and Plans 04/06.
- **Files modified:** `supabase/migrations/20261006000002_f56_2a_operations_append_only.sql`, OpenSpec `design.md`/`spec.md`/`tasks.md`, Plans 04/06.
- **Verification:** isolated `db lint` exit 0; static assertions pass; focused tests 5/5; OpenSpec strict validation reports valid. Real cross-campaign insertion is explicitly required by Plan 06 and has not run yet.
- **Committed in:** `5e1bd527`.

**Total deviations:** 1 reviewer-requested correction. **Impact:** closes a data-integrity gap while preserving append-only history and leaving original snapshots unchanged.

## Issues Encountered

- An initial composed PowerShell preflight command had a quoting/parser error before execution; it invoked no database command. The corrected preflight passed, and the following isolated `db lint` exited 0.
- The first focused test attempt exposed incomplete behavior in the in-memory Supabase query fake; the fake was corrected to mirror the query builder/row mapping and the final suite passed 5/5.

## User Setup Required

None.

## Next Phase Readiness

- The cross-campaign association gap is corrected in the migration and aligned with the OpenSpec spec, design/tasks, and Plans 04/06. Correction validations pass. Await user re-review/approval before Plan 05.
- Plan 06 now requires a real test using existing campaign A and an existing snapshot belonging to existing campaign B, checking the deterministic rejection and both individual FK failures. That real integration test has not yet run.
- For Plan 06, repeat all plan-listed isolation/service checks immediately before each database command. Vector is recorded as a non-blocking anomaly (147 restarts at the correction preflight); stop only if a required service is affected or a command fails. Do not restart/remove Vector to pass the gate.
- Keep the F56.1 volume/network and backup intact; no remote migration push is authorized by this plan.

---
*Phase: 56.2-preparacao-nao-operacional-produto-1-1*
*Completed: 2026-10-07*
