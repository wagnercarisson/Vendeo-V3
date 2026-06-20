> **Purpose**: Defines the logo upload system: client-server validation pipeline (format, MIME, size, dimensions), storage to Supabase bucket `store-brand-assets`, versioned asset records in `store_brand_assets`, variant generation orchestration, and endpoint contracts for upload, retrieval, version history, and soft delete.

## Requirements

### Requirement: Upload validation — format and MIME

The system SHALL accept only PNG, JPG/JPEG, and WEBP file formats for logo upload. SVG files SHALL be rejected at both client and server levels. The system SHALL validate the real MIME type server-side using sharp or file-type, not relying solely on file extension.

Formato aceito SHALL be: `.png`, `.jpg`, `.jpeg`, `.webp`.

MIME types SHALL be: `image/png`, `image/jpeg`, `image/webp`.

When an invalid format is detected, the system SHALL display the error message: "Formatos aceitos: PNG, JPG ou WEBP."

#### Scenario: Valid PNG file accepted

- **WHEN** a user uploads a file with `.png` extension and MIME type `image/png`
- **THEN** the system SHALL accept the file and proceed with processing

#### Scenario: SVG file rejected with error

- **WHEN** a user uploads a file with `.svg` extension
- **THEN** the system SHALL reject the file
- **AND** display the message: "Formatos aceitos: PNG, JPG ou WEBP."

#### Scenario: Corrupted file rejected

- **WHEN** a user uploads a file that passes extension check but sharp identifies it as corrupted or invalid
- **THEN** the system SHALL reject the file
- **AND** display an appropriate error message

### Requirement: Upload validation — file size limit

The system SHALL enforce a maximum file size of 5MB for logo uploads. If the file exceeds this limit, the system SHALL reject the upload with an inline error message before any server processing.

#### Scenario: File exceeds 5MB limit

- **WHEN** a user uploads a file larger than 5MB
- **THEN** the system SHALL reject the file
- **AND** display an inline error message indicating the size limit

#### Scenario: File under 5MB accepted

- **WHEN** a user uploads a file smaller than 5MB with a valid format
- **THEN** the system SHALL accept the file and proceed with processing

### Requirement: Upload validation — minimum dimensions

The system SHALL enforce a minimum dimension of 200x200 pixels for logo uploads. The server SHALL verify dimensions using sharp after receiving the file.

#### Scenario: Image below minimum dimensions rejected

- **WHEN** a user uploads a 100x100 pixel image
- **THEN** the system SHALL reject the file
- **AND** display an inline error about minimum dimensions

#### Scenario: Image meeting minimum dimensions accepted

- **WHEN** a user uploads a 500x500 pixel image
- **THEN** the system SHALL accept the file and proceed with processing

### Requirement: Store Brand Assets table schema

The system SHALL have a `store_brand_assets` table in the public Supabase schema created via a versioned migration file.

| Column | Type | Required | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | Yes | `gen_random_uuid()` | Primary key |
| `store_id` | `uuid` | Yes | — | FK → stores(id) |
| `asset_type` | `text` | Yes | — | `logo` (único na V3 v1) |
| `variant_type` | `text` | Yes | — | `original`, `normalized`, `on_light`, `on_dark`, `square_safe`, `horizontal_safe` |
| `source` | `text` | Yes | — | `user_upload` for original, `system_generated` for derived variants |
| `parent_asset_id` | `uuid` | No | `null` | FK → store_brand_assets(id). Null for original, points to original for variants |
| `storage_path` | `text` | No | `null` | Relative path within bucket. Nullable — pode ser null quando status = 'failed', pois o arquivo pode não ter sido gerado |
| `mime_type` | `text` | Yes | — | e.g. `image/png`, `image/jpeg`, `image/webp` |
| `width` | `int` | No | `null` | px |
| `height` | `int` | No | `null` | px |
| `size_bytes` | `int` | No | `null` | File size in bytes |
| `checksum` | `text` | No | `null` | SHA-256 of file |
| `version` | `int` | Yes | `1` | Incremented per upload cycle |
| `status` | `text` | Yes | `active` | `active`, `archived`, `failed` |
| `metadata` | `jsonb` | No | `null` | Generation params, errors, etc |
| `created_at` | `timestamptz` | Yes | `now()` | Auto-set on create |
| `updated_at` | `timestamptz` | Yes | `now()` | Auto-updated on change |

The migration SHALL include:
- CHECK constraint: `status IN ('active', 'archived', 'failed')`
- CHECK constraint: `variant_type IN ('original', 'normalized', 'on_light', 'on_dark', 'square_safe', 'horizontal_safe')`
- CHECK constraint: `source IN ('user_upload', 'system_generated')`
- CHECK constraint: `storage_path IS NOT NULL OR status IN ('failed')` — storage_path obrigatório quando active ou archived, nullable apenas quando failed
- Partial unique index: `(store_id, asset_type, variant_type)` WHERE `status = 'active'`
- Trigger for auto-updating `updated_at`

#### Scenario: Migration exists with correct schema

- **WHEN** migrations are listed
- **THEN** there SHALL be a file matching `supabase/migrations/*_create_store_brand_assets.sql`
- **AND** the file SHALL contain the `CREATE TABLE public.store_brand_assets (...)` statement with all columns

#### Scenario: Partial unique index enforces one active per variant

- **WHEN** a store already has an active `original` variant
- **AND** a second active `original` variant is inserted for the same store
- **THEN** the insert SHALL fail with a unique constraint violation

#### Scenario: CHECK constraints reject invalid values

- **WHEN** a row is inserted with status `deleted`
- **THEN** the insert SHALL fail with a CHECK constraint violation

### Requirement: Logo upload — POST /api/store/[id]/logo

The system SHALL expose a `POST /api/store/[id]/logo` endpoint that accepts a multipart/form-data file upload. The endpoint SHALL process in three sequential phases:

**Phase 1 — Pre-analysis (validation + storage):**
1. Validate format, MIME, size, and dimensions
2. Persist the original file to Supabase Storage bucket `store-brand-assets`
3. Archive previous active assets to `status = 'archived'` (prevents unique index violation before inserting new)
4. Create the corresponding `store_brand_assets` record with `variant_type = 'original'`, `source = 'user_upload'`, `parent_asset_id = null`, and `status = 'active'`
5. Trigger generation of technical variants via sharp
6. Capture `input_snapshot` of the 6 sensitive store fields (segment, subsegment, tone_of_voice, name, brand_color, accent_color)

**Phase 2 — BrandDirector (before any profile mutation):**
7. Execute the Store Brand Director analysis with the uploaded logo and current store data

**Phase 3 — Post-analysis (compensated profile transition):**

On BrandDirector SUCCESS:
8. Apply compensated transition:
   a. Mark previous synced profile as `outdated`
   b. Insert new profile with `status = 'synced'`, `source = 'logo_analysis'`, `active_logo_asset_id = originalAsset.id`, `metadata.input_snapshot` populated, `brand_colors_chosen = []`
   c. If insert fails: restore previous profile to `synced` (compensation)
9. Set `identity_state = 'logo'` and synchronize `logo_status = 'uploaded'` via IDENTITY_TO_LOGO_STATUS mapping
10. Return HTTP 201 with the created assets and profile

On BrandDirector FAILURE:
8. Previous synced profile SHALL remain `synced` (NOT marked outdated)
9. Insert new profile with `status = 'failed'`, `source = 'logo_analysis'`, `active_logo_asset_id = originalAsset.id`, `metadata.attempt_snapshot` populated with the 6 store fields
10. Set `identity_state = 'logo'` and synchronize `logo_status = 'uploaded'`
11. Return HTTP 201 with the created assets and failed profile

The `brand_colors_chosen` field SHALL NOT be populated from `logo_colors_detected`. The detected colors remain in `logo_colors_detected`, and the final palette is in `safe_color_tokens`.

The endpoint SHALL respond only after all processing is complete. It SHALL NOT use fire-and-forget, polling, or background jobs.

#### Scenario: Successful upload with compensated transition

- **WHEN** a valid logo file is uploaded via POST /api/store/{store_id}/logo
- **AND** the BrandDirector analysis succeeds
- **THEN** previous assets SHALL be archived
- **AND** a new brand profile SHALL be created with `status = 'synced'`
- **AND** the previous profile SHALL be marked `outdated`
- **AND** `identity_state` SHALL be `'logo'`
- **AND** `logo_status` SHALL be `'uploaded'`
- **AND** `brand_colors_chosen` SHALL NOT contain `logo_colors_detected`
- **AND** `metadata.input_snapshot` SHALL contain the 6 store fields at upload time

#### Scenario: Upload with BrandDirector failure preserves previous profile

- **WHEN** a valid logo file is uploaded
- **AND** the BrandDirector analysis fails
- **THEN** the previous synced profile SHALL remain `synced`
- **AND** a new profile SHALL be created with `status = 'failed'`
- **AND** `metadata.attempt_snapshot` SHALL contain the 6 store fields at attempt time
- **AND** `identity_state` SHALL still be `'logo'`
- **AND** `logo_status` SHALL still be `'uploaded'`

#### Scenario: Insert failure triggers compensation

- **WHEN** the BrandDirector analysis succeeds
- **AND** the previous profile is marked `outdated`
- **AND** the new profile insert fails (constraint violation, network error)
- **THEN** the previous profile SHALL be restored to `synced`
- **AND** `identity_state` SHALL be set to `'logo'`
- **AND** `logo_status` SHALL be set to `'uploaded'`
- **AND** the new assets SHALL remain `active`

#### Scenario: Invalid file returns 400

- **WHEN** an SVG file is uploaded via POST /api/store/{store_id}/logo
- **THEN** the response status SHALL be 400
- **AND** the response body SHALL contain the error message: "Formatos aceitos: PNG, JPG ou WEBP."

#### Scenario: Oversized file returns 400

- **WHEN** a file larger than 5MB is uploaded
- **THEN** the response status SHALL be 400
- **AND** the response body SHALL indicate the size limit exceeded

### Requirement: identity_state sync on logo upload

Every logo upload (POST /logo) SHALL update the store's `identity_state` in the same operation. The value SHALL be determined by the IDENTITY_TO_LOGO_STATUS mapping:

```typescript
const IDENTITY_TO_LOGO_STATUS: Record<string, string | null> = {
  'text_only': 'explicit_none',
  'logo': 'uploaded',
  'visual_signature': 'generated',
};
```

When upload completes (regardless of BrandDirector success or failure), `identity_state` SHALL be set to `'logo'` and `logo_status` SHALL be set to `'uploaded'` in the same UPDATE statement.

#### Scenario: identity_state set to logo on upload

- **WHEN** a logo upload completes (success or failed analysis)
- **THEN** `stores.identity_state` SHALL be `'logo'`
- **AND** `stores.logo_status` SHALL be `'uploaded'`

### Requirement: input_snapshot capture on synced profiles

When a brand profile is created with `status = 'synced'` during logo upload, the system SHALL populate `metadata.input_snapshot` with the current visual state. The snapshot SHALL contain exactly 6 fields:

```json
{
  "segment": "moda-vestuario",
  "subsegment": "moda-feminina",
  "tone_of_voice": "elegante",
  "name": "Maria Boutique",
  "brand_color": "#C41E3A",
  "accent_color": "#2D2D2D"
}
```

`accent_color` resolution priority: `brand_colors_chosen[1]` → `safe_color_tokens.accent` → `inferred_accent_color` → `null`.

#### Scenario: input_snapshot populated on synced profile

- **WHEN** a synced brand profile is created from logo upload
- **THEN** `metadata.input_snapshot` SHALL contain the 6 fields with current store values
- **AND** `accent_color` SHALL follow the resolution priority

#### Scenario: input_snapshot NOT populated on failed profile

- **WHEN** a failed brand profile is created from logo upload (BrandDirector failure)
- **THEN** `metadata.input_snapshot` SHALL NOT be set
- **AND** `metadata.attempt_snapshot` SHALL be used instead

### Requirement: attempt_snapshot capture on failed profiles

When a brand profile is created with `status = 'failed'` during logo upload (BrandDirector failure), the system SHALL populate `metadata.attempt_snapshot` with the same 6 fields as `input_snapshot`. The `attempt_snapshot` serves as an audit trail — it records the state of the store at the time of the failed attempt.

`attempt_snapshot` SHALL NOT be used as a drift baseline. Only `input_snapshot` on synced profiles serves that purpose.

#### Scenario: attempt_snapshot populated on failed profile

- **WHEN** a failed brand profile is created from logo upload
- **THEN** `metadata.attempt_snapshot` SHALL contain the 6 fields with current store values
- **AND** `metadata.input_snapshot` SHALL NOT be set

### Requirement: identity_state validation on logo upload

The system SHALL validate `stores.identity_state` before processing any logo upload. If `identity_state = 'visual_signature'`, the endpoint SHALL reject the upload with HTTP 409:

```json
{
  "error": "Remova a assinatura visual ativa antes de enviar um logotipo.",
  "requires_identity_removal": true,
  "current_identity_state": "visual_signature"
}
```

The validation SHALL use `stores.identity_state` as the source of truth — NOT the status of `store_visual_signatures` or `store_brand_profiles`. This is consistent with the rule that all transitions between active identities must go through `text_only`.

#### Scenario: Upload rejected when identity_state is visual_signature

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo`
- **AND** `stores.identity_state` is `'visual_signature'`
- **THEN** HTTP 409 SHALL be returned
- **AND** `requires_identity_removal` SHALL be `true`
- **AND** `current_identity_state` SHALL be `'visual_signature'`

#### Scenario: Upload permitted when identity_state is text_only or logo

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo`
- **AND** `stores.identity_state` is `'text_only'` or `'logo'`
- **THEN** the upload SHALL proceed normally
- **AND** no identity_state validation error SHALL be returned

### Requirement: brand_colors_chosen isolation on logo upload

The system SHALL NOT populate `brand_colors_chosen` with `logo_colors_detected` during logo upload. The `brand_colors_chosen` field is reserved exclusively for colors explicitly chosen by the user via the color picker. The detected colors SHALL remain in `logo_colors_detected`, and the final campaign palette SHALL be consumed from `safe_color_tokens`.

#### Scenario: brand_colors_chosen empty after upload

- **WHEN** a synced brand profile is created from logo upload
- **AND** the user did not manually choose colors
- **THEN** `brand_colors_chosen` SHALL be `[]`
- **AND** `logo_colors_detected` SHALL contain the extracted colors
- **AND** `safe_color_tokens` SHALL contain the final palette

### Requirement: Logo versioning

Each new logo upload SHALL create a new set of store_brand_assets records with an incremented `version` number. The previous active assets (original + all technical variants from the previous cycle) SHALL have their status changed to `archived`.

The `version` field SHALL increment per upload cycle for a given store_id. Deleted or archived assets SHALL retain their version number for historical tracking.

Assets SHALL NEVER be physically deleted. The `archived` status SHALL be used for soft removal.

#### Scenario: New upload archives previous version

- **WHEN** a new logo is uploaded for a store that already has an active logo
- **THEN** the previous active store_brand_assets records SHALL have status changed to `archived`
- **AND** the new assets SHALL be created with `version` incremented by 1
- **AND** the partial unique index SHALL allow exactly one active record per (store_id, asset_type, variant_type)

#### Scenario: Archived assets are never deleted

- **WHEN** a logo is replaced
- **THEN** the previous assets SHALL remain in storage and in the database with status `archived`
- **AND** no physical deletion SHALL occur

### Requirement: Logo removal — soft delete

The system SHALL expose a `DELETE /api/store/[id]/logo` endpoint that performs a soft delete. The active store_brand_assets records SHALL have status changed to `archived`. The associated brand profile SHALL remain `synced` (direction visual is preserved, not archived). The `active_logo_asset_id` FK on the profile SHALL be preserved (provenance link to the original asset is maintained). The assets in storage SHALL NOT be deleted.

The endpoint SHALL also update the store's `identity_state` to `'text_only'` and synchronize `logo_status` to `'explicit_none'`.

#### Scenario: Soft delete archives assets, preserves profile synced

- **WHEN** a DELETE request is sent to /api/store/{store_id}/logo
- **THEN** the active store_brand_assets for that store SHALL have status changed to `archived`
- **AND** the active brand profile SHALL remain `synced` (NOT archived)
- **AND** the profile's `active_logo_asset_id` SHALL be preserved
- **AND** the store's `identity_state` SHALL be set to `'text_only'`
- **AND** the store's `logo_status` SHALL be set to `'explicit_none'`
- **AND** the storage files SHALL NOT be deleted

### Requirement: Logo retrieval — GET /api/store/[id]/logo

The system SHALL expose a `GET /api/store/[id]/logo` endpoint that returns the active logo data, including all active technical variants (original, normalized, on_light, on_dark, square_safe, horizontal_safe).

#### Scenario: Active logo returned with variants

- **WHEN** a GET request is sent to /api/store/{store_id}/logo
- **AND** the store has an active logo
- **THEN** the response SHALL contain the original asset and all active technical variants
- **AND** each variant SHALL include storage_path, mime_type, width, height, and variant_type

#### Scenario: No logo returns empty

- **WHEN** a GET request is sent to /api/store/{store_id}/logo
- **AND** the store has no active logo
- **THEN** the response SHALL be HTTP 200 with empty data or null

### Requirement: Logo versions history — GET /api/store/[id]/logo/versions

The system SHALL expose a `GET /api/store/[id]/logo/versions` endpoint that returns the version history of all logo uploads, including archived versions, ordered by version descending.

Each entry SHALL include version number, original asset URL, creation date, and status (active, archived, failed).

#### Scenario: Version history returned

- **WHEN** a GET request is sent to /api/store/{store_id}/logo/versions
- **AND** the store has at least one logo upload
- **THEN** the response SHALL contain an array of version entries ordered by version descending
- **AND** each entry SHALL include version, status, and original asset URL
