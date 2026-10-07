---
phase: 56.2-preparacao-nao-operacional-produto-1-1
plan: 03
subsystem: prompt-composition
tags: [product-1-1, prompt, policies, equivalence, vitest]

# Dependency graph
requires:
  - phase: 56.2-preparacao-nao-operacional-produto-1-1
    provides: explicit intent/background types and inactive selection contracts from Plan 02
provides:
  - frozen Product 1:1 prompt base, policy contracts, six frozen policy identities, and full policy registry
  - autonomous deterministic Product composer exposing text, blocks and versions
  - full F48.2.6 text/block/policy-version equivalence tests
affects: [56-2-04, 56-2-05, 56-2-06, 56.2b1]

# Tech tracking
tech-stack:
  added: []
  patterns: [product-owned frozen prompt policy registry, shared canonical block labels, exact bench equivalence only in tests]

key-files:
  created:
    - src/lib/product-1-1/prompt-base.ts
    - src/lib/product-1-1/prompt-composition.ts
    - src/lib/product-1-1/policies/types.ts
    - src/lib/product-1-1/policies/produto.ts
    - src/lib/product-1-1/policies/oferta.ts
    - src/lib/product-1-1/policies/destaque.ts
    - src/lib/product-1-1/policies/exclusivo.ts
    - src/lib/product-1-1/policies/formato-1-1.ts
    - src/lib/product-1-1/policies/general-integrity.ts
    - src/lib/product-1-1/policies/registry.ts
    - src/lib/product-1-1/__tests__/prompt-composition.contract.test.ts
    - src/lib/product-1-1/__tests__/prompt-composition.equivalence.test.ts
  modified: []

key-decisions:
  - "The productive runtime owns frozen copies of F48.2.6 policies; bench modules are imported only by equivalence tests."
  - "The general integrity policy v48.2.5 is applied once to constraints and surfaced as policyVersions.geral."
  - "Structure peca-unica and neutral theme none remain represented and versioned to preserve the complete bench policyVersions object."

patterns-established:
  - "Product policy resolution preserves the bench dimension order and appends the general policy once."
  - "The core composer serializes canonical blocks without I/O, provider access, or mutable bench registry reads."

requirements-completed: [REQ-56.2a-10, REQ-56.2a-11, REQ-56.2a-12, REQ-56.2a-13, REQ-56.2a-14]

# Metrics
duration: 39m
completed: 2026-10-07
---

# Plan 03: Versioned Product 1:1 prompt composition

**Product 1:1 now composes the frozen F48.2.6 baseline with exact text, blocks, and complete policy-version equivalence while keeping the bench out of runtime.**

## Performance

- **Duration:** ~39 minutes
- **Started:** 2026-10-07T15:03:20-03:00
- **Completed:** 2026-10-07T15:42:04-03:00
- **Tasks:** 4/4 (Task 1a, 1b, 2, and 3)
- **Files modified:** 12 created files

## Accomplishments

- Froze the approved prompt-base content/version and independent productive policy types/registry.
- Copied Product v4, all three intent policies, 1:1 format, and general integrity v48.2.5. Added the baseline `peca-unica` and `tema=nenhum` policy identities/versions in the product-owned registry.
- Implemented a pure deterministic composer with canonical blocks and returned `composerVersion`, `promptBaseVersion`, and all `policyVersions`.
- Equivalence tests compare exact text, block objects, and policy-version objects for all **9 combinations** of three intentions × three background directions, including product name with numeral/unit and two references. The productive composer receives the prompt-base content imported from the bench in the comparison, with an explicit assertion that the Product-owned frozen content/version is equal to the bench copy.
- Validation: `npm run typecheck`, `npm run lint`, and `npm run build` exit 0; focused Vitest **15/15 passed**; runtime source search found no `lab/bench` imports; `git diff --name-only 335bfb70..HEAD -- src/lib/lab/bench/**` was empty.
- No DB operations, migrations, provider calls, activation, or production wiring occurred.

## Task Commits

1. **Task 1a: frozen prompt base and policy contracts** — `d6a42efb`
2. **Task 1b: frozen policy set and complete registry** — `1412ed62`
3. **Task 2: Product prompt composer** — `e335ab5d`
4. **Task 3: contract and F48.2.6 equivalence tests** — `9d9ed737`, `f4fbec72` (explicit frozen prompt-base comparison requested after plan review)

**Plan adjustment:** full baseline additions for general integrity, structure, and theme were approved and plan-checked (`441eacab`).

## Files Created/Modified

- `src/lib/product-1-1/prompt-base.ts` — prompt base version/content frozen.
- `src/lib/product-1-1/policies/types.ts` — canonical blocks, briefing and policy contracts.
- `src/lib/product-1-1/policies/*.ts` — product, intent, format, general integrity, and registry entries.
- `src/lib/product-1-1/prompt-composition.ts` — pure canonical-block composer and versioned result.
- `src/lib/product-1-1/__tests__/prompt-composition.contract.test.ts` — block order, versions, registry, determinism, source boundary.
- `src/lib/product-1-1/__tests__/prompt-composition.equivalence.test.ts` — exact bench baseline comparisons.

## Decisions Made

- The previously identified baseline gap was resolved by the responsible person: include general integrity plus structure/theme identities instead of weakening the equality baseline.
- The production composer resolves only product-owned frozen policies; benchmark imports are limited to the equivalence test.

## Deviations from Plan

The plan was updated with the user's authorization to include the full `generalIntegrityPolicy`, `peca-unica`, and `tema=nenhum` baseline. No behavioral scope was reduced or added beyond the full approved equivalence requirement.

## Issues Encountered

The Plan 03 `read_first` path for the bench policy resolver was already correct (`domain/policies/resolve-bench-prompt-policies.ts`); an earlier lookup omitted the `policies/` segment. No source-plan path correction was needed.

## User Setup Required

None.

## Next Phase Readiness

- Plan 04 remains blocked on its isolated DB preconditions and the pending Vector/credential-output gates recorded in the handoff.
- Stop here and await explicit approval before Plan 04.

---
*Phase: 56.2-preparacao-nao-operacional-produto-1-1*
*Completed: 2026-10-07*
