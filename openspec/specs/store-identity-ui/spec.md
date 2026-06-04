> **Propósito**: Esta spec define a interface visual para cadastro e edição da identidade básica da loja (Store Identity UI), consumindo as APIs da foundation e utilizando Tailwind CSS + design system MASTER.md.

## Requirements

### Requirement: Tailwind CSS setup

The system SHALL have Tailwind CSS configured as the styling framework. The setup SHALL include `tailwindcss`, `postcss`, and `autoprefixer` as dev dependencies, a `tailwind.config.ts` file, a `postcss.config.mjs` file, and a `src/app/globals.css` file with Tailwind directives and design system CSS custom properties from MASTER.md.

#### Scenario: Tailwind dependencies are installed

- **WHEN** `package.json` is inspected
- **THEN** `tailwindcss`, `postcss`, and `autoprefixer` SHALL be listed in `devDependencies`

#### Scenario: Tailwind config exists

- **WHEN** the project is inspected
- **THEN** a `tailwind.config.ts` file SHALL exist at the project root
- **AND** it SHALL define paths to `src/**/*.{ts,tsx}` for content scanning

#### Scenario: Globals CSS has Tailwind directives

- **WHEN** `src/app/globals.css` is inspected
- **THEN** it SHALL contain `@tailwind base`, `@tailwind components`, and `@tailwind utilities` directives
- **AND** it SHALL define custom CSS properties for `--bg-deep`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-green`, `--accent-blue`, `--accent-amber`, `--accent-red` matching the MASTER.md color palette

### Requirement: Store identity form UI

The system SHALL render a store identity form at `src/app/store/page.tsx` (`/store`). The form SHALL be the primary content of the page. A secondary navigation link/button to return to `/` MAY be displayed.

The page SHALL be a composition of a form component (`src/components/flow/store-identity-form.tsx`), a preview component (`src/components/flow/store-preview.tsx`), and a custom hook (`src/components/flow/use-store-form.ts`) that manages state and API calls.

The page SHALL follow the visual and UX rules defined in `openspec/design-system/MASTER.md` and `openspec/design-system/pages/store-identity.md`.

#### Scenario: Store page renders store identity form

- **WHEN** a user visits `/store`
- **THEN** the page SHALL render the store identity form
- **AND** no unrelated content SHALL appear on the page

#### Scenario: Form follows design system

- **WHEN** inspecting the page
- **THEN** all elements SHALL use colors, typography, and spacing tokens from MASTER.md
- **AND** the layout SHALL match the store-identity page override specification

### Requirement: Navigation between `/` and `/store`

The `/store` page SHALL include a link/button to return to `/` (campaign input page). The `/` page blocking state SHALL include a link/button to navigate to `/store`.

#### Scenario: Store page has link to campaign page

- **WHEN** a user is on `/store`
- **THEN** a link or button SHALL be present to navigate to `/`

#### Scenario: Blocking state has link to store page

- **WHEN** a user is on `/` without a valid `store_id`
- **THEN** a link or button SHALL be present to navigate to `/store`

### Requirement: Form fields

The system SHALL render the following form fields in the store identity form:

- **Nome da Loja**: required text input, 2–60 characters
- **Segmento**: required dropdown select using the `VALID_SEGMENTS` constant from `src/lib/constants.ts`
- **Logo da Loja**: optional upload area with drag-and-drop or click-to-upload. Preview circular after upload. Shows simple processing status ("Enviando...", "Processando...", "Pronto"). Technical variants are NOT exposed.
- **Cor da Marca**: optional color picker (`<input type="color">`) with companion hex text input. When a brand profile exists with detected colors, show suggested swatches below the picker. No conflict modal if chosen color differs from detected color.
- **Cidade**: optional text input
- **Estado**: optional dropdown select using `BRAZILIAN_STATES` from `src/lib/constants.ts`
- → **Subsegmento**: optional text input
- → **Tom de Voz**: optional dropdown/select
- → **Posicionamento**: optional text input
- → **Descrição Curta**: optional textarea
- → **Slogan**: optional text input

Additionally, the Logo area SHALL include:
- An explicit **Enviar logotipo** button below the drag-and-drop area (same functionality, just an explicit call to action)
- A **Não tenho logo** button (outline style, with Sparkles icon) that opens the visual signature generation and approval flow
- A **Continuar sem logo** discrete link (text-text-muted, no border, no background) below the buttons, with tooltip explaining the Vendeo will use only the store name with chosen colors

The segment dropdown options SHALL display human-readable labels (not kebab-case), but SHALL submit the kebab-case value.

#### Scenario: Logo upload area visible

- **WHEN** the form is displayed
- **THEN** an upload area for logo SHALL be present with drag-and-drop or click support
- **AND** it SHALL display accepted formats and size limit

#### Scenario: Logo preview after upload

- **WHEN** a logo is successfully uploaded
- **THEN** a circular preview of the logo SHALL be displayed
- **AND** no technical variant details SHALL be shown

#### Scenario: Suggested colors from brand profile

- **WHEN** a brand profile exists with logo_colors_detected
- **THEN** color swatches from logo_colors_detected SHALL be shown below the color picker

#### Scenario: No conflict modal on color divergence

- **WHEN** the lojista chooses a color different from the detected logo colors
- **THEN** no modal, alert, or warning SHALL be displayed
- **AND** the chosen color SHALL be saved as-is

#### Scenario: New fields rendered

- **WHEN** the form is displayed
- **THEN** Subsegmento, Tom de Voz, Posicionamento, Descrição Curta, and Slogan fields SHALL be present
- **AND** they SHALL be optional

#### Scenario: Required fields are rendered

- **WHEN** the form is displayed
- **THEN** the Nome da Loja input SHALL be present
- **AND** the Segmento dropdown SHALL be present with all 10 segment options from `VALID_SEGMENTS`

#### Scenario: Optional fields are rendered

- **WHEN** the form is displayed
- **THEN** Cor da Marca, Cidade, and Estado SHALL be present
- **AND** they SHALL NOT be marked as required

#### Scenario: Segment options display readable labels

- **WHEN** the segment dropdown is opened
- **THEN** each option SHALL display a human-readable label (e.g., "Moda e Vestuário" instead of `moda-vestuario`)
- **AND** the submitted value SHALL be the kebab-case slug

#### Scenario: Estado uses BRAZILIAN_STATES

- **WHEN** the Estado dropdown is opened
- **THEN** it SHALL list all 27 Brazilian states (AC–TO) with their full names
- **AND** the options SHALL come from `BRAZILIAN_STATES` in `src/lib/constants.ts`

#### Scenario: Explicit upload button present

- **WHEN** the form is displayed
- **THEN** an upload area for logo SHALL be present with drag-and-drop or click support
- **AND** an explicit "Enviar logotipo" button SHALL be displayed below the upload area

#### Scenario: "Não tenho logo" button present with tooltip

- **WHEN** the form is displayed
- **THEN** a "Não tenho logo" button SHALL be displayed
- **AND** it SHALL have a tooltip or alert explaining that Vendeo will generate a visual signature and brand profile

#### Scenario: "Continuar sem logo" link present

- **WHEN** the form is displayed
- **THEN** a discreet "Continuar sem logo" link SHALL be displayed
- **AND** it SHALL have minimal visual prominence (text-text-muted, no border)
- **AND** it SHALL have a tooltip explaining the store will use only the name with chosen colors

### Requirement: Create store (first save)

When no `store_id` exists in localStorage, the system SHALL send a `POST /api/store` request with the form data on save.

After a successful creation, the system SHALL persist the returned `store.id` in localStorage under the key `store_id`.

#### Scenario: POST request on first save

- **WHEN** the user fills the form and clicks "Salvar"
- **AND** no `store_id` exists in localStorage
- **THEN** the system SHALL send a POST request to `/api/store` with the form data

#### Scenario: store_id persisted after creation

- **WHEN** the POST request succeeds with HTTP 201
- **THEN** the returned `store.id` SHALL be saved to localStorage as `store_id`
- **AND** the form SHALL switch to edit mode

### Requirement: Edit store (subsequent saves)

When a `store_id` exists in localStorage, the system SHALL send a `PATCH /api/store/[id]` request on save.

#### Scenario: PATCH request on subsequent saves

- **WHEN** the user modifies the form and clicks "Salvar"
- **AND** a `store_id` exists in localStorage
- **THEN** the system SHALL send a PATCH request to `/api/store/{store_id}` with only the changed fields

#### Scenario: Only provided fields are updated

- **WHEN** the PATCH request is sent
- **THEN** only the fields present in the request body SHALL be updated
- **AND** omitted fields SHALL retain their current values in the database

### Requirement: Auto-load existing store

On page load, if a `store_id` exists in localStorage, the system SHALL fetch the store data via `GET /api/store/[id]` and pre-fill the form.

If the GET request returns HTTP 404 (store not found or deleted), the system SHALL remove `store_id` from localStorage, set the form to create mode, and display a dismissible warning banner: "Loja não encontrada. Cadastre novamente."

#### Scenario: Existing store loads on page load

- **WHEN** the page loads
- **AND** `store_id` exists in localStorage
- **THEN** the system SHALL fetch `GET /api/store/{store_id}`
- **AND** on success, pre-fill all form fields with the returned data
- **AND** switch to edit mode

#### Scenario: Invalid store_id triggers reset

- **WHEN** the page loads
- **AND** `store_id` exists in localStorage
- **AND** GET /api/store/{store_id} returns 404
- **THEN** the system SHALL remove `store_id` from localStorage
- **AND** set the form to create mode
- **AND** display a dismissible warning banner: "Loja não encontrada. Cadastre novamente."

### Requirement: Optional field normalization

The system SHALL normalize empty string values to `null` for optional fields before sending API requests. This applies to `city`, `state`, and `brand_color`.

#### Scenario: Empty city is sent as null

- **WHEN** the user saves the form with `city` left empty
- **THEN** the API request SHALL include `"city": null`

#### Scenario: Empty state is sent as null

- **WHEN** the user saves the form with `state` left empty
- **THEN** the API request SHALL include `"state": null`

### Requirement: Brand color untouched rule

The color picker SHALL NOT auto-assign a color value. If the user never interacts with the color picker, `brand_color` SHALL be sent as `null` in the API request. The preview SHALL use the segment-based fallback color or, if a brand profile exists with `brand_colors_chosen`, use the first chosen color.

If the user explicitly selects or types a color, the chosen hex value SHALL be sent. When a brand profile exists and the user chooses colors, those values SHALL be sent via the brand profile colors endpoint.

#### Scenario: Untouched color uses segment or profile fallback

- **WHEN** the user saves the form with no color interaction
- **AND** a brand profile exists with brand_colors_chosen
- **THEN** the preview SHALL use the first color from brand_colors_chosen
- **AND** the brand_color field in the store SHALL be null

#### Scenario: Untouched color sends null

- **WHEN** the user saves the form
- **AND** the user never clicked or typed in the color picker
- **AND** no brand profile exists
- **THEN** `brand_color` SHALL be `null` in the API request

#### Scenario: Chosen color sends hex

- **WHEN** the user saves the form
- **AND** the user selected a color via the picker or typed a hex value
- **THEN** `brand_color` SHALL be the chosen hex value in the API request

### Requirement: Simple visual preview

The system SHALL display a preview card showing the store identity: store name, segment badge, and brand color swatch (or logo preview if uploaded).

The preview SHALL use `resolveStoreIdentity(store)` to determine the display color. When a logo is uploaded, the preview SHALL show the logo preview instead of the color swatch.

#### Scenario: Preview shows logo when uploaded

- **WHEN** a logo has been uploaded and processed
- **THEN** the preview SHALL display the logo image
- **AND** the logo SHALL be shown in a circular crop

#### Scenario: Preview shows brand color from profile

- **WHEN** no logo is uploaded but a brand profile exists with brand_colors_chosen
- **THEN** the preview SHALL use the first chosen color as the display swatch

#### Scenario: Preview shows store name and segment

- **WHEN** the form has a name and segment filled
- **THEN** the preview SHALL display the store name as text
- **AND** a badge SHALL show the segment name in human-readable format

#### Scenario: Preview uses fallback color when no brand color

- **WHEN** `brand_color` is null
- **THEN** the preview SHALL use the segment-based fallback color from `resolveStoreIdentity`
- **AND** the fallback SHALL match the FOUNDATION color map (e.g., `moda-vestuario` → `#F43F5E`)

#### Scenario: Preview shows chosen brand color

- **WHEN** `brand_color` is set to a hex value
- **THEN** the preview SHALL display a color swatch with that exact hex value

### Requirement: Loading, saving, success, and error states

The system SHALL display the following states:

- **Loading**: Skeleton/spinner while fetching existing store data on page load
- **Saving**: Spinner + "Salvando..." text on the submit button, button disabled while request is in flight
- **Success**: Brief success feedback after save completes
- **Error**: Dismissible banner at the top of the form for API/network errors; inline error messages below fields for validation errors

#### Scenario: Loading state during fetch

- **WHEN** the page is loading an existing store
- **THEN** a loading indicator SHALL be displayed
- **AND** the form SHALL be disabled during loading

#### Scenario: Saving state during submit

- **WHEN** the save request is in flight
- **THEN** the submit button SHALL show a spinner and "Salvando..." text
- **AND** the button SHALL be disabled

#### Scenario: Validation errors shown inline

- **WHEN** the user blurs a field with invalid data
- **THEN** an error message SHALL appear below the field in red text
- **AND** the error SHALL follow MASTER.md form validation patterns

#### Scenario: API errors shown as banner

- **WHEN** an API request fails (network error or HTTP 500)
- **THEN** a dismissible error banner SHALL appear at the top of the form
- **AND** the banner SHALL contain the error description

### Requirement: Client-side validation

The system SHALL validate the following rules before submitting:

- **Nome da Loja**: required, must be 2–60 characters, trimmed
- **Segmento**: required, must be one of the `VALID_SEGMENTS` values
- **Cor da Marca**: if provided, must be a valid 6-character hex color (`#RRGGBB`)

Validation SHALL trigger on blur (focus loss) for each field.

#### Scenario: Name validation on blur

- **WHEN** the user types a single character in Nome da Loja and blurs
- **THEN** an inline error SHALL appear: "Nome deve ter entre 2 e 60 caracteres"

#### Scenario: Name valid on blur

- **WHEN** the user types "Minha Loja" in Nome da Loja and blurs
- **THEN** no error SHALL appear

#### Scenario: Invalid hex color shows error

- **WHEN** the user types "abc" in the color field and blurs
- **THEN** an inline error SHALL appear: "Cor inválida. Use formato #RRGGBB"

### Requirement: localStorage as temporary persistence

The system SHALL use `localStorage` with key `store_id` to persist the current store identifier across page reloads. This is a temporary MVP mechanism — no auth, encryption, or multi-device sync.

#### Scenario: store_id persists in localStorage

- **WHEN** a store is created successfully
- **THEN** `localStorage.getItem("store_id")` SHALL return the new store's UUID

#### Scenario: store_id cleared on 404

- **WHEN** GET /api/store/{store_id} returns 404
- **THEN** `localStorage.removeItem("store_id")` SHALL be called

### Requirement: Visual signature modal after store save

When a store is saved with no logo and no active visual signature, the system SHALL present a modal offering the lojista the option to create one. The modal SHALL NOT have a close button — the lojista must choose one of 4 options.

The modal SHALL contain 4 option cards:

1. **Gerar 3 opções para eu escolher** — generates 3 variations via AI image (Abordagem B), user picks one
2. **Deixar o Vendeo escolher por mim** — generates 1 automatic via AI image with fallback cascade
3. **Tenho logotipo, mas vou enviar depois** — same as option 2 (automatic generation), signature can be replaced by logo later
4. **Tenho logotipo e quero enviar agora** — redirects to logo upload flow (existing)

#### Scenario: Modal appears after save without logo

- **WHEN** the store identity form is saved
- **AND** the store has no logo and no active visual signature
- **THEN** a modal SHALL appear with 4 visual signature creation options
- **AND** the modal SHALL NOT be dismissible (no close button)

#### Scenario: Modal does not appear when logo exists

- **WHEN** the store identity form is saved
- **AND** the store has a logo
- **THEN** no visual signature modal SHALL appear

### Requirement: Visual signature picker component

The system SHALL provide a `VisualSignaturePicker` component that displays generated variations and allows the lojista to select one.

#### Scenario: Picker shows 3 variations

- **WHEN** the lojista clicks "Criar Agora"
- **THEN** 3 visual signature variations SHALL be displayed as selectable cards
- **AND** the lojista SHALL be able to click one to select it
- **AND** a confirmation button SHALL be present to persist the chosen signature

### Requirement: Manage signature from store page

The store identity page SHALL include a section to manage the store's visual signature. When an active signature exists, it SHALL be displayed with an option to replace it.

#### Scenario: Replace signature with confirmation

- **WHEN** the lojista clicks "Criar / Alterar Assinatura Visual" on the store page
- **AND** an active signature exists
- **THEN** the modal SHALL open with options to generate new variations
- **AND** when a different variation is chosen, a confirmation dialog SHALL appear
- **AND** the signature SHALL only be replaced after explicit confirmation

### Requirement: "Continuar sem logo" behavior

When the lojista clicks the "Continuar sem logo" link:

1. `stores.logo_status` SHALL be set to `explicit_none`
2. No visual signature SHALL be created
3. No brand profile SHALL be automatically generated
4. The store preview SHALL use only the store name with the chosen colors (no signature, no logo)
5. The "Criar Assinatura Visual" option SHALL still be available on the visual signature section for the lojista to create one later if they change their mind

#### Scenario: Clicking "Continuar sem logo" sets explicit_none

- **WHEN** the lojista clicks "Continuar sem logo"
- **THEN** `logo_status` SHALL be set to `explicit_none`
- **AND** `visual_signature_attempts` SHALL remain 0
- **AND** no visual signature asset SHALL be created
- **AND** no brand profile SHALL be generated
- **AND** the preview SHALL display the store name with chosen colors

#### Scenario: Lojista can still create signature later after explicit_none

- **WHEN** `logo_status` is `explicit_none`
- **THEN** the visual signature section SHALL still show an option to create a signature
- **AND** clicking it SHALL start the normal generation flow

### Requirement: Preview shows visual signature after approval

When a visual signature has been approved (logo_status = generated), the store preview SHALL display the approved visual signature image instead of the color circle or initials.

#### Scenario: Preview shows approved signature

- **WHEN** `logo_status` is `generated`
- **AND** an active visual signature exists
- **THEN** the preview SHALL display the visual signature image in a rounded container
- **AND** the fallback color circle SHALL NOT be shown

### Requirement: Colors pre-filled after approval

When returning to Logo e Cores after visual signature approval, the primary and accent color inputs SHALL be pre-filled with the inferred colors from the brand profile (or identity art director's suggested colors if no profile yet). The lojista SHALL be able to edit them manually.

#### Scenario: Colors pre-filled from brand profile

- **WHEN** the user returns to Logo e Cores after approval
- **AND** a brand profile exists with `inferred_primary_color` and `inferred_accent_color`
- **THEN** the primary color input SHALL show the inferred primary color
- **AND** the accent color input SHALL show the inferred accent color

#### Scenario: Lojista can override inferred colors

- **WHEN** colors are pre-filled from brand profile
- **THEN** the lojista SHALL be able to change them manually
- **AND** no conflict warning SHALL be shown

### Requirement: Visual signature section behavior

The store visual signature section (`StoreVisualSignatureSection`) SHALL reflect the logo_status:

- `null`: Offer upload, "Não tenho logo", "Continuar sem logo"
- `generated`: Show approved signature in preview, show "Criar / Alterar Assinatura Visual" option
- `explicit_none`: Show "Nenhuma assinatura visual" with option to create one later
- `failed`: Show error with option to retry
- `exhausted`: Show "Limite de 3 versões atingido" with option to re-evaluate generated signatures or continue without logo

#### Scenario: Section shows different states per logo_status

- **WHEN** `logo_status` is `null`
- **THEN** the section SHALL offer upload and creation options
- **WHEN** `logo_status` is `generated`
- **THEN** the section SHALL display the approved signature
- **WHEN** `logo_status` is `exhausted`
- **THEN** the section SHALL show the limit message with re-evaluation option
- **WHEN** `logo_status` is `explicit_none` and `visual_signature_attempts = 3`
- **THEN** the section SHALL show "Continuou sem logo após 3 tentativas" with option to re-evaluate archived signatures
