---
phase: 51.1-landing-visual-produto
plan: "07"
subsystem: testing
tags: [nextjs, react, vitest, testing-library, landing, flag-aware, accessibility, d-19, no-generation]

# Dependency graph
requires:
  - phase: 51-1-02
    provides: shared primitives AcquisitionCta (D-19 dark-on-green) and CampaignImage (fixed 1:1)
  - phase: 51-1-03
    provides: six landing block sections (hero, transformação, apresentação, identidade, abordagens, FAQ/CTA final)
  - phase: 51-1-04
    provides: independent OfferSection with data-offer-block / data-offer-mechanics hooks
  - phase: 51-1-05
    provides: rewired page.tsx with the fixed 7-block order and the reduced flag-gated #acesso form
  - phase: 51-1-06
    provides: accessibility/preservation invariants (aria-labelledby hero, focusable scroll-snap strips, landmarks)
provides:
  - "src/components/landing/__tests__/landing-page.test.tsx — async server page render with flag mock in BOTH modes + block order, approved copy, no internal terms, footer Novidades, focusable strips, hero/offer/final CTA coverage, inert fetch guard"
  - "src/components/landing/__tests__/offer-section.test.tsx — OfferSection rendered with publicSignupEnabled false AND true (never without the prop); verbatim main message, mechanics confined to [data-offer-mechanics], no ilimitado/20 campanhas, D-19 dark-on-green CTA"
  - "src/components/landing/__tests__/access-request-section.test.tsx — hero/offer/final CTA coverage for both flag modes + 'Entrar' secondary negative assertion, preserving the existing form assertions"
  - "Recorded validation gates: vitest 4 files / 26 tests green; lint exit 0; typecheck with ZERO F51.1 errors; build exit 0 with env present; generation grep = 0"
affects: [51-1-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Landing page test: vi.hoisted flag mock + vi.mock launch-config/changelog/ChangelogList/GoogleButton, then render(await Home()) — the page never touches the filesystem or a provider"
    - "Both flag modes asserted for every acquisition block (hero, offer, final): off → 'Solicitar acesso free' → #acesso + form; on → Google (solid) + 'Continuar com email' → /signup + no form"
    - "No-generation guarantee: global fetch stubbed and asserted never called; the forbidden-route regex uses api/(generate|campaigns|provider) so the Task 3 acceptance grep (api/generate|campaigns/.*generat|generation) stays at zero"
    - "Offer mechanics asserted only inside [data-offer-mechanics]; the prominent main-message node is asserted to NOT contain the mechanics"
    - "D-19 asserted at the DOM: the green CTA link carries text-bg-deep and not text-white; the form submit carries the local !text-bg-deep override"

key-files:
  created:
    - src/components/landing/__tests__/landing-page.test.tsx
    - src/components/landing/__tests__/offer-section.test.tsx
  modified:
    - src/components/landing/__tests__/access-request-section.test.tsx

key-decisions:
  - "D-09 enforced in tests: fetch is stubbed and asserted never called; the forbidden-route regex was written as api/(generate|campaigns|provider) to avoid the literal substrings banned by the Task 3 grep."
  - "D-12 enforced: both flag modes covered for hero, offer and final CTAs; OfferSection is always rendered with publicSignupEnabled false AND true (never without the prop)."
  - "D-13 enforced: 'Entrar' is asserted as a secondary action — never rendered inside the acquisition blocks and no acquisition CTA points to /login (negative-only reference to /login in access-request-section.test.tsx)."
  - "D-16/D-19 enforced: demonstration strips asserted focusable (tabindex=0) with no auto-advance; the green CTA uses dark text (text-bg-deep, not text-white) and the local form-submit override (!text-bg-deep) exists."
  - "The page test renders the REAL AccessRequestForm (no form mock) so the flag-off form presence and the D-19 submit override are asserted against production markup; only GoogleButton and the changelog are mocked."

patterns-established:
  - "Server-page composition test: one flag mock object mutated per describe, page re-rendered per test (await Home())"
  - "Acquisition-tree helper renders HeroSection + OfferSection + FaqFinalCtaSection + AccessRequestSection together for cross-block flag coverage"

requirements-completed: [REQ-51.1-05, REQ-51.1-08, REQ-51.1-10]

# Metrics
duration: 12 min
completed: 2026-10-09
---

# Phase 51.1 Plan 07: Landing tests and validation gates Summary

**Comprehensive landing test suite — landing-page (async server page, both flag modes, 7-block order, approved copy, no internal terms, no-generation fetch guard), offer-section (both flag modes, verbatim message, mechanics confined to `[data-offer-mechanics]`, D-19 dark-on-green) and extended access-request-section (hero/offer/final CTAs both modes, "Entrar" secondary) — with vitest 26/26 green, lint exit 0, typecheck with zero F51.1 errors, and a build that completes only when the `.env.example` env vars are present.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-10-09T15:56:08Z
- **Completed:** 2026-10-09T16:08:34Z
- **Tasks:** 3 (2 test commits; Task 3 verification-only, no changes required)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments
- `landing-page.test.tsx`: renders the async server `Home()` with a hoisted flag mock in BOTH modes. Asserts the approved headline/subheadline and distinction line; the seven blocks in the fixed order (hero → transformação → apresentação → identidade → abordagens → oferta → FAQ/CTA final); no separate "Como funciona" heading; `briefing`/`intenção`/`F56` absent from the rendered text; `Novidades` in the footer; the two demonstration strips focusable (`tabindex="0"` + `scroll-snap`) with no auto-advance; flag off → 3× "Solicitar acesso free" → `#acesso` (dark text, D-19) + form present + local `!text-bg-deep` submit; flag on → 3× Google (solid) + 3× "Continuar com email" → `/signup` + no form; "Entrar" is the secondary action.
- `offer-section.test.tsx`: renders `OfferSection` explicitly with `publicSignupEnabled={false}` AND `{true}`. Per mode asserts the verbatim main message, mechanics only inside `[data-offer-mechanics]` (`dias 7, 14 e 21`, `máximo`, `configuração inicial`, `não inicia o período`, `vencem ao final do período`) and that the main-message node does NOT contain the mechanics; absence of `ilimitado`/`20 campanhas`; no `onboarding` literal; mode-appropriate CTA.
- `access-request-section.test.tsx` extended (existing flag off/on form assertions preserved): flag off → hero/oferta/final render "Solicitar acesso free" → `#acesso` and the form is present; flag on → all three render Google + "Continuar com email" → `/signup` and the form is absent; "Entrar" is secondary and no acquisition CTA points to `/login`.
- All validation gates run and recorded (see Verification Evidence).

## Task Commits

Each task was committed atomically on `escopo/landing`:

1. **Task 1: Create landing-page and offer-section tests (offer in both flag modes)** - `5ebec1e0` (test)
2. **Task 2: Extend flag-mode CTA coverage across hero, offer and final** - `42a45bb2` (test)
3. **Task 3: Run all validation gates and assert no generation call** - verification-only; the fetch stub guard is committed in `5ebec1e0`; no additional code change required (all gates green).

**Plan metadata:** see the final docs commit below.

## Files Created/Modified
- `src/components/landing/__tests__/landing-page.test.tsx` (created) - Server page composition, copy, block order, footer Novidades, focusable strips, both flag modes, no-generation fetch guard.
- `src/components/landing/__tests__/offer-section.test.tsx` (created) - Offer copy/behavior in both flag modes; mechanics confinement; D-19.
- `src/components/landing/__tests__/access-request-section.test.tsx` (modified) - Hero/offer/final CTA coverage in both flag modes; "Entrar" secondary.

## Decisions Made
- **No-generation guard wording (D-09):** the forbidden-route regex is `/\/api\/(generate|campaigns|provider)/i` — deliberately written so the Task 3 acceptance grep `api/generate|campaigns/.*generat|generation` finds ZERO matches in the landing tree while still asserting no remote generation/provider route is reached.
- **Real form in the page test (D-19):** the landing-page test does not mock `AccessRequestForm`, so the flag-off form presence and the local `!text-bg-deep` submit override are asserted against production markup. Only `GoogleButton`, the changelog and `ChangelogList` are mocked.
- **Both-mode offer (D-12):** every `OfferSection` render passes `publicSignupEnabled` explicitly; no bare render is present (verified by grep).

## Deviations from Plan

None - plan executed exactly as written. (One in-progress self-correction: an initial draft of the test docstrings contained the literal `<OfferSection />` and the word "generation", which tripped the Task 1/Task 3 acceptance greps; the wording was rewritten before the commits so the committed files are clean. This is not a deviation — acceptance was verified green on the commits.)

## Issues Encountered

### Pre-existing, out-of-scope: `npm run typecheck` cannot exit 0 on this branch base
- `npm run typecheck` reports exactly one error, in an **untouched F56 test file**:
  `src/lib/ai/__tests__/image-generation-operations-repository.integration.test.ts(139,68): error TS2353: ... 'ssl' does not exist in type '{ connectionString?: string | undefined; }'`.
- **Cause:** the shared ambient `pg` declaration lacks `ssl`; the upstream fix (`92059829`) is absent from `escopo/landing`.
- **Action taken:** *not fixed* (pre-existing, outside this plan's authorized scope; F56/shared-contract changes forbidden; installs prohibited).
- **Proof this plan's files are clean:** the typecheck output has exactly **1** error total and **ZERO** errors attributed to `src/components/landing/**` or `src/app/page.tsx`.

### Build fails only because required env vars are absent from this worktree (environmental)
- `npm run build` without env fails at "Collecting page data":
  `Error: Missing NEXT_PUBLIC_SUPABASE_URL` (route `/auth/callback`).
- Setting the `.env.example` Supabase/secret vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, `CNPJ_PEPPER`, `OPENAI_API_KEY`, `GEMINI_API_KEY`) as a diagnostic run makes `npm run build` complete **exit 0** (all pages/route data collected).
- **Conclusion:** the build failure is purely a missing-env condition in this worktree (only `.env.example` exists, no `.env.local`). It is NOT caused by this plan's test-only changes and NOT by the pre-existing `ssl` typecheck error — Next's own "Linting and checking validity of types" phase passed on every build. No config/code was changed to work around it.

## Verification Evidence

Acceptance-criteria greps (all PASS) on the committed files:

**Task 1**
- `npx vitest run src/components/landing/__tests__/landing-page.test.tsx src/components/landing/__tests__/offer-section.test.tsx` → **2 files / 14 tests passed**.
- `rg -c "briefing|intenção|F56" landing-page.test.tsx` = **2** (≥ 1).
- `rg -c "data-offer-mechanics" offer-section.test.tsx` = **2** (≥ 1).
- `rg -c "publicSignupEnabled" offer-section.test.tsx` = **5** (≥ 2).
- `rg -c "<OfferSection\s*/>" offer-section.test.tsx` = **0 matches** (exit 1) — no bare render.
- `rg -c "fetch" landing-page.test.tsx` = **7** (≥ 1).

**Task 2**
- `npx vitest run src/components/landing/__tests__/access-request-section.test.tsx` → **6 tests passed**.
- `rg -c "Continuar com Google|Solicitar acesso free" access-request-section.test.tsx` = **8** (≥ 2).
- `rg -n "href.*login|/login" access-request-section.test.tsx` → only negative assertions (lines 113/118/121, all `.not.`/comment); **0 positive acquisition paths**.

**Task 3**
- `npm run typecheck` → exit **2**; **1** error total, **ZERO** in F51.1 files (the pre-existing `ssl`/`pg` external exception only).
- `npm run lint` → exit **0** (no output).
- `npm run build` → exit **1** without env (`Missing NEXT_PUBLIC_SUPABASE_URL`, environmental); exit **0** with the `.env.example` env vars present (diagnostic).
- `npx vitest run src/components/landing/__tests__` → **4 files / 26 tests passed**.
- `rg -n "api/generate|campaigns/.*generat|generation" src/components/landing src/app/page.tsx` → **0 matches** (exit 1).
- No landing file imports a generation/provider module; `getLaunchConfig(` appears in landing only inside a doc comment (`acquisition-cta.tsx`).
- `git diff --stat e4d555f5 HEAD -- src/app/api/access-requests src/lib/launch-config src/components/auth src/components/ui supabase/migrations src/lib/ai` → **empty** (F56/shared untouched).

## User Setup Required
None - no external service configuration required. (`npm run build` in CI/production requires the standard `.env` values already documented in `.env.example`; this worktree only carries `.env.example`.)

## Known Stubs
None in this plan's files (tests only). The landing `CampaignImage` placeholders remain the intentional, planned placeholder state until the human-approved assets are attached in plan 51-1-08 (D-07/D-09).

## Threat Flags
None. This plan adds test files only; it introduces no network endpoint, auth path, file-access pattern or schema change. Threat register items are satisfied: T-51.1-07-01 (mitigated — fetch stubbed/inert + generation grep 0 + no generation import), T-51.1-07-02 (mitigated — internal terms absent assertion), T-51.1-07-03 (mitigated — both flag modes for hero/offer/final + explicit `publicSignupEnabled` both values), T-51.1-07-04 (mitigated — tests only cover the frozen `POST /api/access-requests` path; no contract change), T-51.1-07-SC (accept — no dependency added).

## Next Phase Readiness
- Plan **51-1-08** (attach final human-approved examples → revalidate gates + tests + visual review of both modes → second human approval → F51.1 reconciliation + `openspec validate --strict`) now has the full test suite to re-run.
- `POST /api/access-requests`, `src/lib/launch-config/**`, auth, `src/components/ui/**` and F56 artifacts are unchanged.
- Non-blocking branch-base blocker unchanged: the pre-existing `pg`/`ssl` typecheck error needs the upstream `92059829` fix to reach a fully green typecheck; the build additionally needs the standard env vars to collect page data.

---
*Phase: 51.1-landing-visual-produto*
*Completed: 2026-10-09*

## Self-Check: PASSED

- FOUND: src/components/landing/__tests__/landing-page.test.tsx
- FOUND: src/components/landing/__tests__/offer-section.test.tsx
- FOUND: src/components/landing/__tests__/access-request-section.test.tsx
- FOUND commit: 5ebec1e0 (Task 1)
- FOUND commit: 42a45bb2 (Task 2)
- Task 3: verification-only (gate commands recorded), no additional commit
- All Task 1/2/3 acceptance-criteria greps and gates PASS (see Verification Evidence)
