---
phase: 51.1-landing-visual-produto
plan: "03"
subsystem: ui
tags: [nextjs, react, tailwind, landing, conversion, accessibility, scroll-snap, primitive-consumers]

# Dependency graph
requires:
  - phase: 51-1-01
    provides: human-approved visual candidate, copy and image-function map (checkpoint APPROVED)
  - phase: 51-1-02
    provides: shared primitives AcquisitionCta (D-19 dark-on-green) and CampaignImage (fixed 1:1)
provides:
  - "Hero block (approved headline/subheadline, distinction line, beta pill, AcquisitionCta + 1:1 CampaignImage)"
  - "Transformation block (compact text ENTRY + complete 1:1 CampaignImage RESULT; absorbs the process section)"
  - "Presentation block (Estúdio/Ambientado/Fundo original — 3× 1:1 tiles; mobile scroll-snap strip)"
  - "Identity & control block (distinction line + compact 1:1 example)"
  - "Approach block (Oferta/Destaque/Exclusivo — 3× 1:1 tiles; mobile scroll-snap strip)"
  - "FAQ + final CTA block (approved FAQ, shared AcquisitionCta, legal links)"
affects: [51-1-04, 51-1-05, 51-1-06, 51-1-07, 51-1-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server sections consume shared primitives (AcquisitionCta / CampaignImage); no section hand-rolls a green CTA"
    - "Mobile demonstration sets: native overflow-x:auto + [scroll-snap-type:x_mandatory] strip, focusable <ul> with visible focus ring; desktop 3 columns"
    - "Transformation entry is a compact <dl> text summary (no image); result is a single CampaignImage with contain (no crop)"

key-files:
  created:
    - src/components/landing/hero-section.tsx
    - src/components/landing/transformation-section.tsx
    - src/components/landing/variations-section.tsx
    - src/components/landing/approach-section.tsx
    - src/components/landing/identity-control-section.tsx
    - src/components/landing/faq-final-cta-section.tsx
  modified: []

key-decisions:
  - "Optional set-entrance animation was intentionally omitted: the plan marks it optional and the reconciled contract (CONTEXT D-16 / VISUAL-CANDIDATE §10) allows only transform-only 280ms if present. Omitting it keeps the blocks as pure server components with content visible without JS and avoids adding client-side IntersectionObserver code not required by any acceptance criterion."
  - "Identity-control keeps the verbatim distinction sentence as a single-line constant and derives the two halves for rendering, so the exact approved string is present while the green emphasis stays only on 'O Vendeo prepara a campanha.' (UI-SPEC Color item 4)."
  - "Mobile strips use Tailwind arbitrary properties [scroll-snap-type:x_mandatory] / [scroll-snap-align:start] (equivalent to snap-x/snap-start) with overflow-x:auto confined to the <ul>; keyboard-focusable with a visible focus ring; no auto-advance and no vertical-scroll capture."
  - "Transformation RESULT passes contain to CampaignImage to guarantee the campaign is complete at 1:1 with no crop (UI-SPEC Image Contract)."

patterns-established:
  - "Primitive consumers: sections render AcquisitionCta/CampaignImage instead of bespoke CTA/image markup"
  - "Compact mobile: text-summary entry + horizontal scroll-snap set strip; section rhythm py-8 (mobile) → sm:py-12 (desktop)"

requirements-completed: [REQ-51.1-01, REQ-51.1-02, REQ-51.1-03, REQ-51.1-04, REQ-51.1-05]

# Metrics
duration: 122 min
completed: 2026-10-09
---

# Phase 51.1 Plan 03: Landing block sections (primitives consumers) Summary

**Six public landing block components shipped — hero, transformação, apresentação do produto, identidade e controle, abordagens de divulgação and FAQ/CTA final — consuming the shared AcquisitionCta (dark-on-green, D-19) and CampaignImage (fixed 1:1) primitives with the approved copy and only approved capabilities.**

## Performance

- **Duration:** ~122 min
- **Started:** 2026-10-09T13:38:05Z
- **Completed:** 2026-10-09T15:39:44Z
- **Tasks:** 3
- **Files modified:** 6 created (0 modified)

## Accomplishments
- `hero-section.tsx`: single `<h1>` with the approved headline verbatim, approved subheadline, distinction line with the green emphasis only on "O Vendeo prepara a campanha.", the beta pill on flag off (`text-accent-amber`), the shared `AcquisitionCta`, and a 1:1 `CampaignImage` slot. Mobile order is copy → CTA → image; desktop is two columns. Carries `data-public-signup-enabled`.
- `transformation-section.tsx`: 2-panel simplicity proof — a compact text ENTRY (`<dl>` of Produto/Preço/Detalhes; never a square image or `CampaignImage`) and a complete 1:1 RESULT (`<CampaignImage contain>`); compact four-step list; no separate process heading.
- `variations-section.tsx` (block 3): "Escolha como apresentar seu produto." + "Estúdio, ambientado ou mantendo o fundo original." and exactly three 1:1 `CampaignImage` tiles (Estúdio / Ambientado / Fundo original); desktop 3 columns, mobile native `overflow-x:auto` + `scroll-snap` strip.
- `approach-section.tsx` (block 5): "Uma campanha para cada jeito de divulgar." + "Mostre uma oferta, valorize um produto ou apresente algo especial." and exactly three 1:1 tiles (Oferta / Destaque / Exclusivo) with the same responsive strip; lower editorial weight — no extra cards, CTAs or process repetition.
- `identity-control-section.tsx` (block 4): compact brand-coherence/control block preserving the distinction line with a single 1:1 `CampaignImage` example; user reviews and decides what to publish; no fabricated proofs.
- `faq-final-cta-section.tsx` (block 7): approved FAQ items (`<h3>` questions), the shared `AcquisitionCta` for the final CTA, and the legal links `/termos`, `/privacidade`, `/uso-aceitavel` reusing the current copy.

## Task Commits

Each task was committed atomically on `escopo/landing`:

1. **Task 1: Create hero and transformation sections consuming the primitives** - `96de0f29` (feat)
2. **Task 2: Create the presentation, approach and identity-control sections** - `340f1396` (feat)
3. **Task 3: Create the FAQ + final CTA section consuming AcquisitionCta** - `0179dec6` (feat)

**Plan metadata:** (see final docs commit below)

## Files Created/Modified
- `src/components/landing/hero-section.tsx` - Hero block consuming `AcquisitionCta` + `CampaignImage`.
- `src/components/landing/transformation-section.tsx` - Simplicity proof (text entry + 1:1 result); absorbs the process section.
- `src/components/landing/variations-section.tsx` - Product-presentation proof (3× 1:1 tiles, mobile scroll-snap strip).
- `src/components/landing/approach-section.tsx` - Communication-approach proof (3× 1:1 tiles, mobile scroll-snap strip).
- `src/components/landing/identity-control-section.tsx` - Brand coherence + user control, compact 1:1 example.
- `src/components/landing/faq-final-cta-section.tsx` - FAQ + final `AcquisitionCta` + legal links.

## Decisions Made
- **Optional animation omitted (deliberate):** the Task 2 action text mentions an optional set-entrance animation ("opacity + translateY(8px), ~200ms"), but the reconciled contract in CONTEXT D-16 / VISUAL-CANDIDATE §10 / the phase hard constraints permits only `transform: translateY(16px) → translateY(0)`, 280 ms ease-out, no opacity, only if present. Since it is explicitly optional and no acceptance criterion requires it, it was omitted to keep the blocks as pure server components with content visible without JS.
- **Verbatim acceptance strings as constants:** the approved headline/subheadline and the distinction sentence are single-line constants so the exact verbatim copy is unambiguously present; identity-control splits the distinction sentence for rendering so the green emphasis is only on "O Vendeo prepara a campanha.".
- **Native scroll-snap strip:** arbitrary Tailwind properties emit the real CSS (`scroll-snap-type: x mandatory`), keeping the strip library-free, focusable and confined to the `<ul>`.
- **`contain` on transformation result:** guarantees the 1:1 campaign is complete with no crop.

## Deviations from Plan

None - plan executed exactly as written. (The optional animation is marked "optionally add" in the plan; its omission is a within-contract choice, not a deviation, and is recorded under Decisions Made.)

## Issues Encountered

### Pre-existing, out-of-scope: `npm run typecheck` cannot exit 0 on this branch base
- `npm run typecheck` reports exactly one error, in an **untouched F56 test file**:
  `src/lib/ai/__tests__/image-generation-operations-repository.integration.test.ts(139,68): error TS2353: ... 'ssl' does not exist in type '{ connectionString?: string | undefined; }'`.
- **Cause:** `src/types/external-modules.d.ts` (shared ambient `pg` declaration) lacks `ssl`; the upstream fix (`92059829`) is absent from `escopo/landing`.
- **Action taken:** *not fixed* (pre-existing, outside this plan's authorized scope; F56/shared-contract changes forbidden; installs prohibited). Already logged in `.planning/phases/51.1-landing-visual-produto/deferred-items.md`.
- **Proof the plan's own files are clean:** the typecheck output contains **zero** errors attributed to any of the six new section files.
- `npm run lint` exits 0 (no output).

### Worktree context
- `escopo/landing` is a dedicated linked worktree (`git rev-parse --git-dir` → `.../.git/worktrees/Vendeo-V3-Landing`). Per the phase objective, work was done on the current working tree and committed directly on `escopo/landing` (a feature branch, not a protected ref).

## Verification Evidence

Acceptance-criteria greps (all PASS) on the committed files:

**Task 1 — hero + transformation**
- `rg -c "O que seu negócio quer divulgar vira uma campanha pronta para publicar\."` hero = 1
- `rg -c "Você informa o básico\. O Vendeo prepara a campanha completa"` hero = 1
- `rg -c "data-public-signup-enabled"` hero = 1
- `rg -c "AcquisitionCta"` hero = 3; `rg -c "CampaignImage"` hero = 2
- `rg -c "text-white"` hero = 0 (D-19)
- `rg -c "CampaignImage"` transformation = 3
- `rg -c "Como funciona"` transformation = 0
- `rg -n "emoji|😀|🚀"` hero + transformation = no matches

**Task 2 — presentation, approach, identity**
- `rg -c "Escolha como apresentar seu produto\."` variations = 1; `rg -c "Estúdio, ambientado ou mantendo o fundo original\."` variations = 1
- `rg -c "Uma campanha para cada jeito de divulgar\."` approach = 1; `rg -c "Mostre uma oferta, valorize um produto ou apresente algo especial\."` approach = 1
- `rg -c "CampaignImage"` variations = 2, approach = 2, identity = 2 (all ≥ 1)
- `rg -c "scroll-snap"` variations = 3, approach = 3 (native mobile strip)
- `rg -c "oferta"` / `"destaque"` / `"exclusivo"` approach = 3 / 2 / 2 (all ≥ 1)
- `rg -c "Você define como quer apresentar\. O Vendeo prepara a campanha\."` identity = 1
- `rg -c "em breve|ilimitado"` variations = 0, identity = 0
- `rg -n "briefing|intenção|F56"` variations + identity = no matches

**Task 3 — FAQ + final CTA**
- `rg -c "AcquisitionCta"` faq-final-cta = 3
- `rg -c "/termos"` = 1; `rg -c "/privacidade"` = 1; `rg -c "/uso-aceitavel"` = 1
- `rg -c "text-white"` faq-final-cta = 0 (D-19)
- `rg -c "aria-labelledby"` faq-final-cta = 1
- `rg -n "briefing|intenção|F56"` faq-final-cta = no matches

**Gates**
- `npm run typecheck`: single pre-existing out-of-scope error only (see Issues); **zero** errors in the six new files.
- `npm run lint`: exit 0.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. Every `CampaignImage` intentionally renders the neutral skeleton until the human-approved assets are attached in plan 51-1-08 (planned placeholder state per D-07/D-09, not an unwired stub). No section is wired to a data source that could be empty.

## Threat Flags
None. The file set introduces only public static copy and reuses existing primitives; no new network endpoint, auth path, file-access pattern or schema change is added. Threat register items T-51.1-03-01..05 are satisfied by the acceptance greps above.

## Next Phase Readiness
- The six block components are ready for plan **51-1-04** (independent offer component) and **51-1-05** (rewire `src/app/page.tsx` to render the blocks in the fixed order and remove the absorbed sections).
- REQUIREMENTS.md F51.1 coverage narrative was left unchanged: the parallel-front rules still mark REQ-51.1-* as "em planejamento", and full coverage closes with the later plans (07/08). The summary frontmatter records the plan-declared IDs.
- Non-blocking branch-base blocker unchanged: the pre-existing `pg`/`ssl` typecheck error needs the upstream `92059829` fix to reach a fully green typecheck.

---
*Phase: 51.1-landing-visual-produto*
*Completed: 2026-10-09*

## Self-Check: PASSED

- FOUND: src/components/landing/hero-section.tsx
- FOUND: src/components/landing/transformation-section.tsx
- FOUND: src/components/landing/variations-section.tsx
- FOUND: src/components/landing/approach-section.tsx
- FOUND: src/components/landing/identity-control-section.tsx
- FOUND: src/components/landing/faq-final-cta-section.tsx
- FOUND commit: 96de0f29 (Task 1)
- FOUND commit: 340f1396 (Task 2)
- FOUND commit: 0179dec6 (Task 3)
- All Task 1/2/3 acceptance-criteria greps PASS (see Verification Evidence).
