# Commercial Art Direction — `produto-oferta-comercial`

> **Base visual contract for Phase 4.2 Commercial Renderer.**
> This document defines the Phase 4.2 base visual specification for the single campaign template.
> The renderer rewrite MUST implement this contract for the Phase 4.2 base template.
> The implementation SHOULD preserve extension points for future `StoreVisualProfile` and `CampaignVisualPlan` adaptations.
> Overrides specific zone definitions from `CAMPAIGN_VISUAL_SYSTEM.md` where noted.

---

## A. Template Identity

| Property | Value |
|----------|-------|
| Template name | `produto-oferta-comercial` |
| Canvas | **1080 × 1080px** (1:1 square) |
| Resolution | 72 DPI |
| Color profile | sRGB IEC61966-2.1 |
| Orientation | Square (Instagram/Facebook/WhatsApp) |
| Outer safe margin | 40px all edges |
| Text safe zone | 60px left/right (960px effective width) |

**Typography:** Poppins (headings/accents) + Open Sans (body/secondary) per `CAMPAIGN_VISUAL_SYSTEM.md` §11. These fonts are already loaded and consistent with existing renderer output.

**Description / subtitle:** NOT rendered in `produto-oferta-comercial`. The hook/benefício is the primary persuasive text below the price. Description/subtitle fields are reserved for future templates or campaign types. If present in the spec, they are ignored by this template.

---

## B. Zone Layout & Hierarchy

```
┌──────────────────────────────────────────────────┐  ── 40px safe margin
│  ┌────────────────────────────────────────────┐  │
│  │   ┌──────────────────┐  ┌─────────────┐   │  │  ← Badge (top-right)
│  │   │                  │  │   OFERTA    │   │  │     Accent-colored pill
│  │   │                  │  └─────────────┘   │  │
│  │   │    PRODUTO       │                    │  │
│  │   │    (imagem)      │                    │  │  ← ~60% of height
│  │   │                  │                    │  │     Product Image Zone
│  │   │                  │                    │  │
│  │   │                  │                    │  │
│  ├───┴──────────────────┴────────────────────┤  │  ← Subtle shadow divider
│  │                                           │  │
│  │      NOME DO PRODUTO                      │  │  ← Product Name (~6%)
│  │                                           │  │
│  │     De R$ XX,XX    R$ 49,90              │  │  ← Price Block (hero, ~9%)
│  │                                           │  │
│  │    "O estilo que você merece!"            │  │  ← Hook / Benefício (~6%)
│  │                                           │  │
│  │  ┌──────────────────────────────────┐     │  │  ← CTA Pill (~5%)
│  │  │     Garanta seu Estilo!          │     │  │     Visual campaign element
│  │  └──────────────────────────────────┘     │  │
│  │                                           │  │
│  │         ○ [LOJA]                         │  │  ← Store Identity (~4%)
│  │        Minha Loja                        │  │
│  └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

### Zone Distribution (vertical)

| Zone | % Height | px (approx) | Content |
|------|----------|-------------|---------|
| Top padding | 4% | 43px | Safe margin |
| Badge | 4% | 43px | Promotional badge (top-right) |
| Product Image | **60%** | **648px** | Main product photo — primary anchor |
| Shadow divider | 2% | 22px | Subtle inner shadow between image/text |
| Product Name | 6% | 65px | Product title, bold |
| Price Block | 9% | 97px | Original (strikethrough) + discounted R$ (hero) |
| Hook / Benefício | 6% | 65px | Secondary highlight under price |
| CTA Pill | 5% | 54px | Visual campaign element (non-interactive) |
| Store Identity | 4% | 43px | Logo/initials + store name |

**Visual hierarchy (reading order):**
1. Product image — largest, top, draws attention first
2. Discounted price — most prominent text element (largest font, accent color, hero)
3. Product name — identifies what the offer is for
4. Hook/benefício — emotional trigger, secondary highlight
5. CTA pill — final action element
6. Store identity — discreet, says who it's from

**Key differences from stacked layout (Phase 4.1):**
- Image zone increased from 55% → 60% (more product visibility)
- No gradient overlay — replaced with a subtle shadow divider (cleaner break)
- Price is the visual hero of the text zone, not product name
- Hook appears as distinct visual element (not hidden in generic description)
- CTA is integrated as campaign pill (not disabled UI button)
- Store identity is discreet and professional at bottom

---

## C. Product Image Zone

| Property | Value |
|----------|-------|
| Zone height | **60%** of canvas (648px) |
| Width | Full canvas minus safe margins (1000px) |
| Position | Top center, respecting 40px outer safe margins |
| Object fit strategy | **Default: contain** (preserve entire product) |
| | **Cover**: allowed ONLY for lifestyle/contextual images where cropping won't harm the product |
| | Never distort. Never crop essential parts of the product. |
| Alignment | Center-center |
| Border radius | 0 (clean edge — no rounded corners on image zone) |
| Bottom edge | Clean horizontal boundary at 60% mark; subtle inner shadow at divider |

**Treatment:**
- No gradient overlay (replaced by clean divider with shadow)
- No filters, desaturation, or effects — product must look natural and appetizing
- Default `contain` ensures the product is fully visible — it's better to have background showing than to crop the product
- Use `cover` only when the image is explicitly classified as lifestyle/contextual; if classification is unavailable, prefer `contain`
- Low-quality images (< 300px source): reduce visual prominence with contain treatment; PreviewPage may show a warning outside the campaign art, but the rendered campaign MUST NOT include warning badges or diagnostic UI

**Shadow divider (replaces gradient overlay):**
- A subtle `box-shadow: inset 0 -8px 12px -8px rgba(0,0,0,0.08)` on the image container
- This creates a clean visual break between image and text without the messy gradient

**Error state:**
- Product image absent or fails to load → **explicit error state**
- No placeholder image, no gray box with icon
- The renderer receives `productImageUrl: null` → renders gray background with centered text: "Imagem do produto não disponível" in slate-400 18px Open Sans
- This campaign is **not publishable** — the error state is unmistakable
- No fallback image, no generated image

---

## D. Price Block

The price block is the **visual hero** of the text zone. It must command attention.

### Layout (centered, stacked vertically):

```
De R$ 79,90      ← Original price (strikethrough, subtle)
R$ 49,90         ← Discounted price (HERO — largest text, boldest, accent color)
```

### Original Price

| Property | Value |
|----------|-------|
| Font | Open Sans 400 italic |
| Size | **24px** (slightly reduced from 28px to make discounted price stand out more) |
| Color | `#94A3B8` (slate-400) |
| Decoration | line-through |
| Alignment | Center |
| Space below | 4px gap to discounted price |
| Behavior | Hidden entirely if no original price provided |

### Discounted Price (HERO)

| Property | Value |
|----------|-------|
| Font | Poppins **800** (extra-bold, not just 700) |
| Size | **56px** (larger than current 52px — more prominence) |
| Color | **Accent color per segment** (resolved via `resolveCampaignAccentColor()`) |
| Alignment | Center |
| Line height | 1.1 (tight, impactful) |
| Shadow | `text-shadow: 0 2px 4px rgba(0,0,0,0.06)` for subtle depth |
| Letter spacing | `-0.02em` (slightly tighter for price density) |

### No original price
- If `original_price_display` is null or empty → render only discounted price
- Discounted price stays 56px, no layout shift

---

## E. Hook / Benefício

| Property | Value |
|----------|-------|
| Font | Open Sans 400 italic (softer voice than product name) |
| Size | **24px** |
| Color | `#475569` (slate-600) |
| Alignment | Center |
| Max lines | 2 |
| Line height | 1.4 |
| Space above | **8px** gap above hook, **6px** gap below to CTA |

**Visual treatment:**
- Hook is visually distinct from product name — italic signals "this is the benefit/trigger"
- Not as prominent as price or product name (intentionally secondary)
- Acts as emotional bridge between price and CTA

**Empty hook behavior:**
- If `hook` is empty string or null → hide the Hook zone entirely
- CTA pill shifts up by ~14px to occupy the space naturally
- No empty gap left behind

---

## F. CTA as Campaign Element

The CTA is a **visual campaign element**, NOT a UI button and NOT a disabled HTML `<button>`.

| Property | Value |
|----------|-------|
| Type | Visual pill `<div>` (non-interactive) |
| Shape | `rounded-full` (pill, 9999px) |
| Padding | 20px horizontal, 12px vertical |
| Font | Poppins 700 |
| Size | **22px** |
| Color | **White** `#FFFFFF` |
| Background | **Accent color** per segment (same as price — cohesive) |
| Alignment | Center |
| Max width | 70% of content width (672px) |
| Shadow | `0 4px 12px rgba(0,0,0,0.1)` using the accent color at reduced opacity |
| Position | Below hook, centered |

**Critical rules:**
- MUST be a `<div>` with styled text, NOT a `<button>` element
- NO pointer cursor (it's visual only, not interactive)
- NO hover effects, NO focus ring, NO click handler
- The CTA is an INTEGRATED CAMPAIGN ELEMENT, not a UI control

**Empty CTA fallback:**
- If CTA is empty string or null → fallback to `"Aproveite Agora!"`
- Always render the CTA pill — never skip it (it's a structural element)

---

## G. Store Identity

| Property | Value |
|----------|-------|
| Position | Bottom center, 24px from canvas bottom edge |
| Layout | Logo/initials centered above store name |

### Logo present:
```
         [○] ← Circular mask, 40×40px
     Minha Loja ← Open Sans 500, 16px, #64748B
```

- Logo: circular mask, max 40×40px, centered
- If logo aspect ratio ≠ 1:1 → crop to square center
- No background behind logo (transparent PNG supported)
- Logo sits 4px above store name

### Logo absent (fallback):
```
         [ML] ← Circle 40×40px, bg=accent color, text=white
     Minha Loja ← Open Sans 500, 16px, #64748B
```

- Initials circle: 40×40px, background = accent color, white text
- Font: Poppins 600, 18px (visible inside 40px circle)
- Initials computed by `getStoreInitials()` — first letter of first two words, or first 2 chars

### Store name:
- Font: Open Sans 500, **16px** (reduced from 18px for subtlety)
- Color: `#64748B` (slate-500)
- Max 1 line — truncate with ellipsis at 30 characters
- Alignment: Center

**Professional treatment:** Store identity is discreet — it says "who made this" without competing with the offer. No large logo, no bold fonts, no bright colors in this zone.

---

## H. Background Treatment

### Base
- The background zone occupies the bottom 40% of the canvas (below the product image)
- Solid color fill from bottom edge up to the image divider

### Per Segment Palette
Each segment has a specific background color scheme (from `SEGMENT_PALETTES` in types.ts). The text zone background uses the segment's `background` color.

| Segment | Background | Notes |
|---------|-----------|-------|
| `moda-vestuario` | `#FAFAFA` | Near-white with pink accent |
| `alimentacao-bebidas` | `#FFF7ED` | Warm orange-tinted |
| `beleza-estetica` | `#FAF5FF` | Soft purple-tinted |
| `saude-farmacia` | `#F0FDF4` | Light green-tinted |
| `eletronicos-tecnologia` | `#F8FAFC` | Cool blue-tinted |
| `casa-decoracao` | `#FAFAF9` | Warm cream |
| `servicos` | `#EFF6FF` | Soft blue |
| `petshop` | `#FFFFFF` | Clean white |
| `variedades` | `#FFFFFF` | Clean white |
| `outros`/fallback | `#FFFFFF` | Clean white |

### Accent color usage
The accent color (per `resolveCampaignAccentColor()`) is used for:
1. Discounted price text (hero)
2. CTA pill background
3. Store initials circle background
4. Badge background (if no brandColor)

### Visual treatment for text zone
- Solid color fill — clean, professional, maximum legibility
- No gradients, textures, or patterns in the text zone background
- The product image zone background matches the text zone color (seamless)
- Product image renders on top of this color fill (no gap between image and text)

---

## I. Fallback Rules

| Missing Data | Behavior |
|---|---|
| `productImageUrl` | **Error state** — gray background + "Imagem do produto não disponível" text. Campaign NOT publishable. |
| `logoUrl` | Initials circle fallback with accent color background |
| `brandColor` | Accent resolved via segment palette → `#22C55E` |
| `original_price_display` | Only discounted price rendered (larger at 56px, no strikethrough) |
| `badge_text` | No badge rendered, no empty space left |
| `subtitle` / `description` | Not used in this template — ignored. Hook is the primary persuasive text. |
| `hook` | Hook zone hidden, CTA shifts up ~14px |
| `cta` | Default to "Aproveite Agora!" |
| `productName` | Title zone hidden entirely (campaign degraded — warn on generation) |
| `storeName` | "Minha Loja" fallback |
| Background color | Segment palette → `#FFFFFF` |

**Multiple failures:** Render the most minimal viable output — product image + discounted price (fallback "R$ 0,00") + CTA "Aproveite Agora!" + store name "Minha Loja". But product image error always prevents publishability.

---

## J. Anti-Patterns (DO NOTs)

1. ❌ **No stacked layout** — The image and text zones must be visually integrated with a clean divider, not stacked as separate blocks

2. ❌ **No disabled button element for CTA** — The CTA is a visual `<div>` pill, never a `<button disabled>`. No pointer cursor, no hover effects, no focus states.

3. ❌ **No solid-only background when segment offers tinting** — Use the per-segment background colors, not just white. White is fallback only.

4. ❌ **No text over product image without clean separation** — The image zone ends cleanly at 60%; text never overlaps the image zone. No gradient overlay.

5. ❌ **No distorted product image** — Always `object-fit: contain` (default) or `cover` (lifestyle only). Never `fill` or stretched. Center-center alignment.

6. ❌ **No placeholder for missing product image** — Explicit error state only. No gray box with icon, no "add image" suggestion in the rendered output.

7. ❌ **No emoji icons in rendered campaign** — All icons must be SVG (lucide-react or inline SVG). No emoji characters in the visual output.

8. ❌ **No generic "compre agora" for hook** — Hook must be segment-aware and contextually relevant. Avoid generic Portuguese phrases that lack emotional appeal.

9. ❌ **No price in unreadable green** — Use the resolved accent color (per segment or brand), not hardcoded `#22C55E` on white which fails contrast at small sizes. At 56px Poppins 800, contrast is acceptable.

10. ❌ **No layout shift from hidden zones** — When hook/subtitle/badge are empty, surrounding elements adjust without leaving empty gaps. No absolute positioning that leaves holes.

---

## K. Reference Composition Description

A completed commercial campaign looks like this:

A 1080×1080 square canvas with 40px safe margins on all sides. The top 60% is dominated by a product photograph — a pair of running shoes, centered and fully visible within the product zone. The image uses `contain` by default to preserve the full product, with `cover` reserved only for approved lifestyle/contextual images. The image ends in a clean horizontal line. A subtle inner shadow at the bottom edge of the image zone creates a gentle visual pause.

Below the image, on a warm near-white background (`#FAFAFA` for moda-vestuario), the campaign text begins. The product name "Tênis UltraRun X" sits in bold 42px Poppins, dark slate color. Just below it, the original price "De R$ 199,90" appears in 24px italic Open Sans with a strikethrough, in muted slate-400.

The discounted price **"R$ 129,90"** commands attention: 56px Poppins 800 in the segment's accent pink (`#EC4899`), with a subtle text shadow for depth. It's the largest text on the canvas and the eye goes to it naturally.

Beneath the price, the hook "O estilo que você merece!" appears in 24px italic Open Sans — softer, inviting. It bridges the logical price with the emotional benefit.

The CTA pill "Garanta seu Estilo!" sits centered below, a rounded pill in the same accent pink, white Poppins text, with a gentle drop shadow. It's clearly a campaign element, not a button to click — there's no cursor change, no hover effect.

At the very bottom, a small circular logo (40px) sits centered, with the store name "Sneaker Store" in subtle 16px slate text beneath it. The store signature is present but discreet — the viewer knows who the campaign is from, but the offer remains the hero.

The visual reading order is: product image → discounted price → product name → hook → CTA → store identity. Every element has its place, nothing fights for attention, and the composition feels intentional and professional.

---

## L. Future Personalization Model

This contract defines the Phase 4.2 **base template**, not the final personalization model of Vendeo. The fixed visual track is intentional for Phase 4.2 — it ensures every campaign meets a minimum publishable quality before personalization layers are introduced.

Future versions may introduce:

- **`StoreVisualProfile`** — generated from store data, segment, subsegment, region, tone, positioning, brand color, and audience. A persisted profile that defines each store's visual identity across all campaigns.
- **`CampaignVisualPlan`** — generated per campaign from product type, price tier, image quality, campaign objective, channel, and urgency. Allows the visual treatment to adapt to what is being sold and why.
- **Lojista approval flow** — persist a preferred store visual profile after reviewing generated campaigns.
- **Controlled visual variations** — within the same template family, without turning the renderer into a free-form editor.
- **Segment/subsegment-specific refinements** — nuanced visual treatments that go beyond the Phase 4.2 palette.

**Phase 4.2 MUST NOT implement these features yet.** The base template is deliberately fixed to one layout with segment-driven palette choices.

**However, the renderer SHOULD avoid hardcoding decisions that would block these future adaptations.** In practice:
- Zone proportions should be parameter-driven rather than hardcoded CSS percentages
- Color resolution should flow through the existing `resolveCampaignAccentColor()` / `resolveCampaignBackgroundColor()` functions rather than be inlined
- Background treatment logic should be extensible per segment
- Fallback composition adjustments (hide zone, shift elements) should be rules-based rather than case-by-case hardcoded
