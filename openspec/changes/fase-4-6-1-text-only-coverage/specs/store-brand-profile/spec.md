> **Purpose**: Delta spec for store-brand-profile — updates the brand profile system to support `source = 'text_only'`, clarifies `brand_colors_chosen` semantics (exclusively user-chosen colors), adds `manual_color_override` column, and extends the lifecycle to include text_only profiles.

## MODIFIED Requirements

### Requirement: Store Brand Profiles table

The system SHALL update the `store_brand_profiles` table definition to include the new `source` value and a new column.

**Table changes:**

| Column | Change |
|--------|--------|
| `source` CHECK | **MODIFIED**: `source IN ('logo_analysis', 'without_logo', 'text_only')` (added `'text_only'`) |
| `manual_color_override` | **ADDED**: `jsonb NOT NULL DEFAULT '{"enabled": false}'` — tracks whether the user manually overrode colors at the profile level |
| `brand_colors_chosen` | **SEMANTIC CLARIFIED**: Now exclusively represents colors chosen by the user. When the user has not chosen colors, this field SHALL be `[]`. Other flows (logo_analysis, without_logo) currently may still write to this field — those will be corrected in future subphases. |

The migration SHALL:
- Drop the existing source CHECK constraint
- Re-add with `source IN ('logo_analysis', 'without_logo', 'text_only')`
- Add `manual_color_override` column

#### Scenario: Migration adds text_only to source CHECK

- **WHEN** the migration is applied
- **THEN** the source CHECK constraint SHALL allow `'logo_analysis'`, `'without_logo'`, AND `'text_only'`

#### Scenario: manual_color_override column exists

- **WHEN** the `store_brand_profiles` table schema is inspected
- **THEN** there SHALL be a `manual_color_override` column of type `jsonb`
- **AND** its default value SHALL be `'{"enabled": false}'`

### Requirement: Brand profile lifecycle

The system SHALL extend the brand profile lifecycle to include `source = 'text_only'`:

1. Existing lifecycle rules (creation as `synced`/`failed`, previous marked `outdated` on new synced, archived on soft-delete) SHALL apply equally to `text_only` profiles
2. Profile reactivation (when user transitions back to `text_only` from `logo` or `visual_signature`) SHALL be implemented in a future subphase. In this phase (4.6.1), `text_only` profiles are only created and marked `outdated` — never reactivated.

**Nota**: A reativação (item 4) será implementada em subfase futura. Nesta fase (4.6.1), profiles `text_only` são apenas criados e marcados como `outdated` — nunca reativados.

#### Scenario: nova inferência text_only marca o synced anterior como outdated

- **WHEN** uma nova inferência text_only é concluída com `status = 'synced'`
- **AND** a loja já possui um profile `source = 'text_only'` atualmente `synced`
- **THEN** o profile anterior SHALL ser marcado como `outdated`
- **AND** o novo profile SHALL ser criado com `source = 'text_only'` e `status = 'synced'`

### Requirement: Brand profile generation — text_only inference

**ADDED**: A new generation mode is introduced for `source = 'text_only'`. The profile SHALL be generated via `POST /api/store/[id]/brand-profile/infer`. This is separate from the logo upload and visual signature approval flows.

The inference SHALL:
1. Load store data (name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state)
2. Accept optional user color preferences
3. Call the BrandTextOnlyInferenceService
4. Persist with `source = 'text_only'` and `status = 'synced'` on success, `'failed'` on failure
5. Respond only after the operation completes

#### Scenario: Text-only inference creates synced profile

- **WHEN** the BrandTextOnlyInferenceService completes successfully
- **THEN** the profile SHALL be created with `source = 'text_only'` and `status = 'synced'`

#### Scenario: Text-only inference creates failed profile on error

- **WHEN** the BrandTextOnlyInferenceService fails
- **THEN** the profile SHALL be created with `source = 'text_only'` and `status = 'failed'`

### Requirement: brand_colors_chosen semantic clarification

The system SHALL treat `brand_colors_chosen` exclusively as the user's chosen colors. The field name means "brand colors chosen by the user." This spec explicitly overrides any previous behavior that wrote AI-inferred or extracted colors into this field.

**Correct usage:**
- User chose colors → `brand_colors_chosen = ["#userPrimary", "#userAccent"]`
- User did not choose colors → `brand_colors_chosen = []`

**Incorrect usage (to be corrected in future subphases):**
- Writing extracted logo colors to `brand_colors_chosen` (4.6.2)
- Writing inferred palette to `brand_colors_chosen` (4.6.3)

For campaign rendering, the color resolution priority SHALL be:
`safe_color_tokens.primary > inferred_primary_color > store.brand_color > SEGMENT_COLOR_FALLBACK[segment]`

`brand_colors_chosen` is used only for UI pre-fill in the color pickers and as input signal to the inference service.

#### Scenario: brand_colors_chosen populated only when user chose colors

- **WHEN** a text_only brand profile is created after user chose colors `["#FF6600"]`
- **THEN** `brand_colors_chosen` SHALL be `["#FF6600"]`

#### Scenario: brand_colors_chosen empty when user didn't choose colors

- **WHEN** a text_only brand profile is created and user did not interact with color pickers
- **THEN** `brand_colors_chosen` SHALL be `[]`

### Requirement: PATCH brand-profile/colors behavior in text_only

**ADDED**: The `PATCH /api/store/[id]/brand-profile` endpoint SHALL handle color updates for `source = 'text_only'` profiles. When the user changes colors after inference:

1. `brand_colors_chosen` SHALL be updated with the new colors
2. `manual_color_override.enabled` in the profile SHALL be set to `true`
3. `stores.manual_color_override` SHALL be set to `true`
4. The `safe_color_tokens` SHALL NOT change — the user's color choice does not override the campaign palette
5. `stores.brand_color` sync is NOT part of this endpoint — sync from `safe_color_tokens.primary` SHALL happen only in the inference service

#### Scenario: PATCH updates brand_colors_chosen for text_only

- **WHEN** a PATCH request is sent for a store with `source = 'text_only'` profile
- **AND** body contains `{ "colors": ["#FF6600", "#E8A040"] }`
- **THEN** `brand_colors_chosen` SHALL be updated to `["#FF6600", "#E8A040"]`
- **AND** `safe_color_tokens` SHALL remain unchanged
