# Campaign Visual System — Vendeo V3

> **Rendering specification for the output campaign image.**
> This document defines exactly how the visual "Produto + Oferta" is composed, rendered, and constrained.
> The renderer (programmatic or AI-guided) MUST follow these rules.
> The frontend preview MUST match the exported image pixel-for-pixel.

---

## 1. Canvas Specifications

| Property | Value |
|----------|-------|
| Canvas size | **1080 × 1080 pixels** (1:1 square) |
| Resolution | 72 DPI |
| Color profile | sRGB IEC61966-2.1 |
| Orientation | Square (Instagram/Facebook/WhatsApp compatible) |

### Future formats (post-V1)
- Landscape: 1200 × 628px (Facebook link ads)
- Story: 1080 × 1920px (Instagram Stories, Reels)
- Banner: 728 × 90px (display ads)

---

## 2. Composition Structure

```
┌──────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────┐  │ <- Safe zone start (40px)
│  │                                              │  │
│  │  ┌──────────────────────┐                   │  │
│  │  │    BADGE (Oferta     │  [top-right area] │  │ <- Badge: corner
│  │  │     Limitada)        │                   │  │
│  │  └──────────────────────┘                   │  │
│  │                                              │  │
│  │                                              │  │
│  │                PRODUTO                       │  │ <- ~55-60% of height
│  │              (imagem)                        │  │    Image zone
│  │                                              │  │
│  │                                              │  │
│  ├──────────────────────────────────────────────┤  │ <- Gradient overlay
│  │                                              │  │    (soft transition)
│  │        NOME DO PRODUTO                      │  │ <- ~20% of height
│  │                                              │  │    Text zone
│  │     De R$ XX,XX    R$ XX,XX                  │  │
│  │     (original)    (com desconto)             │  │
│  │                                              │  │
│  │  ┌──────────────────────────────────────┐    │  │
│  │  │         DESCRIÇÃO / CHAMADA          │    │  │
│  │  └──────────────────────────────────────┘    │  │
│  │                                              │  │
│  │  ┌──────────────────────────────────────┐    │  │ <- Bottom 10-15%
│  │  │  CTA: Corra e Garanta o Seu!         │    │  │    Action zone
│  │  └──────────────────────────────────────┘    │  │
│  │                                              │  │
│  │              [LOJA]                          │  │ <- Logo + name
│  └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Zone Distribution (vertical)

| Zone | % Height | Content |
|------|----------|---------|
| Top padding | 4% (43px) | Safe margin |
| Badge | 5% (54px) | Promotional badge (top-right) |
| Product Image | **55% (594px)** | Main product photo |
| Gradient overlay | 2% (22px) | Smooth transition image→text |
| Product Name | 8% (86px) | Product title, bold |
| Price region | 9% (97px) | Original (strikethrough) + discounted |
| Description | 7% (76px) | Call-to-action or offer description |
| CTA Button | 6% (65px) | Action button (pill shape) |
| Store identity | 4% (43px) | Logo + store name |

---

## 3. Zone Detail Specifications

### 3.1 Background

- **Type:** Solid color or subtle gradient
- **Default:** Pure white `#FFFFFF`
- **Alternatives (per segment):** light, clean backgrounds
- **Fallback:** White — ensures maximum contrast for product image
- **Noise/texture:** none in V1
- **Gradient overlay:** linear gradient top→bottom (image zone→text zone)
  - Start: transparent `rgba(0,0,0,0)`
  - End: `rgba(0,0,0,0.15)` for light backgrounds, `rgba(0,0,0,0.4)` for white
  - Height: ~30px

### 3.2 Product Image Zone

| Property | Value |
|----------|-------|
| Zone height | ~55% of canvas (594px) |
| Width | Full canvas minus safe margins (1000px) |
| Position | Top center |
| Object fit | **Cover** (crop to fill) |
| Alignment | Center-center |
| Border radius | 0 (full bleed to edges) |

**Rules:**
- If image aspect ratio < 1:1 (portrait): center vertically, sides crop
- If image aspect ratio > 1:1 (landscape): center horizontally, top/bottom crop
- Image MUST be at least 600×600px source resolution
- If image is low quality (< 300px): apply subtle gaussian blur (emergency only) + warn user
- No filters, no desaturation — product must look natural
- Product should be centered in frame (AI detection for main subject is future)

### 3.3 Badge Zone

| Property | Value |
|----------|-------|
| Position | **Top-right corner** |
| Margin from edges | 24px right, 24px top |
| Shape | Pill / rounded-full |
| Padding | 10px horizontal, 6px vertical |
| Font | Poppins 700, 24px |
| Text | White `#FFFFFF` |
| Background | `#22C55E` (default fallback) |
| Max characters | 20 |

**Badge background color priority:**
1. Lojista definiu cor da marca → usar cor da marca
2. Segmento tem cor padrão → usar cor do segmento
3. Fallback → `#22C55E` (verde Vendeo padrão)

**Badge text options:**
- Automático: "X% OFF" (calculado da diferença de preços)
- Manual: badge escolhido pelo lojista no dropdown
- Fallback: nenhum badge se não houver desconto nem escolha manual

**No badge scenario:** space is left empty (no placeholder).

### 3.4 Product Name Zone

| Property | Value |
|----------|-------|
| Font | Poppins 700 |
| Size | 42px (base) |
| Color | `#1E293B` (slate-800) |
| Alignment | Center |
| Max lines | 2 |
| Max characters | 60 |
| Line height | 1.2 |

**Overflow rules:**
- If name > 40 characters → reduce to 36px
- If name > 55 characters → reduce to 32px, elipsis at 60 chars
- Never more than 2 lines

### 3.5 Price Zone

**Original Price (strikethrough):**
| Property | Value |
|----------|-------|
| Font | Open Sans 400 |
| Size | 28px |
| Color | `#94A3B8` (slate-400) |
| Decoration | line-through |
| Alignment | Center |
| Position | Above discounted price |

**Discounted Price:**
| Property | Value |
|----------|-------|
| Font | Poppins 700 |
| Size | 52px |
| Color | `#22C55E` (accent-green) |
| Alignment | Center |
| Position | Below original price |

**Price display logic:**
```
Se preço original preenchido:
  De R$ 79,90
  R$ 49,90

Se preço original vazio:
  R$ 49,90     (sem strikethrough, text bigger at 44px)

Se desconto calculável (original > desconto):
  Badge "32% OFF" gerado automaticamente no canto superior
```

### 3.6 Description / Call-to-Action Zone

| Property | Value |
|----------|-------|
| Font | Open Sans 400 |
| Size | 24px |
| Color | `#475569` (slate-600) |
| Alignment | Center |
| Max lines | 2 |
| Max characters | 120 |
| Line height | 1.4 |

**Empty description:** hide this zone entirely, shift CTA up by ~50px.

### 3.7 CTA Button Zone

| Property | Value |
|----------|-------|
| Type | Rounded pill |
| Padding | 18px horizontal, 14px vertical |
| Border radius | 9999px (pill) |
| Background | `#22C55E` |
| Text | White `#FFFFFF` |
| Font | Poppins 700, 22px |
| Alignment | Center |
| Max width | 70% of canvas width |
| CTA text | Default: "Corra e Garanta o Seu!" |
| Shadow | subtle drop-shadow `0 4px 12px rgba(34,197,94,0.3)` |

**CTA text generation:**
1. If description has call-to-action tone → use a phrase from it
2. Default options (random or AI-chosen): "Garanta o Seu!", "Aproveite Agora!", "Não Perca!", "Compre Já!", "Peça o Seu!"
3. If badge is "ÚLTIMAS UNIDADES": CTA = "Últimas Unidades!"

### 3.8 Store Identity Zone

| Property | Value |
|----------|-------|
| Position | Bottom center |
| Font | Open Sans 500, 18px |
| Color | `#64748B` (slate-500) |
| Alignment | Center |
| Margin bottom | 24px from canvas edge |

**With logo:**
```
        [logo circular 40×40px]
           Nome da Loja
```
- Logo: circular, max 40×40px
- Store name below logo

**Without logo (fallback):**
```
           [iniciais em círculo]
           Nome da Loja
```
- Initials circle: 40×40px, bg `#22C55E`, text white, Poppins 600 18px
- Store name below

---

## 4. Safe Areas

```
┌──────────────────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░ 40px padding ░░░░░░░░░░░░░░░░░  │ <- OUTER SAFE ZONE
│  ░░                                            ░░  │    (no content beyond)
│  ░░   ┌────────────────────────────────────┐  ░░  │
│  ░░   │        CONTENT SAFE ZONE           │  ░░  │ <- INNER SAFE ZONE
│  ░░   │   All text, badges, CTA inside     │  ░░  │    (40px from all edges)
│  ░░   │                                    │  ░░  │
│  ░░   └────────────────────────────────────┘  ░░  │
│  ░░                                            ░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└──────────────────────────────────────────────────┘
```

| Zone | Margin | Notes |
|------|--------|-------|
| Outer bleed | 40px all sides | No essential content outside |
| Text safe zone | 60px left/right | Text never exceeds 960px width |
| Bottom safe zone | 60px | Account for mobile notch/home indicator |

---

## 5. Contrast & Legibility Rules

### Minimum ratios (all text on white background)

| Element | Ratio | Ensures |
|---------|-------|---------|
| Product name (slate-800 on white) | 6.5:1 | WCAG AA |
| Discounted price (green on white) | 2.5:1 | ⚠️ **FAILS AA** |
| CTA text (white on green) | 4.0:1 | WCAG AA |
| Description (slate-600 on white) | 5.4:1 | WCAG AA |
| Store name (slate-500 on white) | 4.8:1 | WCAG AA |

**⚠️ Discounted price attention:** Green (#22C55E) on white fails WCAG AA (2.5:1).
- **Mitigation:** Price is large text (52px), which has relaxed AA threshold (3:1).
- At 52px, the effective ratio is acceptable for large text.
- If we switch to a darker green for body text contexts, use `#16A34A` (4.1:1 on white).

### Legibility checklist
- [ ] All body text ≥ 4.5:1 against background
- [ ] All large text (≥24px bold or ≥32px) ≥ 3:1 against background
- [ ] No text over busy image areas without overlay
- [ ] CTA button has visible text contrast
- [ ] Badge text always white on colored background

---

## 6. Badge Styles

### Available Types

| Type | Background | Text | Border | Icon |
|------|-----------|------|--------|------|
| Percent OFF | `#22C55E` | White | None | — |
| LANÇAMENTO | `#3B82F6` | White | None | — |
| OFERTA LIMITADA | `#F59E0B` | White | None | ⏰ (SVG) |
| FRETE GRÁTIS | `#22C55E` | White | None | 🚚 (SVG) |
| 2 POR 1 | `#EC4899` | White | None | — |
| ÚLTIMAS UNIDADES | `#EF4444` | White | None | — |
| Custom | Brand color | White | None | — |

### Badge SVG icons
- ⏰ → lucide `clock` icon (w-16 h-16, placed left of text)
- 🚚 → lucide `truck` icon (w-16 h-16, placed left of text)
- Icons must be SVG (no emoji in actual render)

### Auto-generated percentage badge
- Calculado de: `(preço_original - preço_desconto) / preço_original × 100`
- Se resultado ≥ 5%: exibir badge "X% OFF"
- Se resultado < 5%: não exibir badge automático
- Máximo: "99% OFF" (valores maiores truncam)

---

## 7. Safe Variations (Layout Options)

Variações pré-definidas que o sistema pode gerar automaticamente.
Cada variação é um layout completo — o lojista NÃO pode mixar elementos entre variações.

### Variation A — Padrão (Produto + Oferta)
- Imagem 55%, texto 35%, CTA 6%, logo 4%
- Badge top-right
- Preço centralizado com destaque
- CTA pill centralizado

### Variation B — Sem Badge
- Mesmo layout da variação A
- Badge omitido
- Nenhum espaço extra (imagem ocupa o mesmo espaço)

### Variation C — Texto Menor
- Imagem 60% (mais produto visível)
- Texto 30% (font sizes reduzidos em 15%)
- Preço: Poppins 700 40px instead of 52px
- Nome do produto: 34px instead of 42px
- CTA: 18px instead of 22px
- Badge: 20px instead of 24px

### Variation D — CTA no Topo (experimental)
- CTA pill reposicionado acima do preço
- Preço mantido como destaque principal
- Usar quando CTA é mais importante que descrição

### Variation E — Full Bleed Image (background)
- Imagem do produto ocupa canvas INTEIRO (1080×1080)
- Texto sobreposto com overlay gradiente preto (bottom→top, 60% opacity)
- Texto em white
- CTA com fundo semi-transparente
- Badge mantém posição top-right
- **⚠️ Só usar se imagem tiver resolução ≥ 1080×1080**

---

## 8. Palma de Cores por Segmento (Background)

| Segmento | Background | Text Color | Badge/CTA Color |
|----------|-----------|------------|-----------------|
| Vestuário / Moda | `#FAFAFA` | `#1E293B` | `#EC4899` (pink) |
| Alimentação | `#FFF7ED` | `#1E293B` | `#EA580C` (orange) |
| Beleza / Estética | `#FAF5FF` | `#1E293B` | `#8B5CF6` (purple) |
| Saúde | `#F0FDF4` | `#1E293B` | `#16A34A` (green) |
| Eletrônicos | `#F8FAFC` | `#1E293B` | `#2563EB` (blue) |
| Casa & Decoração | `#FAFAF9` | `#1E293B` | `#D97706` (amber) |
| Serviços | `#EFF6FF` | `#1E293B` | `#2563EB` (blue) |
| **Fallback** | **`#FFFFFF`** | **`#1E293B`** | **`#22C55E`** |

---

## 9. Store Identity Rules

### Priority (resolution order)
1. **Logo** (`logo_url`) — highest priority. If the lojista uploaded a logo, it is always used.
2. **Visual signature** (`visualSignatureUrl`) — used only when no logo exists. Render the visual signature asset as the sole identity element.
3. **Initials fallback** — used when neither logo nor visual signature exists. Show initials circle + store name text.

### Logo rendering
- Logo file stored as uploaded (original format)
- Rendered in bottom-center of campaign image
- Max display size: 40×40px (circular mask)
- If logo aspect ratio ≠ 1:1 → crop to square center
- No background behind logo (transparent PNG supported)

### Visual signature rendering
- Visual signature is a **render-time asset** — it is NOT injected into the AI image generation prompt
- The visual signature is generated once (via AI image) and reused across all campaigns for the store
- When `visualSignatureUrl` is provided and `logo_url` is null, the visual signature replaces the logo+initials zone entirely
- The store name text below the visual signature is **omitted** because the visual signature already contains the store name
- Max display width: 200px, height auto (maintains aspect ratio)
- Supported formats: PNG (AI-generated), SVG (typographic fallback)

### Fallback (no logo, no visual signature)
- Generate circular badge with store initials
- Take first 2 characters of store name
- If store name is single word: first 2 letters
- If store name has spaces: first letter of first 2 words
- Example: "Minha Loja" → "ML"
- Example: "Ana" → "AN"

### Store name text
- Rendered below logo or initials only
- **NOT rendered** when a visual signature is displayed (signature already contains the name)
- Open Sans 500, 18px, slate-500
- Max 1 line — truncate with ellipsis at 30 characters

---

## 10. Constrained Editor Rules (Anti-Canva)

### What the lojista CAN change (guided adjustments)
| Control | Type | Range |
|---------|------|-------|
| Description text | Text input | 0-120 chars |
| Discounted price | Currency | Free |
| Original price | Currency | Optional |
| Badge text | Dropdown + custom | 0-20 chars |
| CTA text | Dropdown (3-5 options) | Fixed phrases |
| Variation choice | Selection (A, B, C, D, E) | Among offered |

### What the lojista CANNOT change
- ❌ Font family or size
- ❌ Element position or order
- ❌ Background color (segment-defined)
- ❌ Image filters or effects
- ❌ Element proportions
- ❌ Adding/removing zones
- ❌ Custom colors (except brand color defined upstream)
- ❌ Drag-and-drop anything
- ❌ Layers, z-order, opacity

**Rationale:** Cada alteração livre quebra a consistência visual.
O valor do Vendeo está em gerar algo PROFISSIONAL automaticamente.
Editor livre = Canva. Canva não é o produto.

---

## 11. Typography Scale (Campaign Output)

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Badge text | Poppins | 24px | 700 | #FFFFFF |
| Product name | Poppins | 42px | 700 | #1E293B |
| Original price | Open Sans | 28px | 400 | #94A3B8 |
| Discounted price | Poppins | 52px | 700 | #22C55E |
| Description | Open Sans | 24px | 400 | #475569 |
| CTA text | Poppins | 22px | 700 | #FFFFFF |
| Store name | Open Sans | 18px | 500 | #64748B |

**All text is center-aligned.**

---

## 12. Renderer Parameters (Tokens for Programmatic Rendering)

> These tokens are the INPUT to the renderer engine (e.g., HTML/CSS, Canvas API, or SVG).
> The renderer takes these parameters and outputs the final 1080×1080 PNG.

### Input Parameters

```typescript
interface CampaignRenderParams {
  // Canvas
  width: number;           // 1080
  height: number;          // 1080

  // Product
  productName: string;            // max 60 chars
  productImageUrl: string;        // source image URL
  productImageSourceWidth: number;
  productImageSourceHeight: number;

  // Pricing
  originalPrice?: number;         // optional, for strikethrough
  discountedPrice: number;        // required
  discountPercent?: number;       // auto-calculated if original provided

  // Text
  description?: string;           // max 120 chars, optional
  ctaText: string;                // generated or chosen

  // Badge
  badgeText?: string;             // optional, max 20 chars
  badgeBackgroundColor: string;   // hex

  // Store identity
  storeName: string;              // max 30 chars
  storeLogoUrl?: string;          // optional
  storeLogoInitials: string;      // fallback initials

  // Colors (derived from segment or brand)
  backgroundColor: string;        // hex
  accentColor: string;            // hex (for CTA, badge fallback)
  textColor: string;              // hex for primary text

  // Layout
  variation: 'A' | 'B' | 'C' | 'D' | 'E';  // layout variant
}
```

### Output
```typescript
interface CampaignRenderResult {
  imageUrl: string;       // URL or base64 (PNG, 1080x1080, sRGB)
  imageBuffer: Buffer;    // raw PNG buffer
  width: number;          // 1080
  height: number;         // 1080
  format: 'png' | 'jpg';
}
```

---

## 13. Fallback Rules (Emergency Mode)

If ANY data is missing, apply these fallbacks:

| Missing Data | Fallback |
|-------------|----------|
| No product image | Show placeholder: gray bg + lucide `image` icon + "Adicione uma foto" — **app should block generation** |
| No store name | "Minha Loja" |
| No discounted price | "R$ 0,00" — **app should block generation** |
| No description | Omit description zone, shift CTA up |
| No badge | No badge rendered |
| No logo | Initials fallback |
| No segment/color | Fallback palette (white bg, green accent) |
| No CTA text | "Aproveite Agora!" |

**If multiple failures:** render the most minimal viable output — product image + fallback name + fallback price.
The Vendeo MUST ALWAYS produce something publicável.

---

## 14. Quality Validation Checklist

Before delivering a rendered campaign visual:

- [ ] Product image is centered, not distorted, covers image zone
- [ ] Text does not overflow safe zones
- [ ] No text overlaps with product image zone (gradient is sufficient separation)
- [ ] Badge is top-right, not overlapping product face
- [ ] CTA button is visually distinct, centered
- [ ] Logo/initials visible at bottom
- [ ] Strikethrough price is readable (not too thin)
- [ ] Discounted price is the MOST visible text element
- [ ] All text ≥ WCAG AA contrast against background
- [ ] Export resolution is exactly 1080×1080
- [ ] No pixelation on product image
- [ ] No emoji anywhere in the rendered image (SVG icons only)
- [ ] Colors match segment palette
- [ ] Store name is correct (no truncation artifacts)

---

## 15. Anti-Patterns (Visual DO NOTs)

- ❌ Produto cortado (cabeça do produto ou texto cortado)
- ❌ Texto sobreposto ao produto sem overlay
- ❌ Mais de 2 linhas de texto em qualquer zona
- ❌ Fontes decorativas ou serifadas na imagem de campanha
- ❌ Imagem do produto esticada ou distorcida
- ❌ Badge fora da área segura
- ❌ CTA com bordas retas (sempre pill shape)
- ❌ Fundo com gradientes complexos ou texturas
- ❌ Preço em verde claro ilegível (sempre verde escuro o suficiente)
- ❌ Logo da loja pixelada (não upscale de imagens < 200px)
- ❌ Efeitos de sombra excessivos no texto
- ❌ Margens inconsistentes entre elementos do mesmo tipo
