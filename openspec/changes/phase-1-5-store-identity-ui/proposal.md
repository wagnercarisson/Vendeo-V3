## Why

The Store Identity Foundation (Phase 1) established the data layer (schema, API, fallbacks), but lojistas have no visual interface to input their store data. Without a UI form, the foundation APIs remain unusable by end users. This phase bridges the gap between backend capability and user-facing functionality.

## What Changes

- Create store identity form UI as the initial page (`src/app/page.tsx`)
- Follow `openspec/design-system/MASTER.md` and `openspec/design-system/pages/store-identity.md` as design source of truth
- Form fields: Nome da Loja (required, 2–60 chars), Segmento (required dropdown using `VALID_SEGMENTS`), Cor da Marca (optional color picker for `brand_color`), Cidade (optional), Estado (optional)
- Consume existing `POST /api/store`, `GET /api/store/[id]`, `PATCH /api/store/[id]` endpoints
- Add client-side validation aligned with current API constraints
- Persist `store_id` in localStorage after creation (temporary MVP behavior until auth exists)
- Auto-load existing store data on page load if `store_id` is in localStorage
- Handle invalid/deleted `store_id` (GET returns 404): clear localStorage, show create mode with warning
- Normalize optional fields: empty string → `null` for `city`, `state`, `brand_color`
- Brand color rule: send `null` if user didn't interact with the picker; only send hex if user explicitly chose a color
- Display loading, saving, success, and error states
- Show a simple visual preview of the store identity (name, segment, brand color)
- Install and configure Tailwind CSS (needed for design system — not yet present in project)
- No logo upload, Supabase Storage, subsegment, schema changes, new API routes, auth, or dashboard

## Capabilities

### New Capabilities
- `store-identity-ui`: Visual form interface for creating and editing store identity, consuming the foundation APIs with localStorage-based persistence

### Modified Capabilities
*(none — store-identity-foundation spec remains unchanged; UI sits on top)*

## Impact

- `src/app/page.tsx` — replaced with the store identity form (composition only)
- `src/components/flow/store-identity-form.tsx` — form component
- `src/components/flow/store-preview.tsx` — visual preview card
- `src/components/flow/use-store-form.ts` — form state and API logic hook
- `src/lib/constants.ts` — already defines `VALID_SEGMENTS` and `Segment` type (no changes needed)
- `tailwind.config.*`, `postcss.config.*` — new Tailwind CSS configuration files
- `package.json` — add `tailwindcss`, `postcss`, `autoprefixer` dev dependencies
- No new API routes, database changes, or additional third-party dependencies
