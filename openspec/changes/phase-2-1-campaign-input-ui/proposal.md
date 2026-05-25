## Why

The Store Identity UI (Phase 1.5) allows lojistas to register their store, but there is no interface to input product and offer data — the core input for campaign generation. Without a campaign input form, the product + offer information cannot be collected, making campaign creation impossible.

## What Changes

- Create campaign input form UI at `src/app/page.tsx` (`/`) as the main landing experience
- Move Store Identity form to a dedicated route at `src/app/store/page.tsx` (`/store`)
- Follow `openspec/design-system/pages/campaign-input.md` and `openspec/design-system/MASTER.md` as design source of truth
- Display a read-only Store Identity block (name, segment, brand color) reusing the store saved in Phase 1/1.5
- If no valid `store_id` exists in localStorage, show a blocking state with a CTA to register the store at `/store`
- Form fields: Nome do Produto (required, max 60 chars), Descrição Breve (optional, max 120 chars), Preço Original (optional), Preço com Desconto (required), Badge Promocional (predefined dropdown), Imagem do Produto (required upload/dropzone with local preview)
- Badge Promocional predefined options: Oferta, Promoção, Queima de Estoque, Novidade, Últimas Unidades
- Accepted image formats: PNG, JPG/JPEG, WEBP; max file size: 5MB; invalid files show inline error
- Image preview uses local object URL only — no upload to Supabase Storage
- Client-side validation: product name required, discounted price required, product image required, discounted price must be lower than original price when original price is provided, image format/size validation
- On submit, the form SHALL validate all fields and show a local success/ready state; no campaign record or API request SHALL be made
- Reuse existing pattern: hook for state/validation, separate components, design system tokens
- No campaign generation, AI calls, final rendering, export, database, migration, Supabase Storage, or new API routes

## Capabilities

### New Capabilities
- `campaign-input-ui`: Visual form interface for inputting product + offer data for campaign generation, with local image upload, client-side validation, read-only store identity display, and local submit state

### Modified Capabilities
- `store-identity-ui`: Store Identity form moves to `/store` route and adds navigation back to `/`

## Impact

- `src/app/page.tsx` — replaced with the campaign input form
- `src/app/store/page.tsx` — new route hosting the existing Store Identity form
- `src/components/flow/campaign-input-form.tsx` — new campaign form component
- `src/components/flow/campaign-image-upload.tsx` — new image upload/dropzone component
- `src/components/flow/use-campaign-form.ts` — new hook for campaign form state and validation
- `src/components/flow/store-identity-block.tsx` — new read-only store identity display component
- No new API routes, database tables, migrations, or dependencies
