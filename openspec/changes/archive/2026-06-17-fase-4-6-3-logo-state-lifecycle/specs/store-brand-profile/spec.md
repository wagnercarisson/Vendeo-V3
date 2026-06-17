> **Purpose**: Delta spec for store-brand-profile changes in fase 4.6.3 — profile lifecycle on logo remove (stays synced), active_logo_asset_id as provenance (never nulled), compensation on failed insert, input_snapshot vs attempt_snapshot semantics, brand_colors_chosen isolation.

## MODIFIED Requirements

### Requirement: Brand profile lifecycle

Profiles SHALL follow this lifecycle:

1. Created directly with status `synced` when analysis completes successfully (V1)
2. Created directly with status `failed` when analysis fails (V1)
3. Previous `synced` profile becomes `outdated` ONLY when a NEW profile is created with status `synced` — if the new profile insert fails, the compensation SHALL restore the previous profile to `synced`. The previous profile SHALL NOT remain outdated without a replacement
4. Profile remains `synced` when logo is soft-deleted — only the assets are archived. The `active_logo_asset_id` FK is preserved for provenance. The store's `identity_state` is synced to `'text_only'`
5. Profile `synced` after logo remove is the SAME profile — not a new one. Its `active_logo_asset_id` continues pointing to the original asset that generated it (provenance preserved)

If a new logo is uploaded for a store that previously had a brand profile with source `without_logo`, and the new profile is created with status `synced`, the without_logo profile SHALL be marked `outdated`.

For `source = 'text_only'` profiles, the lifecycle rules apply equally:
- A new text_only inference marks the previous synced text_only profile as `outdated`
- Text_only profiles created as `failed` do NOT mark previous synced profiles as outdated
- Profile reactivation (when user transitions back to text_only from logo or visual_signature) is NOT implemented in this phase — profiles are only created and marked outdated, never reactivated

#### Scenario: Profile creation with compensation on failure

- **WHEN** a previous `synced` profile is marked `outdated`
- **AND** the new profile insert fails
- **THEN** the previous profile SHALL be restored to `synced`
- **AND** the store SHALL NOT be left without an active profile

#### Scenario: Profile remains synced on logo remove

- **WHEN** a logo is removed via DELETE /api/store/[id]/logo
- **THEN** the active brand profile SHALL remain `synced`
- **AND** `active_logo_asset_id` SHALL be preserved
- **AND** the profile SHALL NOT be archived or marked outdated

#### Scenario: Profile provides fallback direction on failed upload

- **WHEN** a new logo upload succeeds but BrandDirector analysis fails
- **THEN** the previous synced profile SHALL remain `synced`
- **AND** a new profile SHALL be created with `status = 'failed'`
- **AND** `identity_state` SHALL be `'logo'`
- **AND** the UI SHALL use the previous profile's direction as fallback

### Requirement: Brand profile generation — inline processing

The brand profile SHALL be generated inline during the `POST /api/store/[id]/logo` request. The system SHALL execute the BrandDirector analysis BEFORE mutating any existing profile. The processing order SHALL be:

1. Upload logo and generate variants (no profile mutation)
2. Execute BrandDirector analysis
3. On success: apply compensated profile transition (mark outdated → insert synced → compensate on failure)
4. On failure: preserve previous profile as fallback, insert failed profile with `metadata.attempt_snapshot`

The `processing` status exists in the model as a reserved status for future use with a durable job queue. In V1, the profile SHALL be created directly as `synced` or `failed` — no transition through `processing`.

#### Scenario: BrandDirector executed before profile mutation

- **WHEN** a valid logo is uploaded
- **THEN** the Store Brand Director LLM call SHALL execute BEFORE any profile status change
- **AND** the previous synced profile SHALL NOT be marked `outdated` until the new profile is ready to be inserted

#### Scenario: Failed analysis inserts failed profile without outdated marking

- **WHEN** the Store Brand Director analysis fails
- **THEN** the previous synced profile SHALL remain `synced` (NOT marked outdated)
- **AND** a new profile SHALL be created with `status = 'failed'`
- **AND** `metadata.attempt_snapshot` SHALL be set with the 6 store fields
- **AND** `metadata.input_snapshot` SHALL NOT be set on the failed profile
- **AND** the upload endpoint SHALL return HTTP 201 (logo persists)

### Requirement: brand_colors_chosen semantic clarification

The system SHALL treat `brand_colors_chosen` exclusively as the user's chosen colors. This spec explicitly overrides any previous behavior that wrote AI-inferred or extracted colors into this field.

**Correct usage:**
- User chose colors via color picker → `brand_colors_chosen = ["#userPrimary", "#userAccent"]`
- User did not choose colors → `brand_colors_chosen = []`

**Incorrect usage (being corrected in this phase):**
- Writing extracted logo colors to `brand_colors_chosen` in POST /logo (being removed in 4.6.3)
- Writing inferred palette to `brand_colors_chosen` in text_only inference (already corrected in 4.6.2)

For campaign rendering, the color resolution priority SHALL be:
`safe_color_tokens.primary > inferred_primary_color > store.brand_color > SEGMENT_COLOR_FALLBACK[segment]`

`brand_colors_chosen` is used only for UI pre-fill in the color pickers and as input signal to the inference service.

#### Scenario: brand_colors_chosen NOT populated by logo upload

- **WHEN** a logo upload creates a synced brand profile
- **THEN** `brand_colors_chosen` SHALL be `[]` (unless the user had previously chosen colors)
- **AND** `logo_colors_detected` SHALL contain the extracted colors
- **AND** the final palette SHALL be in `safe_color_tokens`

#### Scenario: brand_colors_chosen populated only by manual picker

- **WHEN** the user changes colors via PATCH brand-profile with `{ "colors": ["#FF6600"] }`
- **THEN** `brand_colors_chosen` SHALL be updated to `["#FF6600"]`

### Requirement: active_logo_asset_id provenance (semântica atualizada)

O campo `active_logo_asset_id` no `store_brand_profiles` tem semântica de **proveniência** — aponta para o asset original que gerou este profile. NUNCA é nullado após ser definido. Quando `source = 'logo_analysis'`, o campo SHALL sempre conter o UUID do asset original, mesmo após remoção do logo.

O estado visual do logo é decidido pela combinação de:
- `identity_state = 'logo'` + existência de asset `store_brand_assets` com `status = 'active'` → logo ativo visualmente
- `identity_state != 'logo'` → logo não ativo, independente do valor de `active_logo_asset_id`

#### Scenario: active_logo_asset_id preserved on logo remove

- **WHEN** a logo is removed via DELETE /api/store/[id]/logo
- **THEN** `active_logo_asset_id` SHALL NOT be nulled
- **AND** the profile SHALL retain the FK reference to the original asset

#### Scenario: active_logo_asset_id always set for logo_analysis

- **WHEN** a profile is created with `source = 'logo_analysis'`
- **THEN** `active_logo_asset_id` SHALL be set to the ID of the original uploaded asset
- **AND** it SHALL NOT be null for the lifetime of the profile
