# Q45 — human visual acceptance

**Status: APPROVED**

| Field | Value |
|---|---|
| Approved by | Responsável do projeto (aceite registrado nesta conversa) |
| Date | 2026-10-30 |
| Viewports tested | Mobile 390×844 at **DPR 2** (captures reviewed); desktop 1440×900 at DPR 1 |
| Modes tested | Flag ON and flag OFF, each from its own explicit build served at `localhost:3000` (the flag is baked into the prerendered HTML) |
| Text/price legibility confirmed | Yes, for the mobile DPR 2 and desktop DPR 1 captures reviewed |
| Framing/proportion unchanged | Yes — 1:1 `object-contain` box, same campaigns, no crop/proportion change |

## Conditions of the evidence

- Mobile captures were made at **DPR 2**, not DPR 3. The acceptance covers the reviewed captures; it does **not** claim human evaluation at DPR 3.
- DPR 3 was exercised only in the automated candidate-selection diagnostic, where the browser correctly falls back to the untouched 1024w original (no upscale).
- The flag-OFF build was produced explicitly with `VENDEO_PUBLIC_SIGNUP_ENABLED=false`, served, captured, then the original `.next` was restored and the flag-ON server restarted and re-verified (5 true markers, HTTP 200). No `.env` file or production flag was changed.
- Captures: `screenshots/landing-flag-on-{mobile,desktop}-full.webp`, `screenshots/landing-flag-off-{mobile,desktop}-full.webp`, plus native crops `screenshots/{mobile,desktop}-*.webp`.
- Campaign headlines, prices and disclaimers are sharp and legible in both modes; layout, copy and CTAs are identical apart from the intended flag differences.

## Acceptance record

Visual acceptance approved for the mobile (DPR 2) and desktop (DPR 1) evidence in both flag modes. The approved visual is preserved: same campaigns, 1:1 proportion, framing and legibility; H1, copy, colors, layout, spacing, logos, CTAs, FAQ and offer untouched.

The 13 global-suite failures are acknowledged and deferred to a separate task (see `../261030-q45-deferred-items.md`). Merge, push and deploy will be performed by the responsible person in a separate step; **publication is pending and was not executed by this quick**.
