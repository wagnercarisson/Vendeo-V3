# Q45 — manual visual checklist (landing image delivery)

No screenshot automation was added (that would require a new dependency). Use this checklist manually.

## Modes / URLs

- **Flag off (default):** `http://localhost:3000/`
- **Flag on (temporary, no `.env` edit):** in PowerShell:
  ```powershell
  $env:PORT="3100"
  $env:VENDEO_PUBLIC_SIGNUP_ENABLED="true"
  npm start
  ```
  Open `http://localhost:3100/`. Afterwards stop the process on port 3100 and clear both variables (`Remove-Item Env:PORT`, `Remove-Item Env:VENDEO_PUBLIC_SIGNUP_ENABLED`).
  Automated check already performed during execution: flag-on returned HTTP 200 with `data-public-signup-enabled="true"` (5 markers) and **no** `#acesso` form.

## Viewports

- **Mobile:** 390 × 844, DPR 3
- **Desktop:** 1440 × 900, DPR 1

## Items to verify (both modes, both viewports)

| # | Item | Expected |
|---|---|---|
| 1 | Hero campaign (café) | Text and price legible, no blur; same 1:1 framing (`object-contain`); no visible crop/proportion change |
| 2 | Transformação (petshop) | Legible copy/price; same framing; ration thumbnail (112 px) unchanged |
| 3 | Apresentação (3 tiles) | Same framing; mobile strip shows one legible tile + part of the next |
| 4 | Identidade (floricultura) | Legible; same framing |
| 5 | Abordagens (3 tiles) | Same framing; mobile strip behaves as before |
| 6 | Network tab | Hero loads a variant close to the rendered width: `-640w` at mobile-default (412 @ 2.625), `-480w` at desktop DPR 1; at 390 @ DPR 3 the needed ~1026 px exceed 768w, so the untouched `hero-oferta-cafe.webp` (1024w) is correct. No broken images |
| 7 | Layout / copy | H1, copy, colors, spacing, logos, CTAs, FAQ and offer untouched (no layout shift) |
| 8 | Non-campaign assets | Ration (`transformacao-produto-racao.webp`) and logo (`vendeo-logo-dark.webp`) request the original file only, with no `srcset` |
| 9 | Flag on | Google CTA + "Continuar com email" → `/signup`; no access form. Flag off | "Solicitar acesso free" → `#acesso` |

## Captured evidence (agent pre-check)

Real emulated captures from the current production build (flag ON), via Chrome DevTools Protocol — no new dependency:

- `screenshots/landing-flag-on-mobile-full.webp` — 390 × 844, DPR 2, full page.
- `screenshots/landing-flag-on-desktop-full.webp` — 1440 × 900, DPR 1, full page.
- `screenshots/mobile-*.webp` — native-resolution crops of the five campaign images visible in the mobile viewport (hero, transformação, apresentação, identidade, abordagens).
- `screenshots/desktop-*.webp` — native-resolution crops of all nine campaign images.

Pre-check result: campaign headlines, prices and disclaimers are sharp and legible; framing, 1:1 proportion and `object-contain` are unchanged; the mobile strips still show one legible tile + part of the next. This is **not** a substitute for human acceptance.

### Flag-off limitation

The current production build is statically prerendered with `VENDEO_PUBLIC_SIGNUP_ENABLED=true` (`.env.local`), so runtime env overrides do not change the frozen HTML. Capturing flag-off visually would require a second build with the flag frozen to `false` — out of this task's scope and would disturb the build measured above. Flag-off behavior is covered by the automated suite (`landing-page.test.tsx`, both flag modes) and must be confirmed manually by starting a flag-off build when convenient. The image delivery markup is flag-independent.

## Notes

- If a manual screenshot is captured, store it only if < 200 KB; otherwise keep the textual checklist.
- This checklist is **PENDING** until a human performs it.
