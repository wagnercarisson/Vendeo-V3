---
phase: 51.1-landing-visual-produto
plan: "05"
subsystem: ui
tags: [nextjs, react, tailwind, landing, page-rewire, flag-aware, contrast, cleanup]

# Dependency graph
requires:
  - phase: 51-1-02
    provides: shared primitives AcquisitionCta (D-19 dark-on-green) and CampaignImage (fixed 1:1)
  - phase: 51-1-03
    provides: six landing block sections (hero, transformação, apresentação, identidade, abordagens, FAQ/CTA final)
  - phase: 51-1-04
    provides: independent OfferSection forwarding publicSignupEnabled to AcquisitionCta
provides:
  - "src/app/page.tsx rebuilt with header/main/footer landmarks and the fixed 7-block order inside <main>"
  - "Single server publicSignupEnabled forwarded to HeroSection, OfferSection, FaqFinalCtaSection and the reduced AccessRequestSection"
  - "AccessRequestSection reduced to the flag-gated #acesso form section (entries prop removed); flag on returns null"
  - "D-19 local dark-text override (!text-bg-deep) on the form primary submit; shared Button untouched"
  - "Absorbed sections how-it-works-section.tsx and what-vendeo-creates-section.tsx deleted"
affects: [51-1-06, 51-1-07, 51-1-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server page owns the single flag read; every acquisition block consumes it as a prop and never reads env/flags"
    - "Flag-gated #acesso form section returns null on flag on so the signup paths live only in the CTA blocks"
    - "D-19 contrast override stays LOCAL on the form submit (!text-bg-deep); shared Button/MASTER keep the documented white-on-green guidance as a follow-up"

key-files:
  created: []
  modified:
    - src/app/page.tsx
    - src/components/landing/access-request-section.tsx
    - src/components/landing/access-request-form.tsx
    - src/components/landing/__tests__/access-request-section.test.tsx
  deleted:
    - src/components/landing/how-it-works-section.tsx
    - src/components/landing/what-vendeo-creates-section.tsx

key-decisions:
  - "page.tsx renders the EXACT approved order inside <main>: HeroSection → TransformationSection → VariationsSection → IdentityControlSection → ApproachSection → OfferSection → FaqFinalCtaSection, then the flag-gated AccessRequestSection; <header> and <footer> landmarks preserved."
  - "AccessRequestSection signature reduced to { publicSignupEnabled?: boolean } with the entries prop removed entirely; Novidades ownership moved to the footer (NovidadesLink variant=\"footer\") and the section returns null on flag on."
  - "D-19 contrast correction applied as a LOCAL override: the form submit passes className=\"w-full !text-bg-deep\"; src/components/ui/button.tsx and openspec MASTER §6.1 are not modified (recorded follow-up)."

patterns-established:
  - "Landmark layout: header + <main> (7 blocks + gated form) + footer"
  - "Reduced, presentation-only flag-gated form section (no changelog data, no hero)"

requirements-completed: [REQ-51.1-01, REQ-51.1-07, REQ-51.1-10]

# Metrics
duration: 3 min
completed: 2026-10-09
---

# Phase 51.1 Plan 05: Landing page rewire and cleanup Summary

**Rebuilt `src/app/page.tsx` with header/main/footer landmarks and the fixed 7-block order (hero → transformação → apresentação → identidade → abordagens → oferta → FAQ/CTA final) inside `<main>`, reduced `AccessRequestSection` to the flag-gated `#acesso` form (entries prop removed), applied the D-19 local dark-text submit override, and deleted the two absorbed section files.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-10-09T12:46:27Z
- **Completed:** 2026-10-09T12:49:04Z
- **Tasks:** 3 (2 code tasks committed; Task 3 verification-only, no changes required)
- **Files modified:** 4 modified, 2 deleted

## Accomplishments
- `src/app/page.tsx` rebuilt: keeps `getAllEntries()` (slice 0..5) and `getLaunchConfig()`; `<header>` (brand + secondary "Entrar" → `/login`), `<main>` with the seven blocks in the fixed order, then the flag-gated `AccessRequestSection`; `<footer>` with `/termos`, `/privacidade`, `/uso-aceitavel`, `<NovidadesLink variant="footer" entries={recentEntries} />`, Contato (`mailto:${process.env.SUPPORT_EMAIL ?? "suporte@vendeo.tech"}`) and Entrar. The single `publicSignupEnabled` flows to `HeroSection`, `OfferSection`, `FaqFinalCtaSection` and `AccessRequestSection`.
- `access-request-section.tsx` reduced to ONLY the `#acesso` form card: flag off → `AccessRequestForm` with the preserved `submitted` success state ("Solicitação enviada") and heading "Solicite seu acesso free"; flag on → `null`. Signature is now `{ publicSignupEnabled?: boolean }` (no `entries`, no `NovidadesLink`, no hero). `POST /api/access-requests` behavior untouched.
- D-19 local contrast override added on the primary submit (`className="w-full !text-bg-deep"`); the shared `src/components/ui/button.tsx` and MASTER §6.1 untouched; documented as a follow-up.
- `how-it-works-section.tsx` and `what-vendeo-creates-section.tsx` deleted along with their imports/usages.
- `access-request-section.test.tsx` updated to the reduced component/new signature (no `entries`; asserts the flag-off form + `#acesso`, no acquisition CTA, and no form on flag on).

## Task Commits

Each task was committed atomically on `escopo/landing`:

1. **Task 1: Rebuild page.tsx with the fixed order and delete the absorbed sections** - `a11e0560` (feat)
2. **Task 2: Reduce access-request-section, remove the entries prop, apply the form-submit contrast override** - `859d346f` (feat)
3. **Task 3: Verify no shared-contract drift and the single-flag wiring** - verification-only; no code changes, no commit required (all acceptance greps green).

**Plan metadata:** see the final docs commit below.

## Files Created/Modified
- `src/app/page.tsx` - Rebuilt with landmarks, fixed 7-block order inside `<main>`, flag-gated form section, footer Novidades.
- `src/components/landing/access-request-section.tsx` - Reduced to the flag-gated `#acesso` form card; `entries` prop removed; returns `null` on flag on.
- `src/components/landing/access-request-form.tsx` - Primary submit carries the local `!text-bg-deep` override (D-19); behavior/contract unchanged.
- `src/components/landing/__tests__/access-request-section.test.tsx` - Tests the reduced component and new signature.
- `src/components/landing/how-it-works-section.tsx` - DELETED (absorbed).
- `src/components/landing/what-vendeo-creates-section.tsx` - DELETED (absorbed).

## Decisions Made
- **Fixed block order (D-04):** the seven blocks render in the exact approved order inside `<main>`; no separate "Como funciona" block exists.
- **Single flag (D-12):** `getLaunchConfig().publicSignupEnabled` is read once in `page.tsx` and forwarded as a prop to every acquisition block + the form section; no section reads the flag/env itself.
- **Reduced form section (D-15):** `entries` removed; the flag-gated `#acesso` form is the only content and returns `null` on flag on; the `POST /api/access-requests` contract is unchanged.
- **Local contrast override (D-19):** dark text on the green submit via a local class only; shared `Button` and MASTER §6.1 keep the white-on-green guidance as a recorded follow-up.

## Deviations from Plan

None - plan executed exactly as written.

Minor note (not a deviation): Tasks 1 and 2 are signature-coupled — the reduced `AccessRequestSection` signature (Task 2) is what makes `page.tsx` (Task 1) typecheck. At the intermediate Task 1 commit the old `entries`-requiring component is still present, so a per-commit typecheck is only green after Task 2. The final tree is green (see Verification Evidence). This is inherent to the plan's own task ordering, not a change to the plan's intent.

## Issues Encountered

### Pre-existing, out-of-scope: `npm run typecheck` cannot exit 0 on this branch base
- `npm run typecheck` reports exactly one error, in an **untouched F56 test file**:
  `src/lib/ai/__tests__/image-generation-operations-repository.integration.test.ts(139,68): error TS2353: ... 'ssl' does not exist in type '{ connectionString?: string | undefined; }'`.
- **Cause:** the shared ambient `pg` declaration lacks `ssl`; the upstream fix (`92059829`) is absent from `escopo/landing`.
- **Action taken:** *not fixed* (pre-existing, outside this plan's authorized scope; F56/shared-contract changes forbidden; installs prohibited). Already logged in `.planning/phases/51.1-landing-visual-produto/deferred-items.md`.
- **Proof this plan's files are clean:** the typecheck output contains **zero** errors attributed to `src/app/page.tsx` or any `src/components/landing/*` file changed here.
- `npm run lint` exits 0.

## Verification Evidence

Acceptance-criteria greps (all PASS) on the committed files:

**Task 1 — page rewire + deletions**
- `WhatVendeoCreatesSection|HowItWorksSection` in `page.tsx` = 0; both absorbed files do not exist (`Test-Path` → False).
- `<main` = 1, `<header` = 1, `<footer` = 1 in `page.tsx`.
- Block order in `page.tsx` (JSX lines 44–50, exact): `HeroSection, TransformationSection, VariationsSection, IdentityControlSection, ApproachSection, OfferSection, FaqFinalCtaSection`.
- `OfferSection publicSignupEnabled` ≥ 1; `variant="footer"` ≥ 1.
- `AccessRequestSection` element receives only `publicSignupEnabled` (no `entries` attribute).

**Task 2 — reduced section + override + test**
- `entries` in `access-request-section.tsx` = 0; `NovidadesLink` = 0; `AccessRequestForm` = 3; `id="acesso"` = 1.
- `!text-bg-deep` in `access-request-form.tsx` = 2 (comment + the `className="w-full !text-bg-deep"` on the `<Button variant="primary">` submit at line 134); `text-white` = 0.
- `git diff --stat` on `src/components/ui/button.tsx` = empty (shared Button untouched).
- `entries=` in `access-request-section.test.tsx` = 0.
- `npx vitest run src/components/landing __tests__/access-request-section.test.tsx`: **3 passed** (folder run: 2 files / 9 passed).

**Task 3 — no shared-contract drift / single-flag wiring**
- `git diff --stat HEAD~2 -- src/app/api/access-requests src/lib/launch-config src/components/auth src/components/ui/button.tsx` = empty.
- `publicSignupEnabled` in `page.tsx` flows to `HeroSection`, `OfferSection`, `FaqFinalCtaSection`, `AccessRequestSection`.
- `getLaunchConfig` in `hero-section.tsx`, `offer-section.tsx`, `faq-final-cta-section.tsx`, `access-request-section.tsx` = 0.
- `npm run lint` exit 0; `npm run typecheck` shows only the pre-existing out-of-scope error above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. Every `CampaignImage` intentionally renders the neutral skeleton until the human-approved assets are attached in plan 51-1-08 (planned placeholder state per D-07/D-09). No block is wired to a data source that could be empty; `getAllEntries()` remains wired to the footer `NovidadesLink`.

## Threat Flags
None. The rewire adds no network endpoint, auth path, file-access pattern or schema change; it renders static approved copy plus the existing form and moved Novidades to the footer. Threat register items T-51.1-05-01..05 / T-51.1-05-SC are satisfied by the acceptance greps above (API/launch-config/auth/Button unchanged; no `getLaunchConfig` inside sections; no generation import/fetch; no dependency change).

## Next Phase Readiness
- The landing page now renders the approved 7-block composition with landmarks; plan **51-1-06** (accessibility greps on the real interactive files) and **51-1-07** (offer tests in both flag modes) can target the rewired page.
- `POST /api/access-requests`, `src/lib/launch-config/**`, auth and `src/components/ui/button.tsx` are unchanged.
- Non-blocking branch-base blocker unchanged: the pre-existing `pg`/`ssl` typecheck error needs the upstream `92059829` fix to reach a fully green typecheck.

---

*Phase: 51.1-landing-visual-produto*
*Completed: 2026-10-09*

## Self-Check: PASSED

- FOUND: src/app/page.tsx (rewired)
- FOUND: src/components/landing/access-request-section.tsx (reduced)
- FOUND: src/components/landing/access-request-form.tsx (override)
- FOUND: src/components/landing/__tests__/access-request-section.test.tsx (updated)
- DELETED: src/components/landing/how-it-works-section.tsx
- DELETED: src/components/landing/what-vendeo-creates-section.tsx
- FOUND commit: a11e0560 (Task 1)
- FOUND commit: 859d346f (Task 2)
- Task 3: verification-only, no commit (all acceptance greps green)
- All Task 1/2/3 acceptance-criteria greps PASS (see Verification Evidence)
