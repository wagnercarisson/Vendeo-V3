# Phase 02: Campaign Input - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning
**Source:** OpenSpec Phase 2.1 artifacts + design decisions

<domain>
## Phase Boundary

This phase delivers the campaign input form — the second step in the Vendeo V1 flow (Store Identity → Campaign Input → AI Intelligence → Rendering → Export). The user provides product + offer details that will later feed AI generation and programmatic rendering.

**In scope:** Product name, description, prices (BRL), promotional badge, product image upload with local preview, read-only store identity display, client-side validation, local submit success state, route split (`/` for campaign, `/store` for store identity).

**Out of scope:** AI generation, rendering, export, database writes, Supabase Storage, image persistence, step navigation, auth, dashboard, multitenancy.

**Store Identity (Phase 1.5)** already saves store data in localStorage and the `stores` Supabase table. This phase reuses that data read-only — no store editing on the campaign page.

</domain>

<decisions>
## Implementation Decisions

### Route Architecture
- `/` becomes the campaign input form (replaces current StoreIdentityForm landing)
- `/store` becomes the dedicated Store Identity form route (moves existing form)
- Next.js App Router handles routing natively

### Store Identity Integration
- On mount, check `localStorage.getItem("store_id")`
- If null → blocking state with CTA to `/store`
- If valid → fetch via `GET /api/store/{id}`; 404 → clear localStorage + blocking state
- Network/500 error → error state with retry + CTA to `/store`
- Loading state while fetching (no form render until loaded)
- Read-only `StoreIdentityBlock` shows name, segment badge, brand color swatch using `resolveStoreIdentity` fallback

### Image Upload
- `<input type="file">` styled as dropzone
- Accepted: PNG, JPG/JPEG, WEBP only
- Max size: 5MB
- Local object URL preview via `URL.createObjectURL()`
- Revoke on unmount or new selection via `URL.revokeObjectURL()`
- No upload to Supabase Storage or any server in this phase
- Image is **required** for submit

### Badge Promotional
- Predefined dropdown from `BADGE_OPTIONS` in `src/lib/constants.ts`
- Options: Oferta, Promoção, Queima de Estoque, Novidade, Últimas Unidades
- Required field

### Price Formatting
- `src/lib/formatters.ts` with `formatCurrencyBRL` and `parseCurrencyBRL`
- Display: `R$ 49,90` (Brazilian format)
- Internal state: raw numeric value in cents
- Discounted price required, > 0; original price optional, > 0 if provided, must be > discounted

### Client-Side Validation
- Product name: required, max 60 chars, trimmed
- Description: optional, max 120 chars
- Discounted price: required, > 0
- Original price: optional, > 0 if provided, > discounted
- Badge: required, must be from `BADGE_OPTIONS`
- Image: required, PNG/JPG/WEBP, ≤ 5MB
- Validation on blur; blocking on submit

### Submit Behavior
- Local only — no API call, no database write, no localStorage mutation
- On valid: success banner above form, all data preserved and editable
- No campaign record created (deferred to later phase)

### Component Architecture
- `src/components/flow/use-campaign-form.ts` — hook: state, validation, image handling, currency formatting
- `src/components/flow/campaign-image-upload.tsx` — dropzone + preview + validation (`"use client"`)
- `src/components/flow/campaign-input-form.tsx` — form composition (`"use client"`)
- `src/components/flow/store-identity-block.tsx` — read-only store card (`"use client"`)
- All localStorage/file/objectURL components use `"use client"` directive

### Store Identity Route
- `/store/page.tsx` renders existing `StoreIdentityForm`
- Form is primary content; navigation CTA back to `/` is secondary content
- Existing `use-store-form.ts` hook works without modification

### Design System
- Follow `openspec/design-system/pages/campaign-input.md` and `openspec/design-system/MASTER.md`
- Dark theme (OLED): `#020617` bg, `#F8FAFC` text, `#22C55E` accent
- Tailwind CSS v3.4.19 + PostCSS + autoprefixer (already configured)
- lucide-react for icons (no emojis)
- Poppins (headings) + Open Sans (body)

### the agent's Discretion
- Exact form layout (label placement, field ordering)
- Error message exact text for edge cases not covered in spec
- Success banner styling (color, position above or below form)
- Loading skeleton design for store fetch
- Exact color of the blocking state CTA button
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Source of Truth
- `openspec/design-system/pages/campaign-input.md` — Visual and UX rules for the campaign form
- `openspec/design-system/MASTER.md` — Design tokens, colors, typography, spacing

### Existing Patterns
- `src/components/flow/store-identity-form.tsx` — Reference form component pattern
- `src/components/flow/use-store-form.ts` — Reference hook pattern (state + validation + API)
- `src/components/flow/store-preview.tsx` — Reference preview component
- `src/lib/constants.ts` — Constants pattern (VALID_SEGMENTS, BRAZILIAN_STATES)
- `src/lib/store.ts` — resolveStoreIdentity utility

### Spec & Design Docs
- `openspec/changes/phase-2-1-campaign-input-ui/design.md` — All technical design decisions
- `openspec/changes/phase-2-1-campaign-input-ui/specs/campaign-input-ui/spec.md` — Full spec with scenarios
- `openspec/changes/phase-2-1-campaign-input-ui/specs/store-identity-ui/spec.md` — Store Identity route delta spec
- `openspec/changes/phase-2-1-campaign-input-ui/tasks.md` — Task breakdown for implementation

### Route Structure
- `src/app/page.tsx` — Current landing (to be replaced with campaign form)
- `src/app/store/page.tsx` — New route for Store Identity form (to be created)
</canonical_refs>

<specifics>
## Specific Ideas

**Route split:** The existing StoreIdentityForm at `src/app/page.tsx` moves to `src/app/store/page.tsx` with minimal changes. The old page.tsx content is replaced by the campaign input flow.

**No step navigation yet:** There's no "back to store" or "next to preview" step flow. Navigation between `/store` and `/` is via standalone links/buttons, not a wizard. Step integration comes in a future phase.

**localStorage is the only persistence for store_id**: The campaign form reads `store_id` from localStorage. On 404, it clears the key and shows the blocking state — same pattern as the existing Store Identity form.
</specifics>

<deferred>
## Deferred Ideas

- **Image upload to Supabase Storage:** Deferred to later phase. This phase uses local object URLs only.
- **Campaign data persistence:** Deferred. Submit only shows local success state, no DB write.
- **Step navigation (wizard):** Deferred. Links only for now.
- **AI generation, rendering, export:** Deferred to Phases 3-5.
- **Image editing/modification:** No crop, filter, or zoom — bare preview only.
- **Multiple images:** Single image only for Phase 2.1.
</deferred>

---

*Phase: 02-campaign-input*
*Context gathered: 2026-05-25 via OpenSpec artifact synthesis*
