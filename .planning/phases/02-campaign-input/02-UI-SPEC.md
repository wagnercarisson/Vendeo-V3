# UI Design Contract — Campaign Input

> Generated from OpenSpec design system (`openspec/design-system/pages/campaign-input.md`, `openspec/design-system/MASTER.md`)

**Phase:** 02 — Campaign Input
**Date:** 2026-05-25

## Visual Identity

- **Theme:** Dark Mode (OLED) — `#020617` background, `#F8FAFC` text, `#22C55E` accent
- **Typography:** Poppins 700 (headings/CTA), Open Sans (body/inputs)
- **Icon Library:** lucide-react (no emojis as icons)

## Layout

Two-column on desktop: image preview (left, ~40%) + form fields (right, ~60%).
Stacked (image first, form below) on mobile.

### Read-only Store Identity Block
Compact card at top: store name, segment badge (human-readable), brand color swatch.
Non-interactive — no form fields or edit buttons.

### Blocking State (no store_id)
Centered: "Cadastre sua loja primeiro" title, explanation text, CTA button to `/store`.

### Loading State
Loading indicator while fetching store via `GET /api/store/{id}`. No form rendered.

### Error State
Non-destructive error message with retry button + CTA to `/store` on network/500 failure.

## Components

### CampaignInputForm
- Nome do Produto: required text, max 60 chars, inline validation on blur
- Descrição Breve: optional text, max 120 chars, character counter
- Preço Original: optional currency input, BRL mask (`R$ 49,90`)
- Preço com Desconto: required currency input, BRL mask
- Badge Promocional: required dropdown (`Oferta`, `Promoção`, `Queima de Estoque`, `Novidade`, `Últimas Unidades`)
- Submit button "Criar Campanha"
- Success banner on valid submit (data preserved on screen)

### CampaignImageUpload
- Dropzone styled file input
- Preview via object URL on selection
- Inline error on invalid format/size
- Required field — submit blocked without image

### StoreIdentityBlock
- Read-only card: store name, segment badge, brand color swatch
- Uses `resolveStoreIdentity` for color fallback

## States Coverage

| State | Component | Behavior |
|-------|-----------|----------|
| Empty | Campaign page | Blocking state — no store_id |
| Loading | Campaign page | Spinner while fetching store |
| Error | Campaign page | Error + retry + CTA to /store |
| Invalid field | Form | Inline error on blur |
| Valid submit | Form | Success banner, data preserved |
| Valid image | Upload | Object URL preview shown |
| Invalid image | Upload | Inline error, no preview |

## Design Tokens

All tokens from `openspec/design-system/MASTER.md` apply:
- `bg-deep`: `#020617` (page background)
- `bg-surface`: `#0F172A` (card/surface background)
- `bg-elevated`: `#1E293B` (elevated elements)
- `text-primary`: `#F8FAFC` (primary text)
- `text-secondary`: `#94A3B8` (secondary text)
- `text-muted`: `#64748B` (muted text)
- `accent-green`: `#22C55E` (CTAs, success)
- `accent-red`: `#EF4444` (errors)
- `accent-amber`: `#F59E0B` (warnings)

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| Nome do Produto | required, max 60 chars | "Nome do produto é obrigatório" / "Máximo de 60 caracteres" |
| Preço com Desconto | required, > 0 | "Preço deve ser maior que zero" |
| Preço Original | optional, > 0 if provided | "Preço deve ser maior que zero" |
| Preço Original vs Desconto | original > discounted | "Preço com desconto deve ser menor que o preço original" |
| Badge Promocional | required, from BADGE_OPTIONS | — |
| Imagem do Produto | required, PNG/JPG/WEBP, ≤ 5MB | "Formato não suportado. Use PNG, JPG ou WEBP" / "Arquivo muito grande. Máximo 5MB" / "Imagem do produto é obrigatória" |

## Reference Files

- `openspec/design-system/pages/campaign-input.md` — Full visual spec with layouts
- `openspec/design-system/MASTER.md` — Design system tokens and rules
- `openspec/changes/phase-2-1-campaign-input-ui/specs/campaign-input-ui/spec.md` — All scenarios
