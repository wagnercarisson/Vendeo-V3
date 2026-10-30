# Q45 — human visual acceptance

**Status: PENDING**

| Field | Value |
|---|---|
| Approved by | _pending_ |
| Date | _pending_ |
| Viewports tested | _pending_ — mobile 390×844 DPR 3; desktop 1440×900 DPR 1 |
| Modes tested | _pending_ — flag on and flag off, each from its own explicit build served at `localhost:3000` (the flag is baked into the prerendered HTML) |
| Text/price legibility confirmed | _pending_ |
| Framing/proportion unchanged | _pending_ |

## Context for the reviewer

- Automated gates passed and the production build was measured (see `lighthouse-q45-summary.md`).
- Nothing was published, merged, pushed, tagged or deployed.
- The approved visual must remain identical; only delivery (responsive variants) and hero download priority changed.
- Follow `visual-q45-checklist.md` for the exact URLs and viewports.

## Agent pre-check (not human acceptance)

- Captures: both flag modes at mobile (390 @ DPR2) and desktop (1440 @ DPR1):
  `screenshots/landing-flag-on-{mobile,desktop}-full.webp` and
  `screenshots/landing-flag-off-{mobile,desktop}-full.webp`, plus native crops
  `screenshots/{mobile,desktop}-*.webp`.
- The flag-OFF build was produced explicitly with `VENDEO_PUBLIC_SIGNUP_ENABLED=false`, served, captured, then the original `.next` was restored and the flag-ON server restarted and re-verified (5 true markers, HTTP 200).
- Campaign headlines, prices and disclaimers remain sharp and legible in both modes; framing, 1:1 proportion and `object-contain` are unchanged; layout/copy/CTAs are visually identical apart from the intended flag differences.
- Candidate selection confirmed in the built app: 640w (mobile default), 480w/320w (desktop DPR1), 1024w original capped at DPR3; hero requested exactly once per run.

## Acceptance record

_To be filled by the human reviewer before any publication._
