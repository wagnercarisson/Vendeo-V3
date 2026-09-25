---
phase: 48.2.1-otimizacao-prompts-diretor
plan: 48-2-1-01
subsystem: lab
tags: [supabase, migration, rls, rpc, budget, zod, vitest, director-prompts]

requires:
  - phase: 48.1-laboratorio-ia-minimo
    provides: lab_* tables, lab_reserve_run/lab_create_experiment RPCs, freeze triggers, lab domain
provides:
  - "lab_prompt_programs (budget_usd/reserved/consumed, matrix_version, report/recommendation) with RLS service_role-only"
  - "lab_experiments.campaign_intent (backfill 'offer' + NOT NULL + CHECK) and program_id FK"
  - "lab_human_evaluations.rubric JSONB and lab_runs.reserved_cost_usd/budget_settled_at"
  - "post-first-run freeze extended to campaign_intent/program_id"
  - "lab_create_experiment recreated with 14 args (intent/program); lab_reserve_run recreated with 9 args (estimated cost) + program budget reserve/settle/release RPCs"
  - "DIRECTOR_PROMPTS allowlist (offer/spotlight/exclusive) and prompt derived from campaignIntent"
  - "program-service with remainingUsd; programId in LabRunSnapshot"
affects: [48.2.1-02, 48.2.1-03, 48.2.1-04, 48.2.1-05, 48.2.1-09]

tech-stack:
  added: []
  patterns:
    - "Atomic budget reservation inside the run reservation transaction (program lock FOR UPDATE before any paid call)"
    - "Idempotent settle/release keyed by lab_runs.budget_settled_at"
    - "Old RPC signatures dropped ahead (not only in REVERT) to prevent overload bypass"
    - "Pure CAMPAIGN_INTENTS in schemas.ts; DIRECTOR_PROMPTS literal in server-only prompt-snapshot.ts (avoids server-only leaking into client-safe schema)"

key-files:
  created:
    - supabase/migrations/20260925000001_f48_2_1_lab_prompt_programs.sql
    - src/lib/lab/domain/program-service.ts
    - src/lib/lab/__tests__/lab-prompt-optimization.contract.test.ts
    - .planning/phases/48.2.1-otimizacao-prompts-diretor/deferred-items.md
  modified:
    - src/lib/lab/domain/prompt-snapshot.ts
    - src/lib/lab/domain/schemas.ts
    - src/lib/lab/domain/experiment-service.ts
    - src/lib/lab/run-snapshot.ts
    - src/lib/lab/run-service.ts
    - src/lib/lab/api/run-execution.ts
    - src/lib/lab/__tests__/run-snapshot.test.ts
    - src/lib/lab/__tests__/run-service.test.ts
    - src/lib/lab/__tests__/snapshot-fixtures.contract.test.ts
    - src/lib/lab/__tests__/lab-runs.contract.test.ts
    - src/lib/lab/__tests__/lab-financial-safety.contract.test.ts
    - src/lib/lab/__tests__/lab-isolation.contract.test.ts
    - src/lib/lab/domain/__tests__/schemas.test.ts
    - src/lib/lab/domain/__tests__/experiment-service.test.ts
    - src/lib/lab/domain/__tests__/lab-experiments.contract.test.ts
    - src/lib/lab/domain/__tests__/prompt-snapshot.test.ts
    - src/lib/lab/api/__tests__/run-execution.test.ts
    - src/app/api/admin/laboratorio/__tests__/route.test.ts
    - src/app/api/admin/laboratorio/__tests__/lab-admin-api.contract.test.ts

key-decisions:
  - "Budget reservation extended in-place in lab_reserve_run (9 args) with program lock + settle/release RPCs — atomic in the same run transaction"
  - "Old 8-arg lab_reserve_run and 12-arg lab_create_experiment dropped ahead of recreation to avoid a callable overload bypass"
  - "CAMPAIGN_INTENTS kept in the pure schemas.ts; DIRECTOR_PROMPTS literal kept in server-only prompt-snapshot.ts to avoid server-only in the client-safe schema"
  - "PROMPT_UNDER_TEST kept as a retrocompatible alias resolving to DIRECTOR_PROMPTS.offer"
  - "lab_experiments.program_id stays nullable in DB (historic F48.1 rows); required for new experiments at the domain/RPC layer"

patterns-established:
  - "Program budget: remaining = budget_usd - budget_consumed_usd - budget_reserved_usd, enforced under FOR UPDATE lock"
  - "Intent-derived prompt allowlist; mixed scenario intents rejected before the RPC"

requirements-completed: [lab-isolation, lab-experiments, lab-runs, lab-prompt-optimization]

duration: 40 min
completed: 2026-09-25
---

# Phase 48.2.1 Plan 01: Domínio, migration e programa Summary

**Additive local-first migration (lab_prompt_programs, campaign_intent/program_id, rubric, atomic USD budget RPCs) plus a domain that derives the director prompt from campaignIntent and freezes programId in the run snapshot**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-25T~16:00Z (first commit 16:21 -03:00)
- **Completed:** 2026-09-25T19:42Z
- **Tasks:** 5
- **Files modified:** 20 (4 created, 16 modified)

## Accomplishments

- Local-only additive migration validated with `npx supabase db reset` + `db lint` (exit 0); no remote `db push` executed.
- `lab_prompt_programs` with RLS/service_role-only grants; `campaign_intent` backfilled to `offer` before NOT NULL + CHECK; `program_id` FK; `rubric`; `reserved_cost_usd`/`budget_settled_at`; freeze trigger extended to intent/program.
- Atomic program budget: reserve (idempotent by `operation_id`, `program_not_authorized`/`budget_exceeded` before any paid call), settle (reserved→consumed with effective cost), release (frees without consuming) — all idempotent by `budget_settled_at`.
- Domain evolved to `DIRECTOR_PROMPTS` (offer/spotlight/exclusive), required `campaignIntent`/`programId`, intent-derived prompt, mixed-intent rejection, `programId` in `LabRunSnapshot`, `program-service` with `remainingUsd`.
- 609 lab tests green; full suite green except one pre-existing unrelated F50 legal test (deferred).

## Task Commits

1. **Task 1: Migration — programs, intent/program_id, rubric, freeze, create-experiment** - `5925b3e7` (feat)
2. **Task 2: Budget reserve/settle/release contract** - `3f17dc45` (feat)
3. **Task 3: REVERT block + local validation** - `f7b79075` (docs)
4. **Task 4: Domain evolution + legacy test co-migration** - `03694998` (feat)
5. **Task 5: Director prompt optimization contract tests** - `d9e88192` (test)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `supabase/migrations/20260925000001_f48_2_1_lab_prompt_programs.sql` - additive migration + commented REVERT
- `src/lib/lab/domain/program-service.ts` - program CRUD + `remainingUsd`
- `src/lib/lab/domain/prompt-snapshot.ts` - `DIRECTOR_PROMPTS` + intent-derived builders
- `src/lib/lab/domain/schemas.ts` - `CAMPAIGN_INTENTS`, campaignIntent/programId, rubric, prompt×intent refine
- `src/lib/lab/domain/experiment-service.ts` - intent/program RPC args, mixed-intent check, readiness codes
- `src/lib/lab/run-snapshot.ts` - `programId` in interface/builder/barrier
- `src/lib/lab/run-service.ts` - `program_not_authorized`, `p_estimated_cost_usd`, programId in prepare
- `src/lib/lab/api/run-execution.ts` - program assertion before reservation (deviation)
- `src/lib/lab/__tests__/lab-prompt-optimization.contract.test.ts` - new contract suite
- 15 test files co-migrated (snapshots, payloads, 9-arg reserve assertion)

## Decisions Made

- Extended `lab_reserve_run` in-place (9 args) rather than an auxiliary RPC — keeps budget atomic with the run transaction.
- Dropped old RPC signatures ahead of recreation (not only in REVERT) to avoid a callable overload that bypasses program/intent.
- Split intent constants (pure `schemas.ts`) from `DIRECTOR_PROMPTS` (server-only `prompt-snapshot.ts`) to keep `schemas.ts` client-safe.
- Kept `PROMPT_UNDER_TEST` as a retrocompatible alias of `DIRECTOR_PROMPTS.offer`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Co-migrated `src/lib/lab/api/run-execution.ts` (not in plan files_modified)**
- **Found during:** Task 4 (typecheck)
- **Issue:** `prepareLabRun` now requires `programId`; `run-execution.ts` calls it, so `npm run typecheck` failed.
- **Fix:** Read `program_id` in the experiment select, reject `program_not_authorized` before reservation, pass `programId` through.
- **Files modified:** `src/lib/lab/api/run-execution.ts`
- **Verification:** `npm run typecheck` exit 0; run-execution tests pass.
- **Committed in:** `03694998`

**2. [Rule 3 - Blocking] Co-migrated additional legacy test files not enumerated in the plan**
- **Found during:** Task 4/5 (full suite)
- **Issue:** `src/lib/lab/api/__tests__/run-execution.test.ts`, `src/app/api/admin/laboratorio/__tests__/route.test.ts` and `.../lab-admin-api.contract.test.ts` seeded experiments without `program_id` / creation payloads without `campaignIntent`/`programId`, failing after the domain change.
- **Fix:** Seeded `program_id`; added `campaignIntent`/`programId` to creation payloads; asserted the new `programId` prepare arg.
- **Verification:** `npx vitest run src/lib/lab` and `.../api/admin/laboratorio` green; full suite green except pre-existing legal test.
- **Committed in:** `d9e88192` (run-execution test also touched in `03694998`)

---

**Total deviations:** 2 auto-fixed (both blocking/co-migration)
**Impact on plan:** No scope creep; all fixes required for typecheck/test correctness. Budget/integration semantics unchanged.

## Issues Encountered

- Pre-existing unrelated failure: `src/lib/legal/__tests__/legal-document-versions.test.ts` (missing F50 `legal-consolidated-pending` file). Logged to `deferred-items.md`; not fixed (out of scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Migration foundation (programs, intent, budget RPCs) and domain contract are ready for plan 48-2-1-02 (diagnostics + scenario matrix).
- No remote schema change; the local DB is the only place the migration was applied.

---
*Phase: 48.2.1-otimizacao-prompts-diretor*
*Completed: 2026-09-25*

## Self-Check: PASSED

- Created files verified on disk (migration, program-service, contract test, SUMMARY).
- Task commits verified in git history: 5925b3e7, 3f17dc45, f7b79075, 03694998, d9e88192.
- `npm run typecheck` exit 0; `npx supabase db reset` + `db lint --fail-on error` exit 0; domain contract tests green.
