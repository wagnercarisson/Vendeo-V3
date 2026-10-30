# Q45 — manual visual checklist (landing image delivery)

No screenshot dependency was added: captures use Chrome DevTools Protocol directly. Use this checklist manually.

## Important: the flag is baked into the prerendered HTML

The home page is statically prerendered, so changing `VENDEO_PUBLIC_SIGNUP_ENABLED` only in the runtime environment (`$env:...; npm start`) does **not** change an already-built HTML. To switch modes you must build with the desired value:

```powershell
# flag off (explicit)
$env:VENDEO_PUBLIC_SIGNUP_ENABLED="false"; npm run build; npm start

# flag on (explicit)
$env:VENDEO_PUBLIC_SIGNUP_ENABLED="true"; npm run build; npm start
```

Clear the variable afterwards (`Remove-Item Env:VENDEO_PUBLIC_SIGNUP_ENABLED`). The repository's `.env.local` must not be edited for this check.

## Modes / URLs

- **Flag on:** current production build at `http://localhost:3000/` (5 × `data-public-signup-enabled="true"`, no `#acesso` form).
- **Flag off:** built locally with `VENDEO_PUBLIC_SIGNUP_ENABLED=false`; served at `http://localhost:3000/` for capture (5 × `data-public-signup-enabled="false"`, `#acesso` form present, "Solicitar acesso free" CTAs). The original `.next` was preserved and restored, and the flag-on server was restarted and re-verified afterwards.

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

Real emulated captures via Chrome DevTools Protocol — no new dependency:

- `screenshots/landing-flag-on-mobile-full.webp` — flag ON, 390 × 844, DPR 2, full page.
- `screenshots/landing-flag-on-desktop-full.webp` — flag ON, 1440 × 900, DPR 1, full page.
- `screenshots/landing-flag-off-mobile-full.webp` — flag OFF build, 390 × 844, DPR 2, full page (beta badge, "Solicitar acesso free" CTAs, access form).
- `screenshots/landing-flag-off-desktop-full.webp` — flag OFF build, 1440 × 900, DPR 1, full page.
- `screenshots/mobile-*.webp` — native-resolution crops of the five campaign images visible in the mobile viewport (hero, transformação, apresentação, identidade, abordagens), from the flag-ON capture; the campaign markup/assets are identical in both modes.
- `screenshots/desktop-*.webp` — native-resolution crops of all nine campaign images, flag ON.

Pre-check result: campaign headlines, prices and disclaimers are sharp and legible in both modes; framing, 1:1 proportion and `object-contain` are unchanged; the mobile strips still show one legible tile + part of the next. This is **not** a substitute for human acceptance.

## Notes

- If a manual screenshot is captured, store it only if < 200 KB; otherwise keep the textual checklist.
- This checklist is **PENDING** until a human performs it.
