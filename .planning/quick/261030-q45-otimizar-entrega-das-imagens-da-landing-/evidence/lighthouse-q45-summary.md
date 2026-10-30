# Lighthouse Q45 — landing image delivery (local evidence)

**Scope:** local production build (`next start`), mobile default preset, `--only-categories=performance`, headless Chrome, 3 runs before and 3 runs after. These numbers are local evidence only — they are **not** a production guarantee.

**Command per run:**

```powershell
npx lighthouse http://localhost:3000/ --only-categories=performance --output=json --output-path=<temp path> --chrome-flags="--headless=new --no-sandbox --disable-gpu" --quiet
```

**Raw JSON:** `C:\Users\wagne\AppData\Local\Temp\opencode\landing-perf\{baseline,after}-{1,2,3}.json` (outside the repository; not committed).

## Per-run results

| Run | Build | Perf | FCP (ms) | LCP (ms) | TBT (ms) | CLS |
|---|---|---|---|---|---|---|
| 1 | before | 78 | 1552 | 5222 | 24 | 0 |
| 2 | before | 78 | 1552 | 5214 | 25 | 0 |
| 3 | before | 78 | 1551 | 5215 | 31 | 0 |
| 1 | after | 88 | 1559 | 3726 | 45 | 0 |
| 2 | after | 89 | 1555 | 3671 | 29 | 0 |
| 3 | after | 89 | 1555 | 3651 | 32 | 0 |

## Median

| Metric | Before | After | Delta |
|---|---|---|---|
| Performance score | 78 | 89 | +11 |
| FCP | 1552 ms | 1555 ms | ~0 |
| LCP | 5215 ms | 3671 ms | −1544 ms (−29.6%) |
| TBT | 25 ms | 32 ms | +7 ms |
| CLS | 0 | 0 | 0 |

## Image transfer (run 1, `network-requests`)

| Metric | Before | After |
|---|---|---|
| Landing images requested | 8 | 8 |
| Total `public/landing` transfer | 850.5 KiB | 357.7 KiB |
| Hero transfer | `hero-oferta-cafe.webp` 184.4 KiB | `hero-oferta-cafe-640w.webp` 76.6 KiB |

The hero is the LCP element; the browser now selects a variant matching the rendered width, and the hero carries `fetchPriority="high"` (single preload link emitted). TBT variation is within the observed run-to-run noise (24–45 ms) and not attributed to this change.

## Candidate selection (built app, browser)

Extra diagnostic passes on the same build (`after-desktop.json`, `after-dpr3.json`), read from `network-requests`:

| Scenario | Viewport / DPR | Hero | Transformação / Identidade | 3-col tiles |
|---|---|---|---|---|
| Mobile default (Lighthouse) | 412 × 823 / 2.625 | `-640w` (77 KiB) | `-640w` (62/65 KiB) | `-640w` (40–46 KiB) |
| Desktop preset | 1350 × 940 / 1 | `-480w` (51 KiB) | `-480w` (42/43 KiB) | `-320w` (16–21 KiB) |
| Mobile emulated | 390 × 844 / 3 | original `1024w` (184 KiB) | original `1024w` | original `1024w` |

- `sizes` math matches the measured layout: at DPR 1 the browser picks 480w for ~468/476/452 px columns and 320w for ~315 px tiles; at DPR 2.625 it picks 640w; at DPR 3 the needed 798–1026 px exceed the 768w variant, so the browser correctly falls back to the untouched 1024w original (no upscaling, no phantom file).
- The hero is requested exactly **once** in every run — baseline-1, after-1, after-desktop and after-dpr3 each show a single `hero-oferta-cafe*` image request. The emitted preload and the `<img>` resolve to the same `srcset`, with no duplicate download.
- `srcSet`/`fetchPriority` appear camelCased in React 19 streamed markup; HTML attribute names are case-insensitive and the browser applies them (confirmed by the selected candidates above).

## Limitations

- Single local machine, single production build; no throttled network profile beyond Lighthouse mobile defaults.
- No production measurement was performed (out of scope; nothing was published).
- Human visual acceptance remains **PENDING** (see `visual-q45-acceptance.md`).
