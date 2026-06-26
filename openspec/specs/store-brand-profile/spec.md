> **Purpose**: Defines the store brand profile system: the `store_brand_profiles` table, lifecycle management (synced/failed/outdated/archived), inline AI analysis integration via Store Brand Director, and controlled API endpoints for reading, regenerating, updating colors, and archiving profiles.

## Requirements

### Requirement: Store Brand Profiles table

The system SHALL have a `store_brand_profiles` table in the public Supabase schema created via a versioned migration file.

| Column | Type | Required | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | Yes | `gen_random_uuid()` | Primary key |
| `store_id` | `uuid` | Yes | — | FK → stores(id) |
| `source` | `text` | Yes | — | `logo_analysis`, `without_logo`, `text_only` |
| `active_logo_asset_id` | `uuid` | No | `null` | FK → store_brand_assets(id), points to the original asset that generated this profile. Serves as provenance link — never nulled after being set. Null when source = without_logo or text_only. When source = logo_analysis, SHALL always be set, even after logo removal |
| `logo_colors_detected` | `jsonb` | No | `null` | Array of hex color strings detected from logo analysis |
| `brand_colors_chosen` | `jsonb` | No | `null` | Array of hex color strings chosen by the lojista, or null in any position for partial choice. Empty array [] means no user choice |
| `safe_color_tokens` | `jsonb` | No | `null` | `{ primary, secondary, accent, ... }` — safe usage tokens |
| `visual_style` | `text` | No | `null` | Inferred visual style description |
| `visual_tone` | `text` | No | `null` | Inferred visual tone (e.g., "moderno e clean") |
| `typography_direction` | `text` | No | `null` | Typography direction inferred from brand |
| `brand_personality` | `text` | No | `null` | Brand personality description |
| `campaign_guidelines` | `text` | No | `null` | Guidelines for campaign generation |
| `campaign_brief` | `text` | No | `null` | Structured brief for the Campaign Director |
| `confidence_score` | `float` | No | `null` | 0–1, confidence of the AI analysis |
| → `visual_signature_id` | `uuid` | No | `null` | FK → store_visual_signatures(id). The approved visual signature that originated this profile (for source = without_logo) |
| → `inferred_primary_color` | `text` | No | `null` | Primary color inferred by AI (may differ from brand_colors_chosen[0]) |
| → `inferred_accent_color` | `text` | No | `null` | Accent color inferred by AI |
| → `identity_art_director_output` | `jsonb` | No | `null` | Creative metadata from identity art director: creative_description, suggested_colors, visual_direction, elements_used |
| → `manual_color_override` | `jsonb` | No | `{"enabled": false}` | **DEPRECATED for phase 4.6.7+** — no new flows write or consult this field. Schema retained for backward compatibility |
| `metadata` | `jsonb` | No | `null` | Model, provider, elapsedMs, error details, etc |
| `version` | `int` | Yes | `1` | Incremented on regeneration |
| `status` | `text` | Yes | `processing` | `processing`, `synced`, `outdated`, `failed`, `archived` |
| `created_at` | `timestamptz` | Yes | `now()` | Auto-set on create |
| `updated_at` | `timestamptz` | Yes | `now()` | Auto-updated on change |

The migration SHALL include:
- CHECK constraint: `status IN ('processing', 'synced', 'outdated', 'failed', 'archived')`
- CHECK constraint: `source IN ('logo_analysis', 'without_logo', 'text_only')`
- Partial unique index: `(store_id)` WHERE `status = 'synced'` — enforces at most one active profile per store
- Trigger for auto-updating `updated_at`

#### Scenario: Migration file exists with correct schema

- **WHEN** migrations are listed
- **THEN** there SHALL be a file matching `supabase/migrations/*_create_store_brand_profiles.sql`
- **AND** the file SHALL contain the `CREATE TABLE public.store_brand_profiles (...)` statement with all columns

#### Scenario: Partial unique index enforces one synced per store

- **WHEN** a store already has a profile with status `synced`
- **AND** a second profile is inserted with status `synced` for the same store
- **THEN** the insert SHALL fail with a unique constraint violation

#### Scenario: CHECK constraint rejects invalid status

- **WHEN** a profile is inserted with status `invalid_status`
- **THEN** the insert SHALL fail with a CHECK constraint violation

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

**Nota**: O status `processing` existe no modelo e no banco como reservado para uso futuro com fila/job durável. Na V1, o profile é sempre criado como `synced` ou `failed` diretamente — não passa por `processing`.

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

#### Scenario: Profile created as synced on success

- **WHEN** the Store Brand Director completes analysis successfully
- **THEN** the profile SHALL be created with status `synced` directly

#### Scenario: Profile created as failed on error

- **WHEN** the Store Brand Director analysis fails
- **THEN** the profile SHALL be created with status `failed` directly
- **AND** error details SHALL be recorded in metadata

#### Scenario: New upload marks previous as outdated

- **WHEN** a new logo is uploaded for a store with a `synced` profile
- **THEN** the previous profile status SHALL be changed to `outdated`

#### Scenario: Previous profile marked outdated only on new synced profile

- **WHEN** a new brand profile is created with `status = 'synced'`
- **AND** a previous synced profile exists
- **THEN** the previous profile SHALL be set to `outdated`

#### Scenario: Failed new profile preserves previous

- **WHEN** a new brand profile is created with `status = 'failed'`
- **AND** a previous synced profile exists
- **THEN** the previous profile SHALL remain `synced` unchanged
- **AND** the store SHALL continue using the previous profile

#### Scenario: Without-logo profile outdated by new logo

- **WHEN** a new logo is uploaded for a store with a `synced` profile from source `without_logo`
- **AND** the new profile analysis completes with `status = 'synced'`
- **THEN** the previous profile SHALL be set to `outdated`
- **AND** a new profile SHALL be created with `source = 'logo_analysis'`

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

### Requirement: Brand profile generation — text_only inference (userChosenColors)

When a text-only inference is triggered via `POST /api/store/[id]/brand-profile/infer`, the endpoint SHALL accept an optional `userChosenColors: Array<string | null>` field in the request body.

When `userChosenColors` is provided and contains at least one valid HEX, the inference SHALL:
1. Persist the received colors in the new profile's `brand_colors_chosen`
2. NOT pass them as context to BrandTextOnlyInferenceService in this phase. The received colors SHALL only be persisted in `brand_colors_chosen` — do NOT use them to alter prompt, visual direction, creative decisions, or asset generation.

When `userChosenColors` is not provided or is `[]`, the inference SHALL:
1. Check the previous synced profile for existing `brand_colors_chosen`
2. If previous profile has `brand_colors_chosen` with at least one valid HEX, preserve it
3. If no previous profile or previous is `[]`, set `brand_colors_chosen = []`

`manualColorOverride` SHALL NOT be accepted or used by this endpoint.

The inference SHALL also:
1. Load store data (name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state)
2. Call the BrandTextOnlyInferenceService
3. Populate `metadata.input_snapshot` with the current visual state for all 6 sensitive fields
4. Persist with `source = 'text_only'` and `status = 'synced'` on success, `'failed'` on failure
5. Respond only after the operation completes

The inference response SHALL include `profile.metadata` (containing `input_snapshot`) so the frontend can use it for color hydration after re-inference.

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

#### Scenario: Text-only inference creates synced profile with input_snapshot

- **WHEN** the BrandTextOnlyInferenceService completes successfully
- **THEN** the profile SHALL be created with `source = 'text_only'` and `status = 'synced'`
- **AND** `metadata.input_snapshot` SHALL be populated with current store values for all 6 sensitive fields

#### Scenario: Text-only inference creates failed profile on error

- **WHEN** the BrandTextOnlyInferenceService fails
- **THEN** the profile SHALL be created with `source = 'text_only'` and `status = 'failed'`
- **AND** `metadata.input_snapshot` SHALL NOT be set

### Requirement: input_snapshot update on re-inference

When re-inference is triggered via "Realinhar" (from drift modal or discreet button), the system SHALL update `metadata.input_snapshot` with the current visual state (dados atuais da loja + cores vigentes normalizadas) after successful inference.

#### Scenario: input_snapshot updated on re-inference

- **WHEN** re-inference is triggered via "Realinhar direção visual"
- **AND** the inference completes successfully
- **THEN** `metadata.input_snapshot` SHALL be updated with the current visual state
- **AND** `metadata.drift_dismissed_snapshot` SHALL be removed (if present)

### Requirement: input_snapshot values on first inference

When an inference runs for the first time after a new store is saved (mode=create → PATCH /api/store → POST /api/store/[id]/brand-profile/infer), the `input_snapshot` SHALL capture the values that were just saved plus the store name. This establishes the baseline for future drift detection.

#### Scenario: First inference sets baseline snapshot

- **WHEN** the first text-only inference runs for a new store
- **AND** it completes successfully with status `synced`
- **THEN** `metadata.input_snapshot` SHALL contain the store's name, segment, subsegment, tone_of_voice, brand_color, and normalized accent_color at that moment
- **AND** this becomes the baseline for drift detection

### Requirement: PATCH /api/store/[id]/brand-profile/metadata endpoint

The system SHALL expose a `PATCH /api/store/[id]/brand-profile/metadata` endpoint that receives metadata updates for the active brand profile. This endpoint SHALL:

- Accept `PATCH` method only at `/api/store/[id]/brand-profile/metadata`
- Accept a JSON body with metadata fields to merge (e.g., `{ "drift_dismissed_snapshot": {...} }`)
- Update the `metadata` JSONB column of the active synced brand profile for the store
- Perform a deep merge: provided fields SHALL replace or add, omitted fields SHALL retain current values
- Return HTTP 200 on success
- Return HTTP 404 if no synced brand profile exists
- Return HTTP 400 on invalid request body

#### Scenario: Metadata updated successfully

- **WHEN** a PATCH request is sent to `/api/store/{store_id}/brand-profile/metadata`
- **AND** body contains `{ "drift_dismissed_snapshot": {"segment": "moda", "name": "Loja"} }`
- **THEN** the active profile's `metadata.drift_dismissed_snapshot` SHALL be set to the provided value
- **AND** other metadata fields SHALL remain unchanged
- **AND** HTTP 200 SHALL be returned

#### Scenario: Deep merge preserves existing metadata

- **WHEN** the active profile has `metadata = { "existing_field": "value", "input_snapshot": {...} }`
- **AND** a PATCH request sends `{ "drift_dismissed_snapshot": {...} }`
- **THEN** `metadata.existing_field` SHALL be preserved
- **AND** `metadata.input_snapshot` SHALL be preserved
- **AND** `metadata.drift_dismissed_snapshot` SHALL be added

#### Scenario: 404 returned when no active profile

- **WHEN** a PATCH request is sent
- **AND** no synced brand profile exists for this store
- **THEN** HTTP 404 SHALL be returned

### Requirement: drift_dismissed_snapshot on dismiss

When the user clicks "Manter direção visual atual" on the drift modal, the system SHALL call `PATCH /api/store/[id]/brand-profile/metadata` with `drift_dismissed_snapshot` set to the current normalized visual state. This persists the user's choice across sessions.

#### Scenario: Dismiss persists across sessions

- **WHEN** the user dismisses the drift (clicks "Manter direção visual atual")
- **AND** the PATCH succeeds
- **THEN** on the next page load with the same store state, `driftStatus` SHALL be `dismissed`
- **AND** the discreet button SHALL be shown instead of a modal

### Requirement: drift_dismissed_snapshot removed on re-inference

When the user triggers re-inference (clicks "Realinhar direção visual" from any entry point), the system SHALL remove `metadata.drift_dismissed_snapshot` after successful inference. This ensures a clean slate for future drift detection.

#### Scenario: drift_dismissed_snapshot removed after re-inference

- **WHEN** re-inference completes successfully
- **THEN** `metadata.drift_dismissed_snapshot` SHALL be removed
- **AND** `metadata.input_snapshot` SHALL be updated with the new values from inference

### Requirement: Read brand profile — GET /api/store/[id]/brand-profile

The system SHALL expose a `GET /api/store/[id]/brand-profile` endpoint that returns the latest brand profile for the store (the most recently created, regardless of status). This enables the frontend to detect failed profiles on page load.

If no profile exists at all, the endpoint SHALL return HTTP 200 with `null` data.

#### Scenario: Latest profile returned regardless of status

- **WHEN** a GET request is sent to /api/store/{store_id}/brand-profile
- **AND** a profile exists (synced, failed, or outdated)
- **THEN** the response SHALL contain the most recent brand profile record

#### Scenario: No profile returns null

- **WHEN** a GET request is sent to /api/store/{store_id}/brand-profile
- **AND** no profile exists for this store
- **THEN** the response status SHALL be 200 with data set to `null`

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

### Requirement: Regenerate brand profile — POST /api/store/[id]/brand-profile/generate [DEFERRED to 4.6.3+]

> **Nota:** O endpoint de regenerate (`POST /api/store/[id]/brand-profile/generate`) está postergado para fases futuras (4.6.3/4.6.4). Na fase 4.6.2, a re-inferência de `text_only` usa `POST /api/store/[id]/brand-profile/infer`, que insere um novo profile com `input_snapshot` atualizado e sem `drift_dismissed_snapshot`.

Quando implementado, o regenerate endpoint SHALL também atualizar `metadata.input_snapshot` após regeneração bem-sucedida e limpar `metadata.drift_dismissed_snapshot`.

<!-- Original spec preserved below for future implementation:
The system SHALL expose a `POST /api/store/[id]/brand-profile/generate` endpoint that regenerates the brand profile by re-running the Store Brand Director analysis. This allows the lojista to retry after a failed analysis or request a fresh profile.

The endpoint SHALL process inline: call the LLM with the stored logo and current store data, persist the new profile, archive the previous one.

#### Scenario: Regenerate creates new profile

- **WHEN** a POST request is sent to /api/store/{store_id}/brand-profile/generate
- **AND** a previous profile exists
- **THEN** a new profile SHALL be created
- **AND** the previous profile SHALL have status changed to `outdated`
-->

### Requirement: Update brand colors — PATCH /api/store/[id]/brand-profile

The system SHALL expose a `PATCH /api/store/[id]/brand-profile` endpoint that updates the `brand_colors_chosen` field of the active brand profile. This allows the lojista to change colors without regenerating the entire profile.

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

### Requirement: Archive brand profile — POST /api/store/[id]/brand-profile/archive

The system SHALL expose a `POST /api/store/[id]/brand-profile/archive` endpoint that archives the active brand profile by changing its status to `archived`.

#### Scenario: Active profile archived

- **WHEN** a POST request is sent to /api/store/{store_id}/brand-profile/archive
- **THEN** the active profile's status SHALL be changed to `archived`

### Requirement: safe_color_tokens as ResolvedPalette

The `safe_color_tokens` jsonb column SHALL store a `ResolvedPalette` structure:

```typescript
interface ResolvedPalette {
  primary: string;
  secondary: string;      // supportResolved[0] ?? primary
  accent: string;
  background: string;
}
```

`secondary` SHALL be explicitly stored (not computed at query time) via `intendedToResolved()`:
- `secondary = supportResolved[0] ?? primary`
- `supportResolved` is the resolved support array — either confirmed intended supports or vision-corrected supports

#### Scenario: ResolvedPalette includes secondary

- **WHEN** a brand profile is created with `safe_color_tokens` in the new format
- **THEN** the JSON SHALL include `primary`, `secondary`, `accent`, and `background` keys
- **AND** `secondary` SHALL equal `supportResolved[0] ?? primary`

#### Scenario: Match exato — individual role comparison

- **WHEN** `safe_color_tokens` is created from `intendedToResolved(intendedPalette, intendedPalette.support)`
- **THEN** `safe_color_tokens.primary` SHALL equal `intendedPalette.primary`
- **AND** `safe_color_tokens.accent` SHALL equal `intendedPalette.accent`
- **AND** `safe_color_tokens.background` SHALL equal `intendedPalette.background`
- **AND** `safe_color_tokens.secondary` SHALL equal `intendedPalette.support[0] ?? intendedPalette.primary`

### Requirement: ColorValidation metadata structure

The `metadata` jsonb column SHALL support a `color_validation` field as a discriminated union:

```typescript
interface ColorValidationEntry {
  intended: string | null;          // null when fallback_heuristic (no prior intent)
  resolved: string;
  presence: 'confirmed' | 'ambiguous' | 'not_confirmed' | 'unchecked';
  delta_e: number | null;           // null when probe_unavailable or fallback_heuristic
  role_source: 'art_director' | 'vision_adjudication' | 'heuristic';
  resolution: 'accepted' | 'accepted_unverified' | 'corrected_by_vision' | 'selected_by_heuristic';
  resolved_from_cluster?: {
    hex: string;
    classification: string;
    frequency: number;
    delta_e: number;
  } | null;
  note?: string;
}

type VisionAdjudicationAudit =
  | { status: 'success'; reason: string; prompt_suffix: string }
  | { status: 'failed'; reason: VisionFailureReason; details?: string; attemptedAt: string };

// Resolved states
interface ColorValidationResolved {
  global_status: 'all_confirmed' | 'vision_adjudicated' | 'probe_unavailable' | 'fallback_heuristic';
  primary: ColorValidationEntry;
  accent: ColorValidationEntry;
  secondary: ColorValidationEntry;
  background: ColorValidationEntry;
  support_colors: string[];
  support_details?: ColorValidationEntry[];
  vision_adjudication?: VisionAdjudicationAudit;
}

// Failed state
interface ColorValidationFailed {
  global_status: 'vision_failed';
  vision_adjudication: VisionAdjudicationAudit;
}

type ColorValidation = ColorValidationResolved | ColorValidationFailed;
```

Relationships:
- `metadata.color_validation.<role>.resolved` SHALL equal `safe_color_tokens.<role>` (same hex value)
- `safe_color_tokens` is a separate column — not part of `color_validation`

For `vision_failed` state:
- `safe_color_tokens` SHALL be `{}`
- `stores.brand_color` and `stores.accent_color` SHALL NOT be updated
- The approved visual signature SHALL remain `active` (profile failure is isolated)

#### Scenario: ColorValidation populated on all_confirmed

- **WHEN** a brand profile is created with `global_status = 'all_confirmed'`
- **THEN** `metadata.color_validation.primary.presence` SHALL be `'confirmed'`
- **AND** `metadata.color_validation.primary.resolved` SHALL equal `safe_color_tokens.primary`

#### Scenario: Failed profile stores audit only

- **WHEN** profile is created with `global_status = 'vision_failed'`
- **THEN** `metadata.color_validation.global_status` SHALL be `'vision_failed'`
- **AND** `metadata.color_validation.vision_adjudication.status` SHALL be `'failed'`
- **AND** `safe_color_tokens` SHALL be `{}`
- **AND** `metadata.color_validation` SHALL NOT contain `primary`, `accent`, `secondary`, or `background` entries

### Requirement: Store accent_color sync on profile creation

When a brand profile is created with `status = 'synced'`, the system SHALL synchronize:
- `stores.brand_color ← safe_color_tokens.primary`
- `stores.accent_color ← safe_color_tokens.accent`

The `inferred_primary_color` and `inferred_accent_color` fields on the profile record SHALL also be updated to match `safe_color_tokens.primary` and `safe_color_tokens.accent` respectively, but these are profile fields, NOT store-level fields.

When `status = 'failed'`, store fields SHALL NOT be updated.

#### Scenario: Stores synced on profile success

- **WHEN** a brand profile is created with `status = 'synced'`
- **THEN** `stores.brand_color` SHALL equal `safe_color_tokens.primary`
- **AND** `stores.accent_color` SHALL equal `safe_color_tokens.accent`
- **AND** `profile.inferred_primary_color` SHALL equal `safe_color_tokens.primary`
- **AND** `profile.inferred_accent_color` SHALL equal `safe_color_tokens.accent`

#### Scenario: Stores NOT synced on profile failure

- **WHEN** profile is created with `status = 'failed'`
- **THEN** `stores.brand_color` SHALL NOT be updated
- **AND** `stores.accent_color` SHALL NOT be updated

### Requirement: intended_palette consumption (not storage)

The `intended_palette` field originates in `store_visual_signatures.metadata.artDirectorOutput.intended_palette`. The brand profile SHALL NOT store `intended_palette` in its own metadata.

At profile generation time (visual signature approval), the approval route:
1. Reads `intended_palette` from the approved signature's `metadata.artDirectorOutput`
2. Reapplies `normalizeIntendedPalette()` for safety (idempotent)
3. Passes the normalized value to `BrandProfilerInput.intendedPalette`
4. The profiler consumes it for presence validation

#### Scenario: intendedPalette read from signature, not stored in profile

- **WHEN** the approval route processes a visual signature
- **THEN** `intendedPalette` SHALL be read from `signature.metadata.artDirectorOutput.intended_palette`
- **AND** SHALL be passed to the profiler as input
- **AND** SHALL NOT be persisted in the brand profile's metadata

### Requirement: Profile fallback matrix

The brand profiler SHALL follow this decision matrix when resolving colors:

| intendedPalette | Probe | global_status | safe_color_tokens |
|---|---|---|---|
| Válido | OK + todas ≤ 18 ∆E | `all_confirmed` | `intendedToResolved(intended, intended.support)` |
| Válido | OK + alguma > 18 ∆E | `vision_adjudicated` or `vision_failed` | Resolved by vision or `{}` |
| Válido | Vazio/exceção | `probe_unavailable` | `intendedToResolved(intended, intended.support)` |
| Nulo (retry/legado) | OK | `fallback_heuristic` | Probe-based heuristic |
| Nulo (retry/legado) | Vazio | `fallback_heuristic` | `{ primary: brandColor ?? SEGMENT_FALLBACK, secondary: brandColor ?? SEGMENT_FALLBACK, accent: brandColor ?? SEGMENT_FALLBACK, background: '#FFFFFF' }` |

Retry and legacy signatures (null intendedPalette) SHALL NOT invoke vision for color arbitration — the vision SHALL be called for semantic analysis only.

When probe is valid and intendedPalette is null (fallback_heuristic com probe):
- `primary` ← first dominant non-neutral cluster (luminance ≥ 0.25 and saturation ≥ 0.1)
- `accent` ← second dominant non-neutral cluster, or first structural cluster if only one dominant exists
- `secondary` ← accent
- `background` ← first background_candidate, or cluster with highest edgeRatio if no background candidates

When probe is empty and intendedPalette is null (fallback_heuristic sem probe):
- `primary` ← `store.brandColor ?? SEGMENT_FALLBACK`
- `secondary` ← same as primary
- `accent` ← derived from brandColor (same as primary if brandColor set, else SEGMENT_FALLBACK)
- `background` ← `'#FFFFFF'`

#### Scenario: Happy path — all_confirmed

- **WHEN** intendedPalette is valid and all colors have ∆E ≤ 18
- **THEN** `global_status` SHALL be `'all_confirmed'`
- **AND** `safe_color_tokens` SHALL match intended palette via `intendedToResolved()`
- **AND** the vision SHALL be called for semantic analysis only (no color extraction or correction)

#### Scenario: Heuristic fallback for legacy with valid probe

- **WHEN** `intendedPalette` is null
- **AND** probe returns valid non-artifact clusters
- **THEN** `global_status` SHALL be `'fallback_heuristic'`
- **AND** `safe_color_tokens.primary` SHALL be the first dominant non-neutral cluster hex
- **AND** `safe_color_tokens.accent` SHALL be the second dominant or first structural cluster hex
- **AND** `safe_color_tokens.secondary` SHALL equal `safe_color_tokens.accent`
- **AND** `safe_color_tokens.background` SHALL be the first background_candidate or highest edgeRatio cluster
- **AND** the vision SHALL be called for semantic analysis only (no color extraction or correction)

#### Scenario: Heuristic fallback for legacy with empty probe

- **WHEN** `intendedPalette` is null
- **AND** probe returns all empty arrays
- **AND** `store.brandColor` is `"#B96F63"`
- **THEN** `global_status` SHALL be `'fallback_heuristic'`
- **AND** `safe_color_tokens.primary` SHALL be `"#B96F63"`
- **AND** `safe_color_tokens.secondary` SHALL be `"#B96F63"`
- **AND** `safe_color_tokens.accent` SHALL be `"#B96F63"`
- **AND** `safe_color_tokens.background` SHALL be `"#FFFFFF"`
- **AND** the vision SHALL be called for semantic analysis only (no color extraction or correction)
