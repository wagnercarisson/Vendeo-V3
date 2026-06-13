> **Purpose**: Defines the store brand profile system: the `store_brand_profiles` table, lifecycle management (synced/failed/outdated/archived), inline AI analysis integration via Store Brand Director, and controlled API endpoints for reading, regenerating, updating colors, and archiving profiles.

## Requirements

### Requirement: Store Brand Profiles table

The system SHALL have a `store_brand_profiles` table in the public Supabase schema created via a versioned migration file.

| Column | Type | Required | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | Yes | `gen_random_uuid()` | Primary key |
| `store_id` | `uuid` | Yes | — | FK → stores(id) |
| `source` | `text` | Yes | — | `logo_analysis`, `without_logo`, `text_only` |
| `active_logo_asset_id` | `uuid` | No | `null` | FK → store_brand_assets(id), points to the active original asset. Null when source = without_logo or text_only |
| `logo_colors_detected` | `jsonb` | No | `null` | Array of hex color strings detected from logo analysis |
| `brand_colors_chosen` | `jsonb` | No | `null` | Array of hex color strings chosen by the lojista |
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
| → `manual_color_override` | `jsonb` | No | `{"enabled": false}` | Tracks whether the user manually overrode colors at the profile level |
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

### Requirement: Brand profile lifecycle

Profiles SHALL follow this lifecycle:

1. Created directly with status `synced` when analysis completes successfully (V1)
2. Created directly with status `failed` when analysis fails (V1)
3. Previous `synced` profile becomes `outdated` ONLY when a NEW profile is created with status `synced` — if the new profile fails, the previous synced profile SHALL remain unchanged
4. Profile becomes `archived` when logo is soft-deleted

If a new logo is uploaded for a store that previously had a brand profile with source `without_logo`, and the new profile is created with status `synced`, the without_logo profile SHALL be marked `outdated`.

For `source = 'text_only'` profiles, the lifecycle rules apply equally:
- A new text_only inference marks the previous synced text_only profile as `outdated`
- Text_only profiles created as `failed` do NOT mark previous synced profiles as outdated
- Profile reactivation (when user transitions back to text_only from logo or visual_signature) is NOT implemented in this phase — profiles are only created and marked outdated, never reactivated

**Nota**: O status `processing` existe no modelo e no banco como reservado para uso futuro com fila/job durável. Na V1, o profile é sempre criado como `synced` ou `failed` diretamente — não passa por `processing`.

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

The brand profile SHALL be generated inline during the `POST /api/store/[id]/logo` request. The system SHALL:
1. Send the logo image and store data to the LLM
2. Parse the structured JSON response
3. Persist the profile with status `synced` on success, `failed` on failure
4. Respond only after the operation completes

The `processing` status exists in the model as a reserved status for future use with a durable job queue. In V1, the profile SHALL be created directly as `synced` or `failed` — no transition through `processing`.

#### Scenario: Profile generated inline during upload

- **WHEN** a valid logo is uploaded
- **THEN** the Store Brand Director LLM call SHALL execute within the same request
- **AND** the response SHALL NOT be sent until the profile is persisted

#### Scenario: Failed analysis returns failed profile

- **WHEN** the Store Brand Director LLM call fails
- **THEN** the brand profile SHALL be persisted with status `failed`
- **AND** error details SHALL be recorded in metadata
- **AND** the upload endpoint SHALL still return success (logo persists, profile indicates failure)

### Requirement: Brand profile generation — text_only inference

**ADDED**: A new generation mode is introduced for `source = 'text_only'`. The profile SHALL be generated via `POST /api/store/[id]/brand-profile/infer`. This is separate from the logo upload and visual signature approval flows.

The inference SHALL:
1. Load store data (name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state)
2. Accept optional user color preferences
3. Call the BrandTextOnlyInferenceService
4. Populate `metadata.input_snapshot` with the current visual state for all 6 sensitive fields (segment, subsegment, tone_of_voice, name, brand_color, accent_color)
5. Persist with `source = 'text_only'` and `status = 'synced'` on success, `'failed'` on failure
6. Respond only after the operation completes

The inference response SHALL include `profile.metadata` (containing `input_snapshot`) so the frontend can use it for color hydration after re-inference.

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

The endpoint SHALL accept a JSON body with `colors: string[]` (hex values). On success, the profile SHALL be updated in-place (same profile, same version).

When updating colors for a `source = 'text_only'` profile:
1. `brand_colors_chosen` SHALL be updated with the new colors
2. `manual_color_override.enabled` in the profile SHALL be set to `true`
3. `stores.manual_color_override` SHALL be set to `true`
4. `safe_color_tokens` SHALL NOT change — the user's color choice does not override the campaign palette
5. `stores.brand_color` sync is NOT part of this endpoint — sync from `safe_color_tokens.primary` happens only in the inference service

#### Scenario: Colors updated in-place

- **WHEN** a PATCH request is sent to /api/store/{store_id}/brand-profile with `{ "colors": ["#FF0000", "#00FF00"] }`
- **THEN** the active profile's `brand_colors_chosen` SHALL be updated to `["#FF0000", "#00FF00"]`
- **AND** the `updated_at` SHALL reflect the current timestamp

#### Scenario: PATCH updates brand_colors_chosen for text_only

- **WHEN** a PATCH request is sent for a store with `source = 'text_only'` profile
- **AND** body contains `{ "colors": ["#FF6600", "#E8A040"] }`
- **THEN** `brand_colors_chosen` SHALL be updated to `["#FF6600", "#E8A040"]`
- **AND** `safe_color_tokens` SHALL remain unchanged

### Requirement: Archive brand profile — POST /api/store/[id]/brand-profile/archive

The system SHALL expose a `POST /api/store/[id]/brand-profile/archive` endpoint that archives the active brand profile by changing its status to `archived`.

#### Scenario: Active profile archived

- **WHEN** a POST request is sent to /api/store/{store_id}/brand-profile/archive
- **THEN** the active profile's status SHALL be changed to `archived`
