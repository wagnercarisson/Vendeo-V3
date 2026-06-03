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

The system SHALL expose a `POST /api/store/[id]/logo` endpoint that accepts a multipart/form-data file upload.

The endpoint SHALL process inline: validate format, MIME, size, and dimensions, persist the original file to Supabase Storage bucket `store-brand-assets`, create the corresponding `store_brand_assets` record with `variant_type = 'original'`, `source = 'user_upload'`, `parent_asset_id = null`, and `status = 'active'`, trigger generation of technical variants via sharp, and execute the Store Brand Director analysis.

The endpoint SHALL respond only after all processing is complete. It SHALL NOT use fire-and-forget, polling, or background jobs. If the analysis fails, the brand profile SHALL be persisted with status `failed` and metadata containing the error details.

On success, the endpoint SHALL return HTTP 201 with the created store_brand_assets record and the associated brand profile.

#### Scenario: Successful logo upload returns 201

- **WHEN** a valid logo file is uploaded via POST /api/store/{store_id}/logo
- **THEN** the response status SHALL be 201
- **AND** the response body SHALL contain the created store_brand_assets record with variant_type `original` and status `active`
- **AND** a brand profile SHALL be created with status `synced` or `failed`

#### Scenario: Invalid file returns 400

- **WHEN** an SVG file is uploaded via POST /api/store/{store_id}/logo
- **THEN** the response status SHALL be 400
- **AND** the response body SHALL contain the error message: "Formatos aceitos: PNG, JPG ou WEBP."

#### Scenario: Oversized file returns 400

- **WHEN** a file larger than 5MB is uploaded
- **THEN** the response status SHALL be 400
- **AND** the response body SHALL indicate the size limit exceeded

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

The system SHALL expose a `DELETE /api/store/[id]/logo` endpoint that performs a soft delete. The active store_brand_assets records SHALL have status changed to `archived`. The associated brand profile SHALL have status changed to `archived`. The assets in storage SHALL NOT be deleted.

#### Scenario: Soft delete archives assets and profile

- **WHEN** a DELETE request is sent to /api/store/{store_id}/logo
- **THEN** the active store_brand_assets for that store SHALL have status changed to `archived`
- **AND** the active brand profile SHALL have status changed to `archived`
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
