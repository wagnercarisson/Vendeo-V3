---
phase: 51.1-landing-visual-produto
plan: "02"
subsystem: ui
tags: [nextjs, react, tailwind, landing, conversion, accessibility, contrast, flag-aware]

# Dependency graph
requires:
  - phase: 51-1-01
    provides: human-approved visual candidate, copy and image-function map (checkpoint APPROVED)
provides:
  - "Flag-aware shared acquisition CTA (`AcquisitionCta`) with D-19 dark-on-green primary"
  - "Fixed-ratio swappable campaign image/placeholder primitive (`CampaignImage`)"
affects: [51-1-03, 51-1-04, 51-1-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared flag-aware CTA: single server-passed `publicSignupEnabled` prop, no env/flag reads in the component"
    - "Fixed aspect-square image container with plain <img> (no Next Image) so asset swaps never relayout"
    - "D-19 contrast: dark `text-bg-deep` text on `bg-accent-green` (≈8.8:1), never white-on-green"

key-files:
  created:
    - src/components/landing/acquisition-cta.tsx
    - src/components/landing/campaign-image.tsx
  modified: []

key-decisions:
  - "D-19: primary CTA uses `text-bg-deep` (#020617) on `bg-accent-green`; white-on-green is forbidden (≈2.1:1). MASTER §6.1 / shared `Button` discrepancy recorded as follow-up, not changed globally."
  - "AcquisitionCta renders only from the `publicSignupEnabled` prop (never reads env/flags); does NOT render 'Entrar' and never links acquisition to /login."
  - "Flag on: GoogleButton variant=\"solid\" (reused, OAuth not reimplemented) + 'Continuar com email' -> /signup secondary."
  - "CampaignImage always owns the `aspect-square` wrapper so swapping placeholder -> approved asset never shifts layout; plain <img> with object-cover/contain (Next Image is not used in src/)."

patterns-established:
  - "Shared primitive first: sections consume AcquisitionCta/CampaignImage instead of being built then replaced"
  - "Client primitive where flag drives interaction; presentational server component otherwise"

requirements-completed: [REQ-51.1-03, REQ-51.1-05, REQ-51.1-07, REQ-51.1-10]

# Metrics
duration: 5 min
completed: 2026-10-09
---

# Phase 51.1 Plan 02: Shared landing primitives (AcquisitionCta + CampaignImage) Summary

**Two shared landing primitives shipped: a flag-aware `AcquisitionCta` with the D-19 dark-on-green primary and a fixed-ratio `CampaignImage` placeholder that swaps without relayout.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-09T00:59:13Z
- **Completed:** 2026-10-09T01:04:14Z
- **Tasks:** 2
- **Files modified:** 2 created (0 modified)

## Accomplishments
- `acquisition-cta.tsx`: single flag branch — off → `Solicitar acesso free` anchor to `#acesso`; on → `GoogleButton variant="solid"` primary + `Continuar com email` → `/signup` secondary. Carries `data-public-signup-enabled`; never reads env/flags; never renders `Entrar`; no OAuth reimplementation.
- D-19 contrast correction applied in one place: green primary uses `text-bg-deep` (`#020617`, ≈8.8:1); zero `text-white` occurrences. MASTER §6.1 / shared `Button` white-on-green discrepancy documented as a follow-up comment only.
- `campaign-image.tsx`: presentational primitive that always wraps content in `aspect-square` + `overflow-hidden` + `rounded-lg` + `bg-bg-surface` + `border-border-light`; skeleton when `src` absent, plain `<img>` (`object-cover`/`object-contain`) when present; `data-campaign-image` marker; documented swap procedure; no Next Image.

## Task Commits

Each task was committed atomically on `escopo/landing`:

1. **Task 1: Create the shared AcquisitionCta primitive** - `d77b79c5` (feat)
2. **Task 2: Create the fixed-ratio CampaignImage primitive** - `3ed6d529` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `src/components/landing/acquisition-cta.tsx` - Shared flag-aware acquisition CTA (hero/offer/final consumer).
- `src/components/landing/campaign-image.tsx` - Fixed 1:1 swappable campaign image/placeholder primitive.

## Decisions Made
- **D-19 (local contrast fix):** dark text on green primary; global design system and shared `Button` left untouched, discrepancy recorded as a comment/follow-up (CONTEXT D-19).
- **Flag contract (D-12/D-13):** `AcquisitionCta` is prop-driven (`publicSignupEnabled: boolean`), never reads env/flags itself; `Entrar` stays a separate header action; no acquisition link to `/login`.
- **Image contract (D-07/D-09):** `CampaignImage` owns the `aspect-square` ratio and uses a plain `<img>` (Next Image is not used anywhere in `src/`), so an asset swap cannot shift layout.

## Deviations from Plan

None - plan executed exactly as written (both tasks `type="auto"`, no checkpoints). The two files match their planned interfaces and acceptance criteria exactly.

## Issues Encountered

### Pre-existing, out-of-scope: `npm run typecheck` cannot exit 0 on this branch base
- `npm run typecheck` reports exactly one error, in an **untouched F56 test file**:
  `src/lib/ai/__tests__/image-generation-operations-repository.integration.test.ts(139,68): error TS2353: ... 'ssl' does not exist in type '{ connectionString?: string | undefined; }'`
- **Cause:** `src/types/external-modules.d.ts` (shared ambient `pg` declaration) lacks `ssl`. The upstream fix is commit `92059829 fix(56.2.1-06)` on `feature/fase-56-1-contrato-produtivo-modelos-e-fallback`, which is **absent from `escopo/landing`** (merge-base `cc70e57c`).
- **Action taken:** *not fixed* — it is pre-existing and outside this plan's authorized scope (`src/components/landing/*` only; F56/shared-contract changes forbidden; installs prohibited). Logged in `.planning/phases/51.1-landing-visual-produto/deferred-items.md`.
- **Proof the plan's own files are clean:** the typecheck output contains **zero** errors attributed to `acquisition-cta.tsx` or `campaign-image.tsx`.
- **Recommended follow-up:** rebase/merge `escopo/landing` onto a base including `92059829`, after which typecheck is expected to pass.

### Environment note
- `escopo/landing` is a git worktree without `node_modules`. Because installs are prohibited, a gitignored directory junction `node_modules` → `C:\Projetos\Vendeo V3\node_modules` was created solely to run the mandated typecheck. It is untracked and does not appear in the diff.

## Verification Evidence

Acceptance-criteria greps (all PASS) on the committed files:

- `rg -c "Solicitar acesso free"` = 1; `rg -c "Continuar com email"` = 1; `rg -c "data-public-signup-enabled"` = 1
- `rg -c "bg-accent-green"` = 1; `rg -c "text-bg-deep"` = 2
- `rg -c "text-white"` = 0 (D-19)
- `rg -c "GoogleButton"` = 2; `rg -c 'variant="solid"'` = 1
- `rg -c "#acesso"` = 1; `rg -c '"/signup"'` = 1
- `rg -c "signInWithOAuth|createBrowserClient"` = 0; `rg -c 'href="/login"'` = 0
- `rg -c "aspect-square"` = 2; `rg -c "object-cover"` = 2; `rg -c "object-contain"` = 2
- `rg -c "next/image"` = 0; `rg -c "data-campaign-image"` = 1
- `npm run typecheck`: single pre-existing out-of-scope error only (see Issues); no errors in this plan's files.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. `CampaignImage` intentionally renders a neutral skeleton when `src` is absent — that is the planned placeholder state (D-07/D-09), to be replaced by human-approved assets in plan 51-1-08, not an unwired stub.

## Next Phase Readiness
- Primitives are ready for plan **51-1-03** (block sections: hero, transformation, variations, identity/control, FAQ/final CTA) and **51-1-04** (independent offer block), which consume `AcquisitionCta`/`CampaignImage` without later replacement.
- Blocker (non-blocking for this plan): the branch-base typecheck failure above needs the `92059829` upstream fix to reach green.

---
*Phase: 51.1-landing-visual-produto*
*Completed: 2026-10-09*

## Self-Check: PASSED

- FOUND: src/components/landing/acquisition-cta.tsx
- FOUND: src/components/landing/campaign-image.tsx
- FOUND: .planning/phases/51.1-landing-visual-produto/51-1-02-SUMMARY.md
- FOUND commit: d77b79c5 (Task 1)
- FOUND commit: 3ed6d529 (Task 2)
- All 18 acceptance-criteria greps PASS (including `variant="solid"` = 1 and `next/image` = 0).
