## Context

The Store Identity UI (Phase 1.5) lives at `src/app/page.tsx` (`/`). With Phase 2.1, the campaign input form becomes the main landing experience. The Store Identity form needs to move to a dedicated route at `/store`.

The campaign input form (`openspec/design-system/pages/campaign-input.md`) collects product + offer data that will later feed AI generation and programmatic rendering. In this phase, no campaign API calls or database writes happen. The page may reuse the existing Store API only to load the saved Store Identity.

Tailwind CSS, lucide-react, and the design system tokens are already set up from Phase 1.5.

Components that access localStorage, file input, object URLs, or client-side form state SHALL be client components using `"use client"` — required by Next.js App Router.

## Goals / Non-Goals

**Goals:**
- Campaign input form at `/` with product name, description, prices, badge, and image
- Store Identity form moved to `/store`
- Read-only Store Identity block on the campaign page (name, segment, brand color)
- Blocking state when no `store_id` exists — CTA to `/store`
- Local image upload with preview only (object URL, validated client-side)
- Client-side validation: product name required, discounted price required and > 0, original price optional but > 0 if provided, discounted < original when both present, image format/size limits, badge required
- Submit shows success/ready state locally — no API call
- Follow existing component pattern: hook + form + preview

**Non-Goals:**
- Campaign generation, AI calls, rendering, export
- Database writes, migrations, API routes
- Supabase Storage
- Image persistence beyond the session
- Step navigation between store identity and campaign input
- Auth, dashboard, multitenancy

## Decisions

### Decision 1: Route split — `/` for campaign, `/store` for store identity
- **Choice**: Move the existing StoreIdentityForm to `src/app/store/page.tsx` and replace `src/app/page.tsx` with the campaign input form
- **Rationale**: The proposal defines `/` as the campaign landing. `/store` keeps the store identity form accessible for editing. No complex routing library needed — Next.js App Router handles this natively.
- **Alternatives considered**: Keeping both on `/` with a conditional render — would bloat `page.tsx` and prevent clean step navigation later.

### Decision 2: Blocking state for missing or invalid store_id
- **Choice**: On mount, check `localStorage.getItem("store_id")`. If null, render a centered empty state with "Cadastre sua loja primeiro" message and a link/button to `/store`. If valid, fetch store data via `GET /api/store/{id}`. If GET returns 404, remove `store_id` from localStorage and render the blocking state with CTA to `/store`.
- **Rationale**: Consistent with the 404 handling already defined in the Store Identity UI hook. Prevents the campaign form from loading with stale or deleted store references.
- **Alternatives considered**: Letting the user fill the form anyway — would leave campaign data orphaned without a store reference.

### Decision 3: Store identity read-only block
- **Choice**: Create `StoreIdentityBlock` component that receives store data as props and renders a compact card (name, segment badge, brand color swatch) using `resolveStoreIdentity` for color fallback.
- **Rationale**: Read-only means no form logic, no save button, no state. Simplest component in the set. Reuses existing foundation utilities.
- **Alternatives considered**: Embedding the full `StorePreview` component — works but `StorePreview` was designed for the form flow. A dedicated read-only block is cleaner.

### Decision 4: Image upload with local preview only
- **Choice**: Use an `<input type="file">` styled as a dropzone. On file selection, validate format and size, then create an object URL via `URL.createObjectURL()` for preview. No upload to any server.
- **Rationale**: Image upload to Supabase Storage is deferred. Local preview via object URL is zero-dependency, instant, and matches the spec requirement.
- **Alternatives considered**: Drag-and-drop library — adds dependency for marginal UX gain. Base64 encoding — unnecessary for preview-only.

### Decision 5: Image validation
- **Choice**: On file select, check:
  - Format: `["image/png", "image/jpeg", "image/webp"]`
  - Size: `<= 5 * 1024 * 1024` (5MB)
  - Invalid → inline error, clear file input, no preview
- **Rationale**: Matches campaign-input.md rules. Prevents the user from uploading unsupported files before AI generation lands.

### Decision 6: Badge as predefined dropdown
- **Choice**: Hardcode `BADGE_OPTIONS` array in `src/lib/constants.ts`: `["Oferta", "Promoção", "Queima de Estoque", "Novidade", "Últimas Unidades"]`
- **Rationale**: Consistent with `VALID_SEGMENTS` and `BRAZILIAN_STATES`. Keeps constants centralized. No custom badge input for now (Phase 2.1 is visual only).

### Decision 7: Price with Brazilian currency mask
- **Choice**: Create `src/lib/formatters.ts` with `formatCurrencyBRL` and `parseCurrencyBRL` helpers. The form displays `R$ 49,90`, while the hook stores the raw numeric value in cents for precise validation.
- **Rationale**: Separates formatting logic from the hook. Easy to reuse in other phases (preview, review). Numeric-in-cents state makes `original > discounted` comparison exact.
- **Alternatives considered**: Inline in the hook — would work but creates duplication when other pages need the same mask.

### Decision 8: Submit with local state only, preserving filled data
- **Choice**: Submit button validates all fields. If valid, show a success/ready banner above or below the form while preserving all filled data on screen. No fetch, no API call, no database write. The user can still see and edit their inputs.
- **Rationale**: Since there is no persistence yet, replacing the form would lose context. Keeping the data visible allows the user to review or adjust. A later phase will persist and send campaign data to AI.

### Decision 9: Component decomposition
- **Choice**: Split into 4 files:
  - `src/components/flow/store-identity-block.tsx` — read-only identity card
  - `src/components/flow/campaign-image-upload.tsx` — dropzone + preview + validation
  - `src/components/flow/use-campaign-form.ts` — hook with state, validation, image handling
  - `src/components/flow/campaign-input-form.tsx` — form composition using hook + subcomponents
- **Rationale**: Same pattern as Phase 1.5. Each file has a single responsibility. Easy to extend when API integration lands.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Object URLs leak memory if not revoked | Call `URL.revokeObjectURL()` when component unmounts or new image is selected |
| No image persistence — user loses image on page reload | Documented as Phase 2.1 scope. Image upload to storage comes in a later phase |
| Moving StoreIdentityForm to `/store` may break existing localStorage references | The hook reads `store_id` from localStorage regardless of route — works without changes |
| Price mask may have edge cases (paste, backspace) | Accept raw number input, format on display. Validate discounted > 0 and original > 0 when provided. Standard controlled-input pattern |
| Step navigation missing between `/store` and `/` | Addressed in a future integration phase. For now, `/store` has a CTA to return to `/` and vice versa |
