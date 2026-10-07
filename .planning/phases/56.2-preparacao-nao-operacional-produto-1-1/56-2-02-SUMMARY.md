---
phase: 56.2-preparacao-nao-operacional-produto-1-1
plan: 02
subsystem: product-selection
tags: [product-1-1, domain, selectors, validation, react, vitest]

# Dependency graph
requires:
  - phase: 56.2-preparacao-nao-operacional-produto-1-1
    provides: fail-closed feature-flow decision and frozen validation status from Plan 01
provides:
  - explicit Product 1:1 intent and background-direction contracts
  - exact-one-product-image Original validator that ignores identity images
  - inert, controlled React selectors with no API/service wiring
affects: [56-2-03, 56-2-05, 56.2b1]

# Tech tracking
tech-stack:
  added: []
  patterns: [pure selection-domain contracts, controlled presentational radio selectors, identity-excluded product-image counting]

key-files:
  created:
    - src/lib/product-1-1/intent-selection.ts
    - src/lib/product-1-1/background-direction.ts
    - src/lib/product-1-1/selection-validation.ts
    - src/components/product-1-1/intent-selector.tsx
    - src/components/product-1-1/background-direction-selector.tsx
    - src/lib/product-1-1/__tests__/intent-selection.test.ts
    - src/lib/product-1-1/__tests__/selection-validation.test.ts
    - src/components/product-1-1/__tests__/selectors-inactive.test.tsx
  modified: []

key-decisions:
  - "The explicit intent selection is represented directly and never replaced by price inference."
  - "Background prompt instructions are frozen in this product module; the bench is not a runtime dependency."
  - "Original requires exactly one product image; identity images are excluded from the product count."
  - "Selectors are controlled presentational components only and are not wired into any productive app route."

patterns-established:
  - "Domain validation returns a typed field-error contract and never uses IMG-001."
  - "Inactive selectors use native fieldsets/radios, stable test IDs, accessible alerts, and controlled props."

requirements-completed: [REQ-56.2a-05, REQ-56.2a-06, REQ-56.2a-07, REQ-56.2a-08, REQ-56.2a-09]

# Metrics
completed: 2026-10-07
---

# Plan 02: Inactive intent and background selection

**Pure Product 1:1 selection contracts and controlled selectors now represent intent, background direction, and Original eligibility without entering the legacy flow.**

## Performance

- **Duration:** ~12 minutes
- **Started:** 2026-10-07T14:40:00-03:00
- **Completed:** 2026-10-07T14:52:00-03:00
- **Tasks:** 3/3
- **Files modified:** 8 created

## Accomplishments

- Added closed explicit intent and background-direction values/labels; copied the frozen prompt instructions without importing the bench at runtime.
- Added a typed field-validation result for Original, requiring exactly one product image; identity images do not count.
- Added two client-side controlled radio selectors with native fieldset/radio semantics, labels, `data-testid`, and accessible field-error alerts. No route, service, API, or legacy flow imports them.
- Validation: typecheck exit 0, lint exit 0, focused tests **14/14 passed**, static check confirms no selector wiring under `src/app`/`src/components/flow`, and no `IMG-001`/bench runtime imports in the domain files.
- No DB reset/lint/push, provider call, activation, or production change.

## Task Commits

1. **Task 1: Domain contracts and Original field validation** — `74fa3448`
2. **Task 2: Inactive presentational selectors** — `408e34e3`
3. **Task 3: Domain/component/non-exposure tests** — `25d64d94`

## Files Created/Modified

- `src/lib/product-1-1/intent-selection.ts` — explicit intent union, labels, and identity-preserving contract.
- `src/lib/product-1-1/background-direction.ts` — closed directions, labels, and frozen prompt instructions.
- `src/lib/product-1-1/selection-validation.ts` — Original eligibility and product-only count helper.
- `src/components/product-1-1/intent-selector.tsx` — controlled, inert intent radios.
- `src/components/product-1-1/background-direction-selector.tsx` — controlled, inert background radios.
- Three focused test files for domain, validation, component behavior, and app non-exposure.

## Decisions Made

- Followed the approved no-wiring boundary: components are available for later integration but are not mounted or imported by the productive app.
- Preserved intent exactly as explicitly selected; did not reuse or copy price-based intent inference.

## Deviations from Plan

None — plan executed as written.

## Issues Encountered

None in Plan 02 implementation. Operational follow-ups remain in the handoff: correct credential-output filtering before any future credential query, and re-evaluate the F56.2a Vector container before Plans 04/06.

## User Setup Required

None.

## Next Phase Readiness

- Plan 03 can proceed only after explicit user approval.
- All newly created selectors remain inactive; Product 1:1 routing/provider/credit/delivery/download remain outside this plan.

---
*Phase: 56.2-preparacao-nao-operacional-produto-1-1*
*Completed: 2026-10-07*
