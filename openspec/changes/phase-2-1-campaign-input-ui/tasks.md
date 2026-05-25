## 1. Constants and Utilities

- [x] 1.1 Add `BADGE_OPTIONS` array to `src/lib/constants.ts`: `["Oferta", "Promoção", "Queima de Estoque", "Novidade", "Últimas Unidades"]`
- [x] 1.2 Create `src/lib/formatters.ts` with `formatCurrencyBRL` and `parseCurrencyBRL` helpers for BRL currency mask

## 2. Store Identity Route Migration

- [x] 2.1 Create `src/app/store/page.tsx` rendering the existing `StoreIdentityForm`
- [x] 2.2 Add navigation link from `/store` back to `/` (campaign page)
- [x] 2.3 Verify existing `use-store-form.ts` hook works from `/store` route without modification

## 3. Store Identity Read-Only Block

- [x] 3.1 Create `src/components/flow/store-identity-block.tsx` as a client component (`"use client"`)
- [x] 3.2 Render store name, segment badge (human-readable), brand color swatch using `resolveStoreIdentity` fallback

## 4. Campaign Input Form Hook

- [x] 4.1 Create `src/components/flow/use-campaign-form.ts` with form state for all fields (product name, description, original price, discounted price, badge, image)
- [x] 4.2 Implement BRL currency mask integration using `formatCurrencyBRL`/`parseCurrencyBRL` from `src/lib/formatters.ts`
- [x] 4.3 Implement client-side validation: product name required (max 60), discounted price required (> 0), original optional (> 0 if provided, > discounted), badge required, image required (PNG/JPG/WEBP, ≤ 5MB)
- [x] 4.4 Implement image validation and object URL lifecycle in `use-campaign-form`: format filter, size check, `URL.createObjectURL`, `URL.revokeObjectURL`
- [x] 4.5 Implement submit handler: validate all fields, set success/ready state with banner, preserve all filled data on screen, no API call

## 5. Image Upload Component

- [x] 5.1 Create `src/components/flow/campaign-image-upload.tsx` as a client component (`"use client"`)
- [x] 5.2 Implement styled file input dropzone with preview area and inline error display using props/state from `use-campaign-form`

## 6. Campaign Input Form Component

- [x] 6.1 Create `src/components/flow/campaign-input-form.tsx` as a client component (`"use client"`)
- [x] 6.2 Compose `campaign-image-upload` and all form fields using `use-campaign-form` hook, following campaign-input.md design spec

## 7. Campaign Page (`/`)

- [x] 7.1 Replace `src/app/page.tsx` with a server page that renders a client wrapper component for campaign page flow
- [x] 7.1.1 Create `src/components/flow/campaign-page-client.tsx` as a client component responsible for localStorage, store fetch, loading, blocking, error and success composition
- [x] 7.2 Implement blocking state: if no `store_id`, show "Cadastre sua loja primeiro" with CTA to `/store`; if GET returns 404, remove `store_id` and show blocking state
- [x] 7.3 Implement error state: if store fetch fails (network/500), show error with retry button and CTA to `/store`
- [x] 7.4 Compose `StoreIdentityBlock` + `CampaignInputForm` on the page when store data loads successfully

## 8. Verification

- [x] 8.1 Run `npm run typecheck` — no TypeScript errors
- [x] 8.2 Run `npm run lint` — no lint errors
- [x] 8.3 Run `npm run build` — production build succeeds
- [x] 8.4 Manual check: `/` blocks without store, `/` renders form with valid store, `/store` renders identity form, image upload validates and previews, submit shows success banner, navigation links work both ways
