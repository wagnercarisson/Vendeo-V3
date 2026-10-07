---
phase: 56.2-preparacao-nao-operacional-produto-1-1
plan: 01
subsystem: feature-flags
tags: [supabase, feature-flags, fail-closed, server-only, vitest]

# Dependency graph
requires:
  - phase: 56.1-contrato-produtivo-modelos-e-fallback
    provides: isolated Docker/Supabase conventions, audited admin flag RPC, F56.1 model-pair infrastructure
provides:
  - two disabled-by-default Product 1:1 feature-flag keys through the existing audited RPC
  - pure deterministic legacy/new_flow decision and server-only fail-closed resolution
  - local-only seed migration; not applied to any database
affects: [56-2-02, 56-2-03, 56-2-04, 56-2-05, 56-2-06, 56.2b1]

# Tech tracking
tech-stack:
  added: []
  patterns: [pair-status validation before applying feature-flag precedence, testable server-only feature-flag service]

key-files:
  created:
    - supabase/migrations/20261006000001_f56_2a_feature_flags_keys.sql
    - src/lib/product-1-1/feature-flow-decision.ts
    - src/lib/product-1-1/feature-flow-decision-service.ts
    - src/lib/product-1-1/__tests__/feature-flow-decision.test.ts
  modified:
    - src/lib/feature-flags/feature-flag-service.ts
    - src/lib/feature-flags/__tests__/feature-flag-service.test.ts
    - src/app/(app)/admin/feature-flags/page.tsx
    - openspec/changes/fase-56-2a-preparacao-nao-operacional-produto-1-1/specs/product-1-1-flow-activation/spec.md
    - .planning/phases/56.2-preparacao-nao-operacional-produto-1-1/56-2-ISOLATED-INSTANCE.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/HANDOFF.json

key-decisions:
  - "A missing/error/invalid result for either F56.2a flag invalidates the pair; the resolver forces both false before applying precedence."
  - "Only a fully valid pair may select new_flow; this remains a decision contract and does not route or generate campaigns."
  - "The isolated recovery was explicitly authorized after the conflicting container ID was confirmed absent; exactly one recovery start was performed with only Mailpit excluded."

patterns-established:
  - "Feature-flag pair reads retain a per-key reliability status so valid false is distinguishable from missing/error/invalid."
  - "Plan 01 startup gates are separate from downstream DB gates; post-start status is captured without printing env output."

requirements-completed: [REQ-56.2a-01, REQ-56.2a-02, REQ-56.2a-03, REQ-56.2a-04, REQ-56.2a-18, REQ-56.2a-19]

# Metrics
completed: 2026-10-07
---

# Plan 01: Disabled feature flags and fail-closed flow decision

**The two Product 1:1 flags are registered inactive, and only a fully valid server-side flag pair can select the new-flow contract.**

## Performance

- **Duration:** ~20 minutes of Plan 01 implementation after the startup gate
- **Started:** 2026-10-07T14:15:55-03:00
- **Completed:** 2026-10-07T14:36:01-03:00
- **Tasks:** 4/4 (Task 0 gate, Tasks 1–3 implementation/tests)
- **Files modified:** 13 tracked artifacts/code files, plus this summary

## Accomplishments

- Registered `product_1_1_test_stores_enabled` and `product_1_1_all_stores_enabled` as false-by-default idempotent seeds; added human-readable administrative labels while reusing `admin_update_feature_flag`.
- Added pure deterministic precedence and a server-only resolver. A valid general flag wins; any missing, error, or invalid status for either flag forces the pair to false and keeps the legacy flow.
- Captured the isolated recovery result: exact project ID, loopback API, dedicated DB/PostgREST/Auth/Kong services and preserved F56.1. `recovery_poststart_gate: passed`.
- Added the two mixed-read contract cases to the active OpenSpec spec and tests: general=true + test-store read failure, and test-store=true + general read failure both return legacy.
- Validation: `npm run typecheck` exit 0; `npm run lint` exit 0; focused Vitest **35/35 passed** (24 feature-flag tests + 11 decision tests); `git diff --check` passed.

## Task Commits

1. **Task 0: isolated startup/preflight record and recovery gate** — `cf091b2d`, `2ec965e1`, `847f8294`, `938d2cfa` (setup and gate evidence; recovery was explicitly authorized, no rename and no retry after this recovery)
2. **Task 1: register fail-closed feature flags** — `dc4f0961`
3. **Task 2: pure decision and status-aware pair reader** — `f02be90c`, `6caa7b58`
4. **Task 3: mixed-read failure and non-activation tests** — `bad4e7e4`

## Files Created/Modified

- `src/lib/feature-flags/feature-flag-service.ts` — key constants, boolean methods, pair-read statuses, fail-closed behavior.
- `src/app/(app)/admin/feature-flags/page.tsx` — labels only; no new activation control.
- `supabase/migrations/20261006000001_f56_2a_feature_flags_keys.sql` — local-only disabled seeds and commented REVERT; **not applied**.
- `src/lib/product-1-1/feature-flow-decision.ts` — pure precedence function.
- `src/lib/product-1-1/feature-flow-decision-service.ts` — server-only resolver; no routing/provider side effects.
- `src/lib/feature-flags/__tests__/feature-flag-service.test.ts` — added key/fallback/env tests.
- `src/lib/product-1-1/__tests__/feature-flow-decision.test.ts` — 11 decision, pair-status, mixed-error, and static-boundary tests.
- Active OpenSpec activation spec and Plan 01 — clarified pair failure contract and mixed cases.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/HANDOFF.json`, and `56-2-ISOLATED-INSTANCE.md` — execution/gate tracking.

## Decisions Made

- If either pair read is not valid, the resolver treats both as false. This prevents a valid `all_stores=true` from bypassing an unreadable test-store key, and vice versa.
- No environment override was added for either new feature flag.
- The startup recovery uses the exact fixed workdir and excludes only `mailpit`; no retry or manual container removal followed it.

## Deviations from Plan

The responsible person clarified that per-key boolean fallback alone cannot distinguish valid false from read failure. The activation spec and Plan 01 were updated to require pair-read status tracking and both mixed cases. Existing boolean method behavior remains unchanged; no feature scope was added.

## Issues Encountered

- The first start failed on an existing Vector container-name conflict. The responsible person explicitly authorized one recovery after read-only inspection confirmed the ID absent and no rename occurred. The recovery returned exit 0 and the required API/service gate passed.
- Vector was observed restarting after start (restart count 13). The Plan 01 gate's required DB, PostgREST, Auth, and Kong containers were healthy/running; Vector is recorded as a non-blocking observation for later review.
- No `db reset`, `db lint`, migration application, `db push`, provider call, or activation was performed.

## User Setup Required

None for this plan.

## Next Phase Readiness

- Plan 02 is ready to be considered after approval of this completed Plan 01.
- The F56.2a environment remains inert: no application routing, provider use, credit, delivery, or download was activated. The final human UAT checkpoint remains in Plan 06.

---
*Phase: 56.2-preparacao-nao-operacional-produto-1-1*
*Completed: 2026-10-07*
