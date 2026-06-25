## MODIFIED Requirements

### Requirement: brand_colors_chosen semantic clarification

The system SHALL treat `brand_colors_chosen` exclusively as the user's chosen colors.

**Correct usage:**
- User chose colors via color picker → `brand_colors_chosen = ["#userPrimary", "#userAccent"]` (par completo)
- User chose only primary → `brand_colors_chosen = ["#userPrimary", null]`
- User chose only accent → `brand_colors_chosen = [null, "#userAccent"]`
- User did not choose colors → `brand_colors_chosen = []`

**Incorrect usage (eliminated in this phase):**
- Writing extracted logo colors to `brand_colors_chosen` — handled by `logo_colors_detected`
- Writing inferred palette to `brand_colors_chosen` — handled by `safe_color_tokens`
- Using `manual_color_override` as source of truth — deprecated

**Preservation on visual signature approval:**
When a new brand profile is generated from visual signature approval:
- `brand_colors_chosen` SHALL be preserved from the **previous synced profile** ONLY IF `brand_colors_chosen` contains at least one valid HEX color
- If `brand_colors_chosen` is `[]` or no previous synced profile exists → `brand_colors_chosen = []`
- `manual_color_override` SHALL NOT be consulted for this decision

**Preservation on logo upload and realignment:**
- Logo upload SHALL preserve `brand_colors_chosen` from the previous synced profile when it contains at least one valid HEX
- Realinhamento SHALL preserve `brand_colors_chosen` from the previous synced profile when it contains at least one valid HEX
- Logo upload SHALL NOT set `brand_colors_chosen = []` unconditionally


#### Scenario: brand_colors_chosen NOT populated by logo upload (preserves existing)

- **WHEN** a logo upload creates a synced brand profile
- **AND** the previous synced profile has `brand_colors_chosen = []`
- **THEN** the new profile SHALL have `brand_colors_chosen = []`
- **AND** `logo_colors_detected` SHALL contain the extracted colors
- **AND** `safe_color_tokens` SHALL contain the final palette

#### Scenario: brand_colors_chosen preserved on logo upload when exists

- **WHEN** a logo upload creates a synced brand profile
- **AND** the previous synced profile has `brand_colors_chosen = ["#FF6600", null]`
- **THEN** the new profile SHALL have `brand_colors_chosen = ["#FF6600", null]`
- **AND** `manual_color_override` SHALL NOT be consulted

#### Scenario: brand_colors_chosen preserved with null on VS approval

- **WHEN** a new brand profile is generated from visual signature approval
- **AND** the previous synced profile has `brand_colors_chosen = ["#FF6600", null]`
- **THEN** the new profile SHALL have `brand_colors_chosen = ["#FF6600", null]`

#### Scenario: brand_colors_chosen empty without previous choice

- **WHEN** a new brand profile is generated from any automatic flow
- **AND** the previous synced profile has `brand_colors_chosen = []`
- **THEN** the new profile SHALL have `brand_colors_chosen = []`

#### Scenario: brand_colors_chosen populated only by manual picker

- **WHEN** the user changes colors via PATCH brand-profile with `{ "colors": ["#FF6600", null] }`
- **THEN** `brand_colors_chosen` SHALL be updated to `["#FF6600", null]`

### Requirement: Update brand colors — PATCH /api/store/[id]/brand-profile

The system SHALL expose a `PATCH /api/store/[id]/brand-profile` endpoint that updates the `brand_colors_chosen` field of the active brand profile.

The endpoint SHALL accept a JSON body with `colors: Array<string | null>` where each value is either a valid hex string (`#RRGGBB`) or `null`. On success, the profile SHALL be updated in-place (same profile, same version).

Validation rules:
- Each element SHALL be either a valid 7-character hex string (`#RRGGBB`) or `null`
- Arrays with a single element SHALL be rejected (positions would be ambiguous)
- Valid arrays: `[]`, `[hex, null]`, `[null, hex]`, `[hex, hex]`

When updating colors:
1. `brand_colors_chosen` SHALL be updated with the new array
2. `manual_color_override` in the profile SHALL NOT be set or modified
3. `stores.manual_color_override` SHALL NOT be set or modified
4. `safe_color_tokens` SHALL NOT change
5. `stores.brand_color` SHALL NOT be updated by this endpoint
6. The endpoint SHALL require an existing synced profile (returns 404 if none exists)

#### Scenario: Colors updated with null support

- **WHEN** a PATCH request is sent with `{ "colors": ["#FF0000", null] }`
- **THEN** the active profile's `brand_colors_chosen` SHALL be updated to `["#FF0000", null]`
- **AND** `manual_color_override` SHALL NOT be modified

#### Scenario: Colors cleared on reset

- **WHEN** a PATCH request is sent with `{ "colors": [] }`
- **THEN** the active profile's `brand_colors_chosen` SHALL be `[]`

#### Scenario: Rejects single-element array

- **WHEN** a PATCH request is sent with `{ "colors": ["#FF0000"] }`
- **THEN** HTTP 400 SHALL be returned
- **AND** `brand_colors_chosen` SHALL NOT be modified

#### Scenario: Rejects invalid hex

- **WHEN** a PATCH request is sent with `{ "colors": ["#GGGGGG", null] }`
- **THEN** HTTP 400 SHALL be returned

#### Scenario: 404 when no synced profile

- **WHEN** a PATCH request is sent for a store without a synced profile
- **THEN** HTTP 404 SHALL be returned

#### Scenario: PATCH does not update stores.brand_color

- **WHEN** a PATCH updates `brand_colors_chosen`
- **THEN** `stores.brand_color` SHALL NOT be modified

### Requirement: Brand profile generation — text_only inference (userChosenColors)

When a text-only inference is triggered via `POST /api/store/[id]/brand-profile/infer`, the endpoint SHALL accept an optional `userChosenColors: Array<string | null>` field in the request body.

When `userChosenColors` is provided and contains at least one valid HEX, the inference SHALL:
1. Persist the received colors in the new profile's `brand_colors_chosen`
2. Use them as context for the BrandTextOnlyInferenceService (indicating user preference)

When `userChosenColors` is not provided or is `[]`, the inference SHALL:
1. Check the previous synced profile for existing `brand_colors_chosen`
2. If previous profile has `brand_colors_chosen` with at least one valid HEX, preserve it
3. If no previous profile or previous is `[]`, set `brand_colors_chosen = []`

`manualColorOverride` SHALL NOT be accepted or used by this endpoint.

#### Scenario: userChosenColors persisted on first inference

- **WHEN** text-only inference is triggered for a new store (no previous profile)
- **AND** body contains `userChosenColors: ["#FF0000", null]`
- **THEN** the new profile SHALL have `brand_colors_chosen = ["#FF0000", null]`

#### Scenario: Existing brand_colors_chosen preserved on re-inference

- **WHEN** text-only inference is triggered for a store with an existing synced profile
- **AND** the previous profile has `brand_colors_chosen = ["#FF6600", null]`
- **AND** body does NOT contain `userChosenColors`
- **THEN** the new profile SHALL have `brand_colors_chosen = ["#FF6600", null]`
- **AND** `manual_color_override` SHALL NOT be consulted

#### Scenario: Empty userChosenColors with no previous profile

- **WHEN** text-only inference is triggered for a new store
- **AND** body contains `userChosenColors: []`
- **THEN** the new profile SHALL have `brand_colors_chosen = []`

#### Scenario: manualColorOverride ignored

- **WHEN** body contains `manualColorOverride: true`
- **THEN** the field SHALL be ignored
- **AND** `brand_colors_chosen` SHALL be determined solely by `userChosenColors` or previous profile

### Requirement: Store brand profiles table — column semantic (updated)

The `brand_colors_chosen` column type SHALL be `jsonb` (unchanged), but its semantic is updated:
- Accepts `null` in any position: `Array<string | null>`
- Empty array `[]` means "no user choice"
- Array with 2 positions where at least one is a valid hex means "user has made a choice"

The `manual_color_override` column remains in the schema for backward compatibility but SHALL NOT be written by any flow in this phase. It SHALL be considered **deprecated** and may be removed in a future migration.

#### Scenario: brand_colors_chosen accepts null

- **WHEN** a profile is created or updated with `brand_colors_chosen = ["#FF0000", null]`
- **THEN** the JSONB column SHALL store the array as-is
- **AND** `null` SHALL be preserved in the stored value

#### Scenario: manual_color_override not written

- **WHEN** any flow updates `brand_colors_chosen`
- **THEN** `manual_color_override` SHALL NOT be set or modified in `store_brand_profiles`
- **AND** `stores.manual_color_override` SHALL NOT be set or modified
