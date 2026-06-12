> **Purpose**: Delta spec for store-identity-ui — updates the Step 2 (Logo e Cores) behavior to support `identity_state = 'text_only'`, including inference trigger, updated color picker behavior, expanded preview, and modified link/button visibility.

## MODIFIED Requirements

### Requirement: "Continuar sem logo" behavior

The system SHALL replace the previous "Continuar sem logo" behavior (no profile generation, only set `logo_status`). When the lojista clicks the "Continuar sem logo" link:

1. `stores.logo_status` SHALL be set to `explicit_none` (dual-population)
2. `stores.identity_state` SHALL be set to `text_only`
3. `stores.text_only_origin` SHALL be set to `explicit`
4. The system SHALL trigger the brand inference pipeline (`POST /api/store/[id]/brand-profile/infer`)
5. A spinner SHALL be displayed with the message: "Aguarde enquanto o Vendeo gera uma direção visual para sua loja..."
6. On success: color pickers SHALL be pre-filled with inferred colors, preview SHALL update
7. On failure: a warning message SHALL appear but the state remains `text_only`

#### Scenario: Clicking "Continuar sem logo" triggers inference

- **WHEN** the lojista clicks "Continuar sem logo"
- **THEN** `identity_state` SHALL be set to `text_only`
- **AND** `logo_status` SHALL be set to `explicit_none`
- **AND** `text_only_origin` SHALL be set to `explicit`
- **AND** the brand inference pipeline SHALL be triggered
- **AND** a spinner with descriptive message SHALL be displayed during inference

#### Scenario: Successful inference updates UI

- **WHEN** the brand inference completes successfully
- **THEN** the color pickers SHALL be pre-filled with inferred colors
- **AND** the preview SHALL reflect the inferred visual direction
- **AND** a chip "✓ Direção visual definida pelo Vendeo" SHALL be displayed

#### Scenario: Failed inference shows warning

- **WHEN** the brand inference fails
- **THEN** the UI SHALL display a warning: "Não foi possível gerar a direção visual agora. Tente novamente."
- **AND** a "Gerar direção visual agora" button SHALL be available for retry
- **AND** the store SHALL remain in `text_only` state

### Requirement: Form fields — Logo area behavior in text_only

The system SHALL render the Logo area differently based on `identity_state` and profile status:

- **`identity_state = 'text_only'` with synced profile**: Drop zone present, "Enviar logotipo" button present, "Não tenho logo" button present. Link "Continuar sem logo" REMOVED. Chip "✓ Direção visual definida pelo Vendeo" displayed below buttons.
- **`identity_state = 'text_only'` with failed profile**: Drop zone present, buttons present. Link "Continuar sem logo" REMOVED. Message "Não foi possível gerar a direção visual" with "Gerar direção visual agora" button.
- **`identity_state = null` / not yet set**: Existing behavior unchanged — all buttons and "Continuar sem logo" link present.

#### Scenario: Text only with synced profile hides "Continuar sem logo"

- **WHEN** `identity_state` is `'text_only'`
- **AND** a synced brand profile exists
- **THEN** the "Continuar sem logo" link SHALL NOT be displayed
- **AND** the chip "✓ Direção visual definida pelo Vendeo" SHALL be displayed
- **AND** the "Enviar logotipo" button SHALL be displayed
- **AND** the "Não tenho logo" button SHALL be displayed

#### Scenario: Text only with failed profile shows retry

- **WHEN** `identity_state` is `'text_only'`
- **AND** the brand profile status is `'failed'`
- **THEN** the "Continuar sem logo" link SHALL NOT be displayed
- **AND** a "Gerar direção visual agora" button SHALL be displayed

#### Scenario: Initial state shows all options

- **WHEN** `identity_state` is null (store not yet saved or identity not decided)
- **THEN** the "Continuar sem logo" link SHALL be displayed
- **AND** the "Enviar logotipo" and "Não tenho logo" buttons SHALL be displayed

### Requirement: Brand color untouched rule

The system SHALL expand the color picker pre-fill behavior. When `identity_state = 'text_only'` and a synced profile exists:

- If `brand_colors_chosen` is non-empty: color picker SHALL show the user's chosen colors
- If `brand_colors_chosen` is empty: color picker SHALL show `safe_color_tokens.primary` and `inferred_accent_color`
- In both cases, chips with the full `safe_color_tokens` palette SHALL be displayed below the pickers
- The user MAY still change colors — if changed, they are saved via PATCH /api/store/[id]/brand-profile and `manual_color_override` becomes `true`

The preview SHALL use `safe_color_tokens.primary` as the display color (not `brand_colors_chosen[0]`) when a synced text_only profile exists, to maintain consistency with the campaign rendering priority.

#### Scenario: Text only profile with user colors pre-fills picker

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists with `brand_colors_chosen = ["#FF6600"]`
- **THEN** the primary color picker SHALL display `#FF6600`

#### Scenario: Text only profile without user colors infers

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists with `brand_colors_chosen = []`
- **THEN** the primary color picker SHALL display `safe_color_tokens.primary`

#### Scenario: Palette chips shown below pickers

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists
- **THEN** color chips for `safe_color_tokens` (primary, secondary, accent, background) SHALL be displayed below the pickers

#### Scenario: User changes color updates manual_color_override

- **WHEN** the user changes a color in the picker after inference
- **THEN** `manual_color_override` SHALL be set to `true`
- **AND** `brand_colors_chosen` SHALL be updated via PATCH /api/store/[id]/brand-profile

### Requirement: Simple visual preview

The system SHALL expand the preview to show visual identity intelligence when `identity_state = 'text_only'` and a synced brand profile exists:

- Store name
- Segment badge
- Brand color swatch (from `safe_color_tokens.primary`)
- If a visual signature URL exists (either uploaded or generated), show it instead of the color swatch
- **NEW in text_only**: Display `visual_style`, `visual_tone`, `brand_personality`
- **NEW in text_only**: Display color chips from `safe_color_tokens`
- **NEW in text_only**: Chip "✓ Direção visual definida pelo Vendeo"

The color resolution for the preview SHALL follow: `safe_color_tokens.primary > inferred_primary_color > store.brand_color > SEGMENT_COLOR_FALLBACK[segment]`.

#### Scenario: Preview shows intelligence for text_only

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists
- **THEN** the preview SHALL display `visual_style`, `visual_tone`, and `brand_personality`
- **AND** the preview SHALL display color chips from `safe_color_tokens`
- **AND** the preview SHALL display "✓ Direção visual definida pelo Vendeo"

#### Scenario: Preview color follows safe_color_tokens

- **WHEN** `identity_state = 'text_only'`
- **AND** a synced profile exists with `safe_color_tokens.primary = "#4A6FA5"`
- **THEN** the preview's brand color swatch SHALL be `#4A6FA5`

#### Scenario: Save button triggers inference for text_only

- **WHEN** the user clicks "Salvar" in Step 2
- **AND** no logo is active and no visual signature is active
- **THEN** the system SHALL set `identity_state = 'text_only'` and `text_only_origin = 'implicit'`
- **AND** if `manual_color_override` is `true`, save `brand_colors_chosen` via PATCH
- **AND** trigger the brand inference pipeline
- **AND** display the inference spinner

### Requirement: Visual signature section behavior

The visual signature section SHALL consider `identity_state` alongside `logo_status`. When `identity_state = 'text_only'`:

- The section SHALL show "Direção visual definida pelo Vendeo" with the chip
- The option to create a visual signature SHALL remain available
- The "Continuar sem logo" link SHALL NOT be shown here either

#### Scenario: Section shows text_only state

- **WHEN** `identity_state` is `'text_only'`
- **AND** `logo_status` is `'explicit_none'`
- **THEN** the visual signature section SHALL NOT show "Continuar sem logo"
- **AND** the option to "Criar assinatura visual agora" SHALL remain available
