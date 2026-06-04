## MODIFIED Requirements

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

The segment dropdown options SHALL display human-readable labels (not kebab-case), but SHALL submit the kebab-case value.

Additionally, the Logo area SHALL include:
- An explicit **Enviar logotipo** button below the drag-and-drop area (same functionality, just an explicit call to action)
- A **Não tenho logo** button (outline style, with Sparkles icon) that opens the visual signature generation and approval flow
- A **Continuar sem logo** discrete link (text-text-muted, no border, no background) below the buttons, with tooltip explaining the Vendeo will use only the store name with chosen colors

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

## ADDED Requirements

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
