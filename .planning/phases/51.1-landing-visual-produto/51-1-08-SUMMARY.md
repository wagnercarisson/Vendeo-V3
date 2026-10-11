---
phase: 51.1-landing-visual-produto
plan: 08
subsystem: ui
tags: [landing, assets, uat, approval, partial]
status: complete

# Dependency graph
requires:
  - phase: 51.1-landing-visual-produto
    provides: [hero, apresentação, abordagens, identidade, transformação arts; copy; CTAs; logo]
provides:
  - "Approved landing assets attached (hero, apresentação, abordagens, identidade, transformação)"
  - "Human approval of the LOCAL landing registered (visual)"
  - "Asset-license declaration by the responsible (internal, not public)"
affects: ["F51.1 closing", "F51.2 (SEO, out of scope)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Landing-owned assets under public/landing (webp, full 1:1, object-contain)"

key-files:
  created:
    - public/landing/hero-oferta-cafe.webp
    - public/landing/apresentacao-estudio.webp
    - public/landing/apresentacao-ambientado.webp
    - public/landing/apresentacao-fundo-original.webp
    - public/landing/abordagens-oferta.webp
    - public/landing/abordagens-destaque.webp
    - public/landing/abordagens-exclusivo.webp
    - public/landing/identidade-floricultura.webp
    - public/landing/transformacao-petshop.webp
    - public/landing/transformacao-produto-racao.webp
    - .planning/phases/51.1-landing-visual-produto/51.1-UAT.md
  modified:
    - src/app/page.tsx
    - src/components/landing/*.tsx (hero, transformation, variations, approach, identity, offer, faq, acquisition-cta, campaign-image, reveal-on-view)

requirements-completed: [REQ-51.1-03, REQ-51.1-09]

# Metrics
duration: multi-session (2026-10-10)
completed: null
---

# Phase 51.1 / Plan 08: attach examples + revalidation + SECOND approval — COMPLETE (branch)

**Approved demonstration arts attached; human approval of the LOCAL landing registered (visual: mobile + desktop, both flag modes). Plan 08 is COMPLETE on the branch — `build` is GREEN and `typecheck` is accepted as an explicit EXTERNAL exception (`ssl`/`pg`, F56). Publication is POSTPONED until F56 is completed/integrated.**

## Status (honest)

- **Art incorporation:** DONE — all landing image slots hold the individually-approved arts (no art placeholders remain).
- **Human approval (visual):** REGISTERED — responsible approved the local landing on **mobile AND desktop, in BOTH flag modes** (see `51.1-UAT.md`).
- **Asset license:** DECLARATION by the responsible (has license + authorizes use of the presented assets). Internal only — **NOT** an independent legal verification and **NOT** in the public footer.
- **Build:** GREEN — `npm run build` exits 0 (using the local `.env.local`).
- **Typecheck:** ACCEPTED EXTERNAL EXCEPTION — pre-existing `ssl`/`pg` error in the F56 integration test; **NOT** marked approved; fix is F56's responsibility.
- **OpenSpec:** change archived (specs synced) with the accepted exception recorded.
- **Publication:** POSTPONED until F56 is completed/integrated, with revalidation of the integrated version.

## What was delivered across the Plan 08 rounds

- Attached the approved arts in the fixed block order (hero, transformação, apresentação, identidade, abordagens, oferta, FAQ).
- Approved copy edits (hero line; transformation step 1; presentation complement; identity support; offer title/summary; FAQ "Para quem o Vendeo foi desenvolvido?").
- Official logo (header 36/44px; footer 24px) on the #0F172A local background; demonstrative legal notice in the footer.
- Minimal transform-only entrance animation (once; reduced-motion/no-IO safe); static placeholders; lazy loading below the hero.
- Per-instance CTA alignment; 48px acquisition buttons (local `!important` override of GoogleButton's inline 44px, auth component untouched).
- Transformation: compact text entry + provided-photo thumbnail → full 1:1 campaign + decorative arrow; four steps as a single-column compact list.

## Deviations / issues

- The `ssl`/`pg` typecheck error is pre-existing and **out of F51.1 scope** (shared ambient `pg` declaration); the minimal coordinated fix is upstream commit `92059829` (`feature/fase-56-1-...`) — **not** applied here (F56/shared changes forbidden).
- All earlier rounds' deviations are documented in the individual plan SUMMARYs.

## Pendencies (real)

1. **Publication** — postponed until F56 is completed/integrated; revalidate the integrated version (checklist below).
2. **External `ssl`/`pg` typecheck exception** — owned by F56 (coordinate the upstream fix `92059829`); **NOT** part of F51.1 and **NOT** marked approved.

## Publication checklist (after F56 is completed/integrated)

- [ ] Confirm F56 (F56.2b1/b2) completed and integrated on the target base.
- [ ] Resolve/replace the external `ssl`/`pg` typecheck error (F56-owned) so `typecheck` is green.
- [ ] Re-run `npm run typecheck`, `npm run lint`, `npm run build` and the landing suite on the INTEGRATED version.
- [ ] Re-run the visual review (mobile + desktop, both flag modes) on the integrated version.
- [ ] Confirm `openspec` change archived and specs synced; no residual active F51.1 change.
- [ ] Only then deploy/publish the landing.

---
*Phase: 51.1-landing-visual-produto*
*Plan 08 status: COMPLETE on the local branch (typecheck external exception accepted) — NOT published*
