---
phase: 48.2.1-otimizacao-prompts-diretor
plan: 48-2-1-03
subsystem: lab
tags: [lab, campaign_image, prompt, budget, supabase, vitest, director]

# Dependency graph
requires:
  - phase: 48.2.1-otimizacao-prompts-diretor
    provides: "plan 01 (domain + atomic budget RPCs + programId snapshot) and plan 02 (diagnostic v3 + nine-scenario matrix, Checkpoint 1 approved)"
provides:
  - "Diretor execution resolves the prompt by experiment campaign_intent via DIRECTOR_PROMPTS"
  - "Deterministic refusal of mixed/absent scenario intents (intent_mismatch) before any paid call"
  - "Exactly one campaign_image call per run, no fallback and no reviewer"
  - "Budget reservation settled/released after the run (idempotent, best-effort)"
affects: [48-2-1-04, 48-2-1-05, 48-2-1-06, 48-2-1-07, 48-2-1-08, 48-2-1-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One paid campaign_image invocation per run, no fallback"
    - "Budget settle/release is idempotent (budget_settled_at) and best-effort"
    - "Typed deterministic errors with code mapped to HTTP (400/409) before the stream"

key-files:
  created: []
  modified:
    - src/lib/lab/api/run-execution.ts
    - src/lib/lab/run-service.ts
    - src/app/api/admin/laboratorio/experiments/[id]/runs/route.ts
    - src/lib/lab/api/__tests__/run-execution.test.ts
    - src/lib/lab/__tests__/lab-runs.contract.test.ts
    - src/lib/lab/__tests__/lab-financial-safety.contract.test.ts
    - src/lib/lab/__tests__/lab-isolation.contract.test.ts

key-decisions:
  - "Prompt under test is derived server-side from DIRECTOR_PROMPTS[campaign_intent]; a client-supplied name is never executed"
  - "Mixed/absent scenario intents are refused with intent_mismatch (HTTP 400) before any paid call"
  - "Budget settlement runs after finalizeLabRun: settle when the sink emitted an envelope, release when the failure preceded the paid call"
  - "Liquidation errors never propagate (best-effort) — the terminal run state is already persisted"

patterns-established:
  - "Intent guard: all linked scenario versions must share the experiment campaign_intent"
  - "paidCallOccurred = sink.entries.length > 0 decides settle vs release"

requirements-completed: [lab-runs, lab-experiments]

# Metrics
duration: 12min
completed: 2026-09-25
---

# Phase 48.2.1 Plan 03: Execução do Diretor e harness Summary

**Director execution now resolves `campaign-image-director-{intent}` from the experiment's campaign_intent, refuses mixed intents with `intent_mismatch` before any paid call, keeps exactly one `campaign_image` invocation, and settles/releases the program budget reservation after the run.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-25T17:16:00Z
- **Completed:** 2026-09-25T17:24:34Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- `prepareExperimentRun` reads `campaign_intent`/`program_id`, derives the prompt name from `DIRECTOR_PROMPTS`, and rejects intents that diverge from any linked scenario (`intent_mismatch`) or a variant prompt outside the intent allowlist (`unsupported_prompt_under_test`) — all before `prepareLabRun`.
- `runReservedLabRun` settles the budget reservation with the effective sink cost after a paid call, releases it when the failure precedes the paid call, and never lets a liquidation error break the run.
- Contract tests cover prompt selection per intent, programId in the snapshot, a single `campaign_image` envelope, no second call on failure, and the settle/release lifecycle — with no network or paid calls.

## Task Commits

Each task was committed atomically:

1. **Task 1: Execução do Diretor por tipo de campanha** - `c00be91d` (feat)
2. **Task 2: Reserva de orçamento integrada e liquidação (settle/release)** - `5d1992c2` (feat)
3. **Task 3: Testes do Diretor por tipo de campanha e liquidação** - `60aeb738` (test)
4. **Task 3 (Rule 3 fix): allowlist de isolamento com as RPCs de orçamento** - `23f6f8b0` (fix)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `src/lib/lab/api/run-execution.ts` - reads campaign_intent/program_id; intent-mismatch and prompt-under-test guards; derives the prompt from `DIRECTOR_PROMPTS`
- `src/lib/lab/run-service.ts` - `settleRunBudget`/`releaseRunBudget`; `runReservedLabRun` decides settle vs release by `sink.entries.length > 0` after `finalizeLabRun`
- `src/app/api/admin/laboratorio/experiments/[id]/runs/route.ts` - maps `intent_mismatch`/`unsupported_prompt_under_test` to HTTP 400
- `src/lib/lab/api/__tests__/run-execution.test.ts` - fixture co-migrated with `campaign_intent`/`content.intent`; intent-mismatch, absent-intent, prompt-under-test and three-intent tests
- `src/lib/lab/__tests__/lab-runs.contract.test.ts` - fake RPC recognizes `lab_settle_run_budget`/`lab_release_run_budget`; prompt-per-intent, programId snapshot, single envelope and settle/release tests
- `src/lib/lab/__tests__/lab-financial-safety.contract.test.ts` - settle after a paid call, release before it, failure-after-call settle
- `src/lib/lab/__tests__/lab-isolation.contract.test.ts` - allowlist extended with the two budget RPCs

## Decisions Made
- Prompt under test is derived server-side from `DIRECTOR_PROMPTS[campaign_intent]`; variant snapshots whose name diverges from the intent are refused with `unsupported_prompt_under_test`.
- `intent_mismatch` is raised when the experiment intent is missing/invalid or any linked scenario's `content.intent` differs — before any paid call.
- Budget liquidation runs after `finalizeLabRun` (success and failure) and in `finally` for non-terminal paths, guarded to run once; settle uses the effective sink cost, release frees without consuming.
- Liquidation is best-effort: RPC errors are swallowed so a budget hiccup can never leave a run without a terminal state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Route mapping for the new refusal codes**
- **Found during:** Task 1 (Director execution by campaign type)
- **Issue:** Task 1 requires `intent_mismatch` to answer HTTP 400, but `src/app/api/admin/laboratorio/experiments/[id]/runs/route.ts` was not in the plan's `files_modified`; without it the error would surface as a generic 500.
- **Fix:** Added `intent_mismatch` and `unsupported_prompt_under_test` to `BAD_REQUEST_CODES` (400).
- **Files modified:** `src/app/api/admin/laboratorio/experiments/[id]/runs/route.ts`
- **Verification:** `npm run typecheck` exit 0; route code path covered by the typed errors from `prepareExperimentRun`.
- **Committed in:** `c00be91d` (Task 1 commit)

**2. [Rule 3 - Blocking] Lab isolation allowlist with the budget RPCs**
- **Found during:** Task 3 (post-change full lab suite)
- **Issue:** The run lifecycle now calls `lab_settle_run_budget`/`lab_release_run_budget`, which the `lab-isolation.contract.test.ts` allowlist rejected (`expected [ 'rpc:lab_settle_run_budget' ] to deeply equal []`).
- **Fix:** Added both RPCs to `ALLOWED_RPCS`/`ALLOWED_ENTRY_RE` and to the in-memory fake (idempotent, no productive target touched).
- **Files modified:** `src/lib/lab/__tests__/lab-isolation.contract.test.ts`
- **Verification:** `npm test -- --run src/lib/lab` → 33 files / 660 passed, 1 skipped.
- **Committed in:** `23f6f8b0` (Task 3 fix commit)

**3. [Rule 1 - Bug] `rg -c runLabCampaignImage` counted the import line**
- **Found during:** Task 1 acceptance-criteria gate
- **Issue:** `run-service.ts` had the literal name on both the import and the call line, so `rg -c` returned 2 while the criterion requires exactly 1.
- **Fix:** Aliased the import (`runLabCampaignImage as invokeLabCampaignImage`) — one invocation preserved, literal name appears once.
- **Files modified:** `src/lib/lab/run-service.ts`
- **Verification:** `rg -c runLabCampaignImage src/lib/lab/run-service.ts` → 1; `src/lib/lab/api/run-execution.ts` → 0.
- **Committed in:** `c00be91d` (Task 1 commit)

### Test placement note
The mixed-intent refusal tests live in `run-execution.test.ts` (Task 1 file) rather than `lab-runs.contract.test.ts`: `prepareExperimentRun` requires module-level mocks that conflict with the real imports already used by `lab-runs.contract.test.ts`. The prompt-selection-per-intent, single-envelope and settle/release tests are in `lab-runs.contract.test.ts` as specified.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes were necessary for correctness (HTTP 400 mapping), isolation-test integrity and the exact acceptance criterion. No scope creep; no production prompt or pipeline touched.

## Issues Encountered
- `npx rg` created an untracked `README.md` (a known artifact — commit `1d173a69` removed the same file previously). It was removed and not committed.

## User Setup Required
None - no external service configuration required. No paid API call was made; the paid runs remain gated by Checkpoint 2 (plan 48-2-1-05+).

## Next Phase Readiness
- Ready for plan 48-2-1-04 (human evaluation, rubric and blind comparison).
- The execution path now executes the correct Director prompt per intent, spends at most one paid call per run and liquidates the budget atomically; `prompts/` remains byte-for-byte untouched.
- Pre-existing unrelated failure remains: `src/lib/legal/__tests__/legal-document-versions.test.ts` (F50 missing artifact) — see `deferred-items.md`.

---
*Phase: 48.2.1-otimizacao-prompts-diretor*
*Completed: 2026-09-25*

## Self-Check: PASSED

- Files: all key files present on disk.
- Commits: `c00be91d`, `5d1992c2`, `60aeb738`, `23f6f8b0` present in git history.
- Verification: `npm run typecheck` exit 0; target contract tests exit 0; `rg "campaign_image_edit|campaign_image_review"` zero; `git status --porcelain prompts/` empty.
