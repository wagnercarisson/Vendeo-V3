## ADDED Requirements

### Requirement: Store Brand Profiles table

The system SHALL have a `store_brand_profiles` table in the public Supabase schema created via a versioned migration file.

| Column | Type | Required | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | Yes | `gen_random_uuid()` | Primary key |
| `store_id` | `uuid` | Yes | — | FK → stores(id) |
| `source` | `text` | Yes | — | `logo_analysis` for v1 (future: `manual`, `without_logo`) |
| `active_logo_asset_id` | `uuid` | No | `null` | FK → store_brand_assets(id), points to the active original asset |
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
| `metadata` | `jsonb` | No | `null` | Model, provider, elapsedMs, error details, etc |
| `version` | `int` | Yes | `1` | Incremented on regeneration |
| `status` | `text` | Yes | `processing` | `processing`, `synced`, `outdated`, `failed`, `archived` |
| `created_at` | `timestamptz` | Yes | `now()` | Auto-set on create |
| `updated_at` | `timestamptz` | Yes | `now()` | Auto-updated on change |

The migration SHALL include:
- CHECK constraint: `status IN ('processing', 'synced', 'outdated', 'failed', 'archived')`
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

1. Created directly with status `synced` when Store Brand Director analysis completes successfully (V1)
2. Created directly with status `failed` when analysis fails (V1)
3. Previous `synced` profile becomes `outdated` when a new logo is uploaded
4. Profile becomes `archived` when logo is soft-deleted

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

### Requirement: Read brand profile — GET /api/store/[id]/brand-profile

The system SHALL expose a `GET /api/store/[id]/brand-profile` endpoint that returns the active brand profile (status = `synced`) for the store.

If no synced profile exists, the endpoint SHALL return HTTP 200 with `null` data.

#### Scenario: Active profile returned

- **WHEN** a GET request is sent to /api/store/{store_id}/brand-profile
- **AND** a synced profile exists
- **THEN** the response SHALL contain the full brand profile record

#### Scenario: No active profile returns null

- **WHEN** a GET request is sent to /api/store/{store_id}/brand-profile
- **AND** no synced profile exists
- **THEN** the response status SHALL be 200 with data set to `null`

### Requirement: Regenerate brand profile — POST /api/store/[id]/brand-profile/generate

The system SHALL expose a `POST /api/store/[id]/brand-profile/generate` endpoint that regenerates the brand profile by re-running the Store Brand Director analysis. This allows the lojista to retry after a failed analysis or request a fresh profile.

The endpoint SHALL process inline: call the LLM with the stored logo and current store data, persist the new profile, archive the previous one.

#### Scenario: Regenerate creates new profile

- **WHEN** a POST request is sent to /api/store/{store_id}/brand-profile/generate
- **AND** a previous profile exists
- **THEN** a new profile SHALL be created
- **AND** the previous profile SHALL have status changed to `outdated`

### Requirement: Update brand colors — PATCH /api/store/[id]/brand-profile/colors

The system SHALL expose a `PATCH /api/store/[id]/brand-profile/colors` endpoint that updates the `brand_colors_chosen` field of the active brand profile. This allows the lojista to change colors without regenerating the entire profile.

The endpoint SHALL accept a JSON body with `colors: string[]` (hex values). On success, the profile SHALL be updated in-place (same profile, same version).

#### Scenario: Colors updated in-place

- **WHEN** a PATCH request is sent to /api/store/{store_id}/brand-profile/colors with `{ "colors": ["#FF0000", "#00FF00"] }`
- **THEN** the active profile's `brand_colors_chosen` SHALL be updated to `["#FF0000", "#00FF00"]`
- **AND** the `updated_at` SHALL reflect the current timestamp

### Requirement: Archive brand profile — POST /api/store/[id]/brand-profile/archive

The system SHALL expose a `POST /api/store/[id]/brand-profile/archive` endpoint that archives the active brand profile by changing its status to `archived`.

#### Scenario: Active profile archived

- **WHEN** a POST request is sent to /api/store/{store_id}/brand-profile/archive
- **THEN** the active profile's status SHALL be changed to `archived`
