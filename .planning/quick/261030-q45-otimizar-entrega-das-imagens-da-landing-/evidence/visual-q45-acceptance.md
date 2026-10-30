# Q45 — human visual acceptance

**Status: PENDING**

| Field | Value |
|---|---|
| Approved by | _pending_ |
| Date | _pending_ |
| Viewports tested | _pending_ — mobile 390×844 DPR 3; desktop 1440×900 DPR 1 |
| Modes tested | _pending_ — flag off (`localhost:3000`) and flag on (`localhost:3100`) |
| Text/price legibility confirmed | _pending_ |
| Framing/proportion unchanged | _pending_ |

## Context for the reviewer

- Automated gates passed and the production build was measured (see `lighthouse-q45-summary.md`).
- Nothing was published, merged, pushed, tagged or deployed.
- The approved visual must remain identical; only delivery (responsive variants) and hero download priority changed.
- Follow `visual-q45-checklist.md` for the exact URLs and viewports.

## Agent pre-check (not human acceptance)

- Captures: `screenshots/landing-flag-on-mobile-full.webp` (390 @ DPR2) and `screenshots/landing-flag-on-desktop-full.webp` (1440 @ DPR1), plus native crops `screenshots/{mobile,desktop}-*.webp`.
- Campaign headlines, prices and disclaimers remain sharp and legible at mobile DPR2; framing, 1:1 proportion and `object-contain` are unchanged; layout/copy/CTAs are visually identical.
- Candidate selection confirmed in the built app: 640w (mobile default), 480w/320w (desktop DPR1), 1024w original capped at DPR3; hero requested exactly once per run.
- Limitation: the current build is prerendered with the flag ON, so the flag-OFF mode was not screenshot; it is covered by the automated both-modes tests and remains a manual check. See `visual-q45-checklist.md`.

## Acceptance record

_To be filled by the human reviewer before any publication._
