---
phase: 51.1-landing-visual-produto
plan: "06"
subsystem: ui
tags: [nextjs, react, tailwind, landing, accessibility, aria, focus, touch-targets, preservation]

# Dependency graph
requires:
  - phase: 51-1-02
    provides: shared primitives AcquisitionCta (focus ring + min-h-[44px]) and CampaignImage
  - phase: 51-1-03
    provides: six landing block sections with aria-labelledby headings + scroll-snap strips
  - phase: 51-1-05
    provides: page.tsx landmarks (header/main/footer) and the flag-gated #acesso form section
provides:
  - "src/components/landing/hero-section.tsx now exposes an accessible name (aria-labelledby=hero-heading + id on the single h1)"
  - "Verified accessibility contract on the REAL interactive files: focus rings, >=44px targets, no layout-shifting scale, hero mobile order, keyboard-focusable scroll-snap strips"
  - "Verified legal links, flag-dependent form behavior and Novidades dialog semantics are preserved"
affects: [51-1-07, 51-1-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every landing <section> carries an accessible name: aria-labelledby -> a stable sibling <h2 id> (hero uses the single <h1 id>)"
    - "Accessibility greps target the REAL interactive files (acquisition-cta.tsx, access-request-form.tsx), never the presentational section wrappers (Checker Advisory A)"

key-files:
  created: []
  modified:
    - src/components/landing/hero-section.tsx

key-decisions:
  - "D-16: the only structural gap found was the hero <section> having no accessible name; fixed with aria-labelledby=hero-heading + id=hero-heading on the single h1, preserving exactly one h1 and the existing markup/order."
  - "Tasks 2 and 3 are verification-only: all focus/touch/mobile-order/legal-link/flag/form/Novidades acceptance greps already pass on the existing files, so no code change was required (same pattern as 51-1-05 Task 3)."

patterns-established:
  - "Landing section accessible name: aria-labelledby + stable id on the section heading"
  - "Accessibility audit by file-scoped greps on the interactive primitives, not the presentational wrappers"

requirements-completed: [REQ-51.1-08]

# Metrics
duration: ~2 min
completed: 2026-10-09
---

# Phase 51.1 Plan 06: Accessibility, focus/touch targets, legal links and flag-dependent form preservation Summary

**Audited the renewed landing against the Accessibility Contract; the only structural gap was the hero `<section>` missing an accessible name — fixed with `aria-labelledby="hero-heading"` + `id` on the single `<h1>`; focus rings, ≥44px targets, hero mobile order, keyboard-focusable `scroll-snap` strips, legal links and flag-dependent form/Novidades semantics were verified unchanged on the real interactive files.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-10-09T15:51:43Z
- **Completed:** 2026-10-09T15:53:15Z
- **Tasks:** 3 (1 code task committed; Tasks 2–3 verification-only, no changes required)
- **Files modified:** 1

## Accomplishments
- **Heading hierarchy / landmarks fixed.** The hero `<section>` was the only one of the seven blocks without an accessible name. Added `aria-labelledby="hero-heading"` and `id="hero-heading"` on the hero `<h1>`; the other six blocks already paired `aria-labelledby` with a stable `<h2 id>`. Exactly one `<h1>` remains (grep across `src/components/landing` + `src/app/page.tsx`); `page.tsx` keeps one `<header>`, one `<main>`, one `<footer>`.
- **Focus / touch audit on the REAL interactive files** (`acquisition-cta.tsx`, `access-request-form.tsx`) — all acceptance greps pass: `focus:ring-2` (acquisition-cta ×2, form ×1), `min-h-[44px]`/`minHeight: 44px` (×2 / ×1), `focus:outline-none` (×2 / ×1), `scale-` = **0** in both (no layout-shifting hover scale). Flag-off anchor uses `focus:ring-accent-green`; flag-on "Continuar com email" uses `focus:ring-accent-blue`; both `min-h-[44px]`. The Google CTA (flag on) comes from the shared `GoogleButton` (focus ring + `style minHeight:44px`), untouched.
- **Hero mobile order verified:** `AcquisitionCta` (line 47) renders before `CampaignImage` (line 51) in `hero-section.tsx`, so message + CTA precede the 1:1 image in DOM order.
- **Demonstration strips verified:** `variations-section.tsx` and `approach-section.tsx` each use a native `[scroll-snap-type:x_mandatory]` strip with `tabIndex={0}`, a visible `focus-visible:ring-2 focus-visible:ring-accent-green` and **no auto-advance** (both are server components — no client timers).
- **Legal links + flag behavior preserved:** `/termos`, `/privacidade`, `/uso-aceitavel` and `Contato` (`mailto:SUPPORT_EMAIL`) present in `page.tsx` footer and the FAQ/final block's legal nav; flag off → `#acesso` form section with `role="status"` success and `role="alert"` error intact; flag on → form section returns `null` and the signup paths live in the CTA blocks; `NovidadesLink` keeps `role="dialog"` + `aria-modal="true"` + Esc-close + focus-return.

## Task Commits

Each task was committed atomically on `escopo/landing`:

1. **Task 1: Give the hero section an accessible name via aria-labelledby** - `dd5eeb65` (fix)
2. **Task 2: Focus/touch-target/mobile-order audit on the real interactive files** - verification-only; no code changes, no commit required (all acceptance greps green, `npm run lint` exit 0).
3. **Task 3: Legal links and flag-dependent form behavior preserved** - verification-only; no code changes, no commit required (all acceptance greps green, relevant test green).

**Plan metadata:** see the final docs commit below.

## Files Created/Modified
- `src/components/landing/hero-section.tsx` - Added `aria-labelledby="hero-heading"` to the hero `<section>` and `id="hero-heading"` to the single `<h1>` so the block has an accessible name. No other markup, copy, order or styling changed.

## Decisions Made
- **D-16 (accessibility & preservation):** the hero section accessible name was the single missing piece of the heading/landmark contract; fixed locally inside `src/components/landing/` with no global/shared changes.
- **Verify-only Tasks 2–3:** the focus/touch, hero-order, scroll-snap, legal-link, form-state and Novidades semantics were already implemented by plans 02/03/05; recording them as verified (not re-implemented) avoids unnecessary churn and keeps the plan's "snapshot of the real interactive files" intent.

## Deviations from Plan

None - plan executed exactly as written. The plan's `files_modified` frontmatter lists ten files, but only `hero-section.tsx` required a change; the remaining files were audited and confirmed compliant (Tasks 2–3 verify-only), which matches the plan's audit intent (and the 51-1-05 Task-3 precedent).

## Issues Encountered

### Pre-existing, out-of-scope: `npm run typecheck` cannot exit 0 on this branch base
- `npm run typecheck` (`tsc -p tsconfig.typecheck.json --noEmit`) reports exactly one error, in an **untouched F56 test file**:
  `src/lib/ai/__tests__/image-generation-operations-repository.integration.test.ts(139,68): error TS2353: ... 'ssl' does not exist in type '{ connectionString?: string | undefined; }'.`
- **Cause:** the shared ambient `pg` declaration lacks `ssl`; the upstream fix (`92059829`) is absent from `escopo/landing`. Already logged in `.planning/phases/51.1-landing-visual-produto/deferred-items.md`.
- **Action taken:** *not fixed* (pre-existing, outside this plan's authorized scope; F56/shared-contract changes forbidden; installs prohibited).
- **Proof this plan's file is clean:** the typecheck output contains **zero** errors attributed to `src/components/landing/hero-section.tsx` or any landing file.
- `npm run lint` exits 0.

## Verification Evidence

Acceptance-criteria greps (all PASS) on the committed files, on branch `escopo/landing`.

**Task 1 — heading hierarchy + landmarks**
- `rg -c "<h1" src/components/landing/hero-section.tsx` = 1.
- `rg -c "<h1"` across transformation/variations/approach/identity/offer/faq = 0 matches (exit 1).
- `rg -c "aria-labelledby"` = 1 in each of hero, transformation, variations, approach, identity, offer, faq.
- `rg -c "<main"` = 1, `rg -c "<header"` = 1, `rg -c "<footer"` = 1 in `src/app/page.tsx`.
- `npm run typecheck`: only the pre-existing out-of-scope error above; zero errors in changed files.

**Task 2 — focus / touch / mobile order**
- `rg -c "focus:ring-2"` acquisition-cta = 2, access-request-form = 1.
- `rg -c "min-h-\[44px\]|minHeight..44px"` acquisition-cta = 2, access-request-form = 1.
- `rg -c "focus:outline-none"` acquisition-cta = 2, access-request-form = 1.
- `rg -c "scale-"` acquisition-cta + access-request-form = 0 (no layout-shifting hover scale).
- `rg -n "AcquisitionCta|CampaignImage" hero-section.tsx`: `AcquisitionCta` at line 47 < `CampaignImage` at line 51.
- `rg -c "scroll-snap"` variations = 3, approach = 3; `tabIndex={0}` at variations line 45 and approach line 41; both files are server components (no auto-advance).
- `npm run lint` → exit 0.

**Task 3 — legal links + flag-dependent behavior**
- `rg -c "/termos|/privacidade|/uso-aceitavel"` faq-final-cta-section = 3, `page.tsx` = 3.
- `rg -c "SUPPORT_EMAIL"` `page.tsx` = 1.
- `rg -c "role=\"status\""` access-request-section = 1; `rg -c "AccessRequestForm"` access-request-section = 3.
- `rg -c "aria-modal"` novidades-link = 2.
- `npx vitest run src/components/landing/__tests__/access-request-section.test.tsx` → 3 passed; full folder `npx vitest run src/components/landing` → 2 files / 9 passed.
- `npm run typecheck`: same single pre-existing out-of-scope error; zero errors in changed files.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. This plan changed only the hero section's accessible name; the intentional `CampaignImage` neutral-skeleton placeholder state (plan 51-1-08 pending human-approved assets) is unchanged and already documented in prior summaries.

## Threat Flags
None. The change adds no network endpoint, auth path, file-access pattern or schema change — it adds an ARIA attribute pair (`aria-labelledby` + `id`) inside an existing landing component. Threat register items T-51.1-06-01..04 and T-51.1-06-SC are satisfied: form `role="status"`/`role="alert"` and the anti-enumeration response are untouched (T-01); one `<h1>` + labelled sections + landmarks asserted by the greps (T-02); hero message/CTA before the image and `min-h-[44px]` targets preserved (T-03); focus/touch greps target `acquisition-cta.tsx` and `access-request-form.tsx` (T-04); no dependency added (T-SC).

## Next Phase Readiness
- The landing now satisfies the Accessibility Contract with a single `<h1>`, seven labelled sections, header/main/footer landmarks, visible focus rings and ≥44px targets on the real interactive files, preserved legal links and flag-dependent form/Novidades semantics.
- Plan **51-1-07** (tests & validation: both flag modes, no generation API call) can build on this verified baseline.
- F56 (`Current Position` = F56.2a) and the global state are untouched; only F51.1 lines in `.planning/STATE.md` and `.planning/ROADMAP.md` were updated.
- Non-blocking branch-base blocker unchanged: the pre-existing `pg`/`ssl` typecheck error needs the upstream `92059829` fix for a fully green typecheck.

---

*Phase: 51.1-landing-visual-produto*
*Completed: 2026-10-09*

## Self-Check: PASSED

- FOUND: src/components/landing/hero-section.tsx (modified — aria-labelledby + h1 id)
- FOUND commit: dd5eeb65 (Task 1)
- Task 2: verification-only, no commit (all acceptance greps green; `npm run lint` exit 0)
- Task 3: verification-only, no commit (all acceptance greps green; landing tests 9 passed)
- All Task 1/2/3 acceptance-criteria greps PASS (see Verification Evidence)
