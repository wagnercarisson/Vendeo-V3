---
phase: 56.2-preparacao-nao-operacional-produto-1-1
plan: 05
subsystem: testing
tags: [non-activation, legacy-frontier, feature-flags, vitest]

# Dependency graph
requires:
  - phase: 56.2-preparacao-nao-operacional-produto-1-1
    provides: fail-closed flow decision, inactive Product 1:1 components, and frozen composition from Plans 01–03
  - phase: 56.2-preparacao-nao-operacional-produto-1-1
    provides: append-only operation repository and same-campaign snapshot invariant from Plan 04
provides:
  - flag-combination contract proving the resolver makes a decision without routing or generation effects
  - static non-exposure guard for Product 1:1 selectors, composition, and operations in legacy runtime
  - fixed-BASE_SHA test guard for the legacy production frontier
affects: [56-2-06, 56.2b1]

# Tech tracking
tech-stack:
  added: []
  patterns: [fixed-base git frontier guard, filesystem import-boundary contract, decision-versus-effect separation]

key-files:
  created:
    - src/lib/product-1-1/__tests__/non-activation.contract.test.ts
    - src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts
  modified: []

key-decisions:
  - "Exercise all supported flag/store combinations through the existing resolver and assert decision outputs only; do not add routing behavior."
  - "Keep the legacy frontier tied to literal BASE_SHA 335bfb70 and the exact plan pathspec, including the explicit F56.2a source exclusions."
  - "The cross-campaign database insertion remains a Plan 06 real integration test; Plan 05 performs no database operation."

patterns-established:
  - "Runtime boundary tests recursively scan application modules while excluding tests and the new Product 1:1 implementation subtree."
  - "Legacy-frontier tests invoke Git with argument arrays and fixed pathspecs, avoiding shell interpolation and moving-base comparisons."

requirements-completed: [REQ-56.2a-04, REQ-56.2a-09]

# Metrics
duration: ~6m
completed: 2026-10-07
---

# Plan 05: Non-activation and legacy-frontier guards

**Product 1:1 now has cross-cutting tests proving flag decisions remain effect-free, new modules stay outside shopper/legacy runtime imports, and the fixed-base production frontier remains empty.**

## Performance

- **Duration:** ~6 minutes (approximate)
- **Started:** 2026-10-07T16:35:00-03:00 (approximate)
- **Completed:** 2026-10-07T16:41:17-03:00
- **Tasks:** 3/3
- **Files modified:** 2 created

## Accomplishments

- Added `non-activation.contract.test.ts`: covers all eight combinations of the two flags and store classification, asserts resolver decisions and exactly one flag read, and statically rejects provider/generation/credit/delivery/download imports in decision modules.
- Added import-boundary scans proving no shopper route imports Product 1:1 selectors/composition and no legacy runtime module imports the new Product 1:1 modules or operation repository.
- Added `legacy-frontier.guard.test.ts`: checks the literal BASE_SHA `335bfb70`, verifies commit existence/ancestry, and runs the exact approved pathspec for production legacy files.
- Validation passed: focused Plan 05 + feature-flag suites **66/66 tests** across 8 files; `npm run typecheck`, `npm run lint`, and `npm run build` exit 0; `openspec validate fase-56-2a-preparacao-nao-operacional-produto-1-1 --strict` reports the change valid.
- The fixed-base legacy frontier diff is empty. Migration diff from BASE_SHA contains only the two added `*_f56_2a_*.sql` files. No DB command, provider call, paid call, activation, or `db push` occurred.

## Task Commits

1. **Task 1: Testes transversais de não-ativação e não-exposição** — `75ee18f8`
2. **Task 2: Gates automáticos sem chamada paga** — verification-only; no source changes.
3. **Task 3: Verificação da fatia, openspec validate e ausência de push** — verification-only; no source changes.

## Files Created/Modified

- `src/lib/product-1-1/__tests__/non-activation.contract.test.ts` — decision-only flag matrix and runtime import boundary.
- `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` — fixed BASE_SHA and legacy pathspec guard.

## Decisions Made

- A `new_flow` value remains a decision contract only in F56.2a; these tests prove no routing effect is connected.
- The legacy guard uses the exact fixed BASE_SHA and pathspec from the approved plan; it does not derive a moving comparison base.
- Plan 06 remains responsible for isolated DB reset/lint, the real same-campaign snapshot/FK integration cases, and the local UAT. Its gates must run immediately before every DB command. Vector remains a recorded non-blocking anomaly unless a required service is affected; do not restart/remove it to satisfy the gate.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- The first guard-test iteration assumed the BASE_SHA line was the first line of its evidence file. The test now searches the full file for the literal entry; the complete focused suite passes.

## User Setup Required

None.

## Next Phase Readiness

- Plan 05 is complete. Await user review/approval before Plan 06.
- Plan 06 must verify the real transaction cases, including valid campaign A plus a snapshot belonging to valid campaign B, alongside the independent invalid-ID FK cases.
- Before every Plan 06 database command, repeat the complete isolation/service gate. Record Vector status as an anomaly; stop only if a service required by that plan fails or the DB command fails. Never restart/remove Vector to pass the gate.

---
*Phase: 56.2-preparacao-nao-operacional-produto-1-1*
*Completed: 2026-10-07*
