---
phase: 51.1-landing-visual-produto
plan: "04"
subsystem: ui
tags: [nextjs, react, tailwind, landing, conversion, offer, flag-aware, primitive-consumers]

# Dependency graph
requires:
  - phase: 51-1-01
    provides: human-approved visual candidate, approved offer title/message and copy (checkpoint APPROVED)
  - phase: 51-1-03
    provides: block sections and established section primitives-consumer pattern
provides:
  - "Independent free-trial offer block (title, verbatim main message, secondary mechanics disclosure, closed-beta clarification)"
  - "Flag-aware offer CTA forwarding publicSignupEnabled to the shared AcquisitionCta"
  - "Stable test hooks data-offer-block / data-offer-mechanics for plan 51-1-07"
affects: [51-1-05, 51-1-06, 51-1-07, 51-1-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent offer component: pure server component, no client state, no fetch, no env/flag reads; flag forwarded as a prop only"
    - "Mechanics confined to a secondary <details> disclosure (data-offer-mechanics) never in the main message"
    - "Section consumes the shared AcquisitionCta (D-19 dark-on-green) instead of hand-rolling a CTA"

key-files:
  created:
    - src/components/landing/offer-section.tsx
  modified: []

key-decisions:
  - "D-10/D-11 applied: short approved main message as the block's prominent text; all credit mechanics and the closed-beta clarification live ONLY in the secondary <details> disclosure."
  - "D-12 applied: the offer never reads env/flags; it accepts publicSignupEnabled and forwards it to the shared AcquisitionCta, keeping the same flag mode as hero/final."
  - "The word 'onboarding' is present literally in the secondary disclosure because the plan's acceptance criteria and the plan 51-1-07 test assert it inside [data-offer-mechanics]; this follows the plan-derived contract even though UI-SPEC copywriting guidance lists 'onboarding' among internal terms to avoid in public copy (documented tension, no scope impact)."

patterns-established:
  - "Offer as an independent, easily updatable block separated from the FAQ/CTA section"
  - "Secondary disclosure via native <details> with a stable data hook for test targeting"

requirements-completed: [REQ-51.1-06, REQ-51.1-10]

# Metrics
duration: 2 min
completed: 2026-10-09
---

# Phase 51.1 Plan 04: Independent free-trial offer block Summary

**Independent, pure-server `OfferSection` shipped with the approved title and verbatim main message, the credit mechanics confined to a secondary `<details>` disclosure, the closed-beta clarification, and a flag-aware CTA forwarding `publicSignupEnabled` to the shared `AcquisitionCta`.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-10-09T12:41:48-03:00
- **Completed:** 2026-10-09T12:43:03-03:00
- **Tasks:** 2
- **Files modified:** 1 created (0 modified)

## Accomplishments
- `offer-section.tsx` (block 6): pure server component with `<section data-offer-block aria-labelledby>`, `<h2>` title "Teste gratuitamente, sem cartão de crédito", and the verbatim prominent main message "Experimente o Vendeo em sua loja: 28 dias gratuitos e até 20 créditos." in `font-heading`/`text-text-secondary` on a `bg-bg-surface`/`border-border` card.
- Credit mechanics kept strictly in a de-emphasized `<details data-offer-mechanics>` disclosure: period starts after completing the onboarding; 5 initial credits + 5 more on days 7, 14 and 21; accumulation (including installments released during absence); maximum of 20; remaining free credits expire at the end of the period.
- Closed-beta clarification inside the disclosure: "No beta fechado, solicitar acesso não inicia o período da oferta."
- Acquisition action is the shared primitive `<AcquisitionCta publicSignupEnabled={publicSignupEnabled} />` — no hand-rolled green CTA; the component never reads env/flags and never fetches.

## Task Commits

Each task was committed atomically on `escopo/landing`:

1. **Task 1: Implement the offer main message, secondary mechanics and the flag-aware CTA** - `5a2ebdb9` (feat)
2. **Task 2: Add the closed-beta clarification and anti-promise safeguards** - `c4be4c5a` (feat)

**Plan metadata:** (see final docs commit)

## Files Created/Modified
- `src/components/landing/offer-section.tsx` - Independent free-trial offer block (title, verbatim message, secondary mechanics, closed-beta clarification, flag-aware `AcquisitionCta`).

## Decisions Made
- **Mechanics containment (D-10/D-11):** the main message is a single short sentence; every mechanic lives only in the secondary `<details>` so the prominent copy stays short and updatable.
- **Flag contract (D-12):** `OfferSection` is prop-driven (`publicSignupEnabled: boolean`) and forwards the value to the shared `AcquisitionCta`; it never reads `getLaunchConfig`/env/flags itself, matching hero/final.
- **Test hooks:** `data-offer-block` (section root) and `data-offer-mechanics` (disclosure) added for plan 51-1-07 targeting.
- **'onboarding' term:** included literally in the secondary disclosure per the plan acceptance criteria and the downstream offer test assertion, despite UI-SPEC copywriting guidance listing it as an internal term (documented tension; followed the operational plan contract).

## Deviations from Plan

None - plan executed exactly as written. (One in-progress self-correction: the initial explanatory code comment literally contained the forbidden phrases, which tripped the anti-promise grep; the comment was rewritten before the Task 1 commit so the committed file is clean. This is not a deviation — acceptance was verified green on the commit.)

## Issues Encountered

### Pre-existing, out-of-scope: `npm run typecheck` cannot exit 0 on this branch base
- `npm run typecheck` reports exactly one error, in an **untouched F56 test file**:
  `src/lib/ai/__tests__/image-generation-operations-repository.integration.test.ts(139,68): error TS2353: ... 'ssl' does not exist in type '{ connectionString?: string | undefined; }'`.
- **Cause:** `src/types/external-modules.d.ts` (shared ambient `pg` declaration) lacks `ssl`; the upstream fix (`92059829` on `feature/fase-56-1-...`) is absent from `escopo/landing`.
- **Action taken:** *not fixed* (pre-existing, outside this plan's authorized scope; F56/shared-contract changes forbidden; installs prohibited). Already logged in `.planning/phases/51.1-landing-visual-produto/deferred-items.md`.
- **Proof the plan's own file is clean:** the typecheck output contains **zero** errors attributed to `src/components/landing/offer-section.tsx`.
- `npm run lint` exits 0.

## Verification Evidence

Acceptance-criteria greps (all PASS) on the committed file:

**Task 1**
- `rg -c "Experimente o Vendeo em sua loja: 28 dias gratuitos e até 20 créditos\."` = 1
- `rg -c "AcquisitionCta"` = 3; `rg -n "publicSignupEnabled"` shows line 40 `<AcquisitionCta publicSignupEnabled={publicSignupEnabled} />` (prop forwarded)
- `rg -c "dias 7, 14 e 21"` = 1; `rg -c "máximo"` = 1; `rg -c "onboarding"` = 1
- Line separation: `rg -n "28 dias gratuitos|dias 7, 14 e 21"` → main message at line 35, mechanics at line 52 (different lines)
- `rg -c "ilimitado|20 campanhas"` = 0 (no matches); `rg -c "getLaunchConfig|use client|fetch\("` = 0 (no matches)

**Task 2**
- `rg -c "não inicia o período|não inicia o período da oferta"` = 1 (line 65, inside the `data-offer-mechanics` disclosure that starts at line 43)
- `rg -c "data-offer-block"` = 1; `rg -c "data-offer-mechanics"` = 1
- `rg -n "fetch\(|use client|generation|provider"` → no matches
- `rg -c "implementação|dependência técnica"` = 0 (no matches)
- `rg -n "publicSignupEnabled"` still shows the prop forwarded to `AcquisitionCta`

**Gates**
- `npm run lint`: exit 0.
- `npm run typecheck`: single pre-existing out-of-scope error only (see Issues); **zero** errors in the new file.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. The component renders static approved copy and the shared CTA; it is not wired to any data source that could be empty.

## Threat Flags
None. The file introduces only public static copy and reuses the existing shared primitive; no new network endpoint, auth path, file-access pattern or schema change is added. Threat register items T-51.1-04-01..04 are satisfied by the acceptance greps above (anti-promise greps clean; mechanics confined to the secondary disclosure; no flag/network access inside the component; CTA is the shared `AcquisitionCta`).

## Next Phase Readiness
- `OfferSection` is ready to be consumed by plan **51-1-05** (`page.tsx` rewire: `<OfferSection publicSignupEnabled={publicSignupEnabled} />` after `ApproachSection`) and tested by plan **51-1-07** (both flag modes; mechanics inside `[data-offer-mechanics]`; no "ilimitado"/"20 campanhas"; closed-beta "não inicia o período").
- Non-blocking branch-base blocker unchanged: the pre-existing `pg`/`ssl` typecheck error needs the upstream `92059829` fix to reach a fully green typecheck.

---
*Phase: 51.1-landing-visual-produto*
*Completed: 2026-10-09*

## Self-Check: PASSED

- FOUND: src/components/landing/offer-section.tsx
- FOUND commit: 5a2ebdb9 (Task 1)
- FOUND commit: c4be4c5a (Task 2)
- All Task 1/2 acceptance-criteria greps PASS (see Verification Evidence).
