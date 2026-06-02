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

**Reason**: Logo upload, brand color with suggested swatches, and new store direction fields are needed for the brand profile foundation. Logo is optional — lojistas without logos are handled in a future phase.

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

### Requirement: Brand color untouched rule

The color picker SHALL NOT auto-assign a color value. If the user never interacts with the color picker, `brand_color` SHALL be sent as `null` in the API request. The preview SHALL use the segment-based fallback color or, if a brand profile exists with `brand_colors_chosen`, use the first chosen color.

If the user explicitly selects or types a color, the chosen hex value SHALL be sent. When a brand profile exists and the user chooses colors, those values SHALL be sent via the brand profile colors endpoint.

#### Scenario: Untouched color uses segment or profile fallback

- **WHEN** the user saves the form with no color interaction
- **AND** a brand profile exists with brand_colors_chosen
- **THEN** the preview SHALL use the first color from brand_colors_chosen
- **AND** the brand_color field in the store SHALL be null

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
