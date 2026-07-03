> **Propósito**: Esta spec define a interface visual para input de produto + oferta (Campaign Input UI), consumindo os dados de identidade da loja já cadastrados e preparando os dados para futura geração de campanha.

## Requirements

### Requirement: Campaign input form UI

The system SHALL render a campaign input form as the landing page at `src/app/page.tsx` (`/`). The form SHALL collect product and offer data for future campaign generation.

The page SHALL be a composition of:
- `src/components/flow/campaign-input-form.tsx` — main form component
- `src/components/flow/campaign-image-upload.tsx` — image upload dropzone with preview
- `src/components/flow/store-identity-block.tsx` — read-only store identity card
- `src/components/flow/use-campaign-form.ts` — custom hook for state and validation

The page SHALL follow the visual and UX rules in `openspec/design-system/MASTER.md` and `openspec/design-system/pages/campaign-input.md`.

Components that access localStorage, file input, object URLs, or client-side form state SHALL be client components using `"use client"`.

#### Scenario: Landing page renders campaign input form

- **WHEN** a user visits `/`
- **AND** a valid `store_id` exists in localStorage
- **THEN** the page SHALL render the campaign input form
- **AND** the form SHALL contain fields for product name, description, prices, badge, and image

#### Scenario: Client components use "use client"

- **WHEN** inspecting components that access localStorage, file input, object URLs, or form state
- **THEN** they SHALL include `"use client"` at the top of the file

### Requirement: Store identity read-only block

The system SHALL display a read-only store identity card on the campaign input page when a valid store exists. The card SHALL show:
- Store name
- Segment badge (human-readable label)
- Brand color swatch (using `resolveStoreIdentity` fallback if no `brand_color`)

The card SHALL be non-interactive — no form fields, no edit button, no save action.

#### Scenario: Read-only block shows store data

- **WHEN** the campaign page loads with a valid store
- **THEN** a read-only card SHALL display the store name, segment badge, and brand color swatch
- **AND** no form fields or edit controls SHALL appear in the card

#### Scenario: No brand color uses fallback

- **WHEN** `brand_color` is null
- **THEN** the color swatch SHALL use the segment-based fallback from `resolveStoreIdentity`

### Requirement: Store identity passed through form props

`CampaignPageClient` SHALL fetch store identity from `GET /api/store/{id}` (which now returns `{ ...store, identity }`). The page SHALL pass `storeId` (not `StoreIdentitySnapshot`) as a prop to `CampaignInputForm`. `CampaignInputForm` SHALL forward `storeId` to `useCampaignForm`. The hook SHALL use `storeId` only for the generation request body — identity data is resolved server-side.

The `StoreIdentityBlock` SHALL consume `identity` from the GET response directly, without calling `resolveStoreIdentity` as a separate server action.

#### Scenario: storeId passed instead of snapshot

- **WHEN** `CampaignPageClient` renders `CampaignInputForm`
- **THEN** a `storeId: string` SHALL be passed as a prop
- **AND** `StoreIdentitySnapshot` SHALL NOT be passed as a prop
- **AND** `StoreIdentityBlock` SHALL consume `identity` from the GET response

### Requirement: Blocking state for missing or invalid store_id

When no `store_id` exists in localStorage, the system SHALL render a centered blocking state with:
- Title: "Cadastre sua loja primeiro"
- Description explaining the user needs to register their store before creating campaigns
- Button/link to navigate to `/store`

When `store_id` exists but `GET /api/store/{id}` returns 404, the system SHALL remove `store_id` from localStorage and render the same blocking state with CTA to `/store`.

#### Scenario: No store_id shows blocking state

- **WHEN** a user visits `/`
- **AND** `localStorage.getItem("store_id")` is null
- **THEN** the page SHALL display "Cadastre sua loja primeiro" with a CTA to `/store`
- **AND** no form fields SHALL be rendered

#### Scenario: Invalid store_id resets and shows blocking state

- **WHEN** a user visits `/`
- **AND** `store_id` exists in localStorage
- **AND** `GET /api/store/{store_id}` returns 404
- **THEN** the system SHALL remove `store_id` from localStorage
- **AND** render the blocking state with CTA to `/store`

### Requirement: Campaign form fields

The system SHALL render the following form fields:

- **Nome do Produto**: required text input, max 60 characters
- **Descrição Breve**: optional text input, max 120 characters
- **Preço Original**: optional currency input with BRL mask (`R$` prefix, formatted as `R$ 49,90`)
- **Preço com Desconto**: required currency input with BRL mask
- **Badge Promocional**: required dropdown select using `BADGE_OPTIONS` from `src/lib/constants.ts`
- **Imagem do Produto**: required file upload dropzone, accepts PNG/JPG/WEBP only, max 5MB

#### Scenario: Required fields are rendered

- **WHEN** the form is displayed
- **THEN** Nome do Produto input SHALL be present and marked as required
- **AND** Preço com Desconto input SHALL be present and marked as required
- **AND** Badge Promocional dropdown SHALL be present and marked as required
- **AND** Imagem do Produto dropzone SHALL be present and marked as required

#### Scenario: Optional fields are rendered

- **WHEN** the form is displayed
- **THEN** Descrição Breve input SHALL be present
- **AND** Preço Original input SHALL be present
- **AND** they SHALL NOT be marked as required

#### Scenario: Badge options are predefined

- **WHEN** the Badge Promocional dropdown is opened
- **THEN** the options SHALL be: Oferta, Promoção, Queima de Estoque, Novidade, Últimas Unidades
- **AND** they SHALL come from `BADGE_OPTIONS` in `src/lib/constants.ts`

### Requirement: Product image upload with local preview

The system SHALL provide a file upload dropzone for product images using `<input type="file">`. On file selection:
1. Validate format: must be `image/png`, `image/jpeg`, or `image/webp`
2. Validate size: must be ≤ 5MB
3. If valid, create an object URL via `URL.createObjectURL()` and display a preview
4. If invalid, show inline error, clear the file input, and show no preview

Object URLs SHALL be revoked via `URL.revokeObjectURL()` when a new file is selected or when starting a new campaign. Object URLs SHALL NOT be revoked on navigation from campaign input to preview — they SHALL remain valid for the preview route. No upload to Supabase Storage or any server SHALL occur.

#### Scenario: Valid image shows preview

- **WHEN** the user selects a valid PNG/JPG/WEBP file ≤ 5MB
- **THEN** a preview of the image SHALL appear in the dropzone area
- **AND** no error message SHALL be displayed

#### Scenario: Invalid format shows error

- **WHEN** the user selects a file that is not PNG/JPG/WEBP (e.g., GIF, SVG)
- **THEN** an inline error SHALL appear: "Formato não suportado. Use PNG, JPG ou WEBP"
- **AND** no preview SHALL be displayed

#### Scenario: File too large shows error

- **WHEN** the user selects a file larger than 5MB
- **THEN** an inline error SHALL appear: "Arquivo muito grande. Máximo 5MB"
- **AND** no preview SHALL be displayed

#### Scenario: Object URL is revoked on new file or new campaign

- **WHEN** a new file is selected or the user starts a new campaign
- **THEN** `URL.revokeObjectURL()` SHALL be called for the previous object URL
- **AND** the object URL SHALL NOT be revoked on navigation from campaign input to preview

### Requirement: Store identity loading and error state

When `store_id` exists in localStorage, the page SHALL show a loading state while fetching `GET /api/store/{id}`.

If the request fails with a network error or HTTP 500, the page SHALL show a non-destructive error state with a retry action and a CTA to `/store`.

#### Scenario: Loading state during store fetch

- **WHEN** a user visits `/`
- **AND** `store_id` exists in localStorage
- **AND** the store data is being fetched
- **THEN** a loading indicator SHALL be displayed
- **AND** the form SHALL NOT be rendered until the fetch completes

#### Scenario: Store fetch error shows retry and fallback

- **WHEN** `GET /api/store/{store_id}` fails with network error or 500
- **THEN** an error message SHALL be displayed with a retry button
- **AND** a CTA to `/store` SHALL be available

### Requirement: Price input with Brazilian currency formatting

The system SHALL use `src/lib/formatters.ts` with `formatCurrencyBRL` and `parseCurrencyBRL` helpers for all currency fields.

The displayed value SHALL use BRL format: `R$ 49,90` (no thousands separator, comma as decimal, two decimal places).

The internal state SHALL store the raw numeric value in cents (integer) for precise validation.

#### Scenario: Currency input displays formatted value

- **WHEN** the user types "4990" in a price field
- **THEN** the displayed value SHALL be "R$ 49,90"
- **AND** the internal state SHALL store 4990 (cents)

#### Scenario: Price formats on blur and input

- **WHEN** the user types into a price field
- **THEN** the formatted BRL mask SHALL update as the user types
- **AND** non-numeric characters SHALL be stripped

### Requirement: Client-side validation

The system SHALL validate the following rules:

- **Nome do Produto**: required, max 60 characters, trimmed
- **Descrição Breve**: optional, max 120 characters
- **Preço Original**: optional, MUST be greater than zero if provided, MUST be greater than Preço com Desconto
- **Preço com Desconto**: required, MUST be greater than zero
- **Badge Promocional**: required, MUST be one of the `BADGE_OPTIONS`
- **Imagem do Produto**: required, MUST be PNG/JPG/WEBP and ≤ 5MB

Validation SHALL trigger on blur for each field. Blocking state SHALL prevent submit when any validation fails.

#### Scenario: Product name required on blur

- **WHEN** the user leaves Nome do Produto empty and blurs
- **THEN** an inline error SHALL appear: "Nome do produto é obrigatório"

#### Scenario: Product name exceeds max length

- **WHEN** the user types 61+ characters and blurs
- **THEN** an inline error SHALL appear: "Máximo de 60 caracteres"

#### Scenario: Discounted price must be greater than zero

- **WHEN** the user enters 0 in Preço com Desconto and blurs
- **THEN** an inline error SHALL appear: "Preço deve ser maior que zero"

#### Scenario: Discounted price must be less than original

- **WHEN** the user enters Preço Original = 10000 (R$ 100,00) and Preço com Desconto = 15000 (R$ 150,00)
- **THEN** an inline error SHALL appear: "Preço com desconto deve ser menor que o preço original"

#### Scenario: Discounted price alone is valid

- **WHEN** the user enters only Preço com Desconto (R$ 49,90) and leaves Preço Original empty
- **THEN** no price comparison error SHALL appear
- **AND** the form SHALL be valid

#### Scenario: Product image is required on submit

- **WHEN** the user clicks "Criar Campanha" without selecting an image
- **THEN** an inline error SHALL appear: "Imagem do produto é obrigatória"
- **AND** no success banner SHALL appear

### Requirement: Submit triggers API generation

The submit behavior SHALL be updated. Instead of including identity fields in the request body, the system SHALL:

1. Validate all required fields
2. Create or reuse the product image object URL from the selected image file
3. Call `POST /api/campaign/generate-image` with form data including `storeId` — no identity fields
4. On success: compose a `PreviewPayload` and store in sessionStorage
5. Navigate to `/campaign/preview`
6. On error: display error state with retry option

#### Scenario: Valid submit sends storeId in body

- **WHEN** all required fields are valid and the user clicks "Criar Campanha"
- **THEN** the system SHALL call `POST /api/campaign/generate-image` with `storeId` in the body
- **AND** the body SHALL NOT include `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl`, or `brandProfile`
- **AND** on success, store the preview payload in sessionStorage
- **AND** navigate to `/campaign/preview`

#### Scenario: API error shows error state

- **WHEN** the API returns an error response
- **THEN** the form SHALL display an error message
- **AND** the user SHALL be able to retry

### Requirement: Submit loading state during API call

While the API call is in progress, the submit button SHALL show a loading state with a spinner. The submit button and all form fields SHALL be disabled during generation.

#### Scenario: Loading state during generation

- **WHEN** the user clicks "Criar Campanha"
- **AND** the API call is in progress
- **THEN** the submit button SHALL show a spinner
- **AND** the button and all form fields SHALL be disabled
- **AND** the submitted payload SHALL be frozen from the form state at submit time — edits during in-flight generation SHALL NOT affect the preview payload

### Requirement: Preview payload cleared when navigating back

When the user navigates back to the campaign input route from the preview, the preview payload SHALL be cleared from sessionStorage.

#### Scenario: Back navigation clears payload

- **WHEN** the user navigates from `/campaign/preview` back to the campaign input route
- **THEN** the preview payload SHALL be removed from sessionStorage
