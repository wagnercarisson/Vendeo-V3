## ADDED Requirements

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

The system SHALL render a store identity form as the landing page at `src/app/page.tsx`. The form SHALL be the primary and only content of the page.

The page SHALL be a composition of a form component (`src/components/flow/store-identity-form.tsx`), a preview component (`src/components/flow/store-preview.tsx`), and a custom hook (`src/components/flow/use-store-form.ts`) that manages state and API calls.

The page SHALL follow the visual and UX rules defined in `openspec/design-system/MASTER.md` and `openspec/design-system/pages/store-identity.md`.

#### Scenario: Landing page renders store identity form

- **WHEN** a user visits `/`
- **THEN** the page SHALL render the store identity form
- **AND** no other content SHALL appear on the page

#### Scenario: Form follows design system

- **WHEN** inspecting the page
- **THEN** all elements SHALL use colors, typography, and spacing tokens from MASTER.md
- **AND** the layout SHALL match the store-identity page override specification

### Requirement: Form fields

The system SHALL render the following form fields in the store identity form:

- **Nome da Loja**: required text input, 2–60 characters
- **Segmento**: required dropdown select using the `VALID_SEGMENTS` constant from `src/lib/constants.ts`
- **Cor da Marca**: optional color picker (`<input type="color">`) with companion hex text input
- **Cidade**: optional text input
- **Estado**: optional dropdown select using `BRAZILIAN_STATES` from `src/lib/constants.ts`

The segment dropdown options SHALL display human-readable labels (not kebab-case), but SHALL submit the kebab-case value.

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

The color picker SHALL NOT auto-assign a color value. If the user never interacts with the color picker, `brand_color` SHALL be sent as `null` in the API request. The preview SHALL use the segment-based fallback color in this case.

If the user explicitly selects or types a color, the chosen hex value SHALL be sent.

#### Scenario: Untouched color sends null

- **WHEN** the user saves the form
- **AND** the user never clicked or typed in the color picker
- **THEN** `brand_color` SHALL be `null` in the API request

#### Scenario: Chosen color sends hex

- **WHEN** the user saves the form
- **AND** the user selected a color via the picker or typed a hex value
- **THEN** `brand_color` SHALL be the chosen hex value in the API request

### Requirement: Simple visual preview

The system SHALL display a preview card showing the store identity: store name, segment badge, and brand color swatch.

The preview SHALL use `resolveStoreIdentity(store)` from `src/lib/store.ts` to determine the display color, reusing the existing segment-based fallback map — no duplicate color map SHALL be created in UI code.

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
