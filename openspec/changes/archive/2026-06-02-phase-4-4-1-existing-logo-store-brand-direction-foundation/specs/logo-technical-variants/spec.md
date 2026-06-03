## ADDED Requirements

### Requirement: Technical variant generation on upload

When a logo is uploaded via `POST /api/store/[id]/logo`, the system SHALL generate the following technical variants using sharp (server-side image processing):

| Variant | Technique |
|---------|-----------|
| `original` | Exact copy of the uploaded file, no transformation |
| `normalized` | Resize to fit within 500x500 canvas with transparent background, preserving aspect ratio |
| `on_light` | Normalized variant overlaid on solid white (#FFFFFF) background |
| `on_dark` | Normalized variant overlaid on solid dark (#1A1A2E) background |
| `square_safe` | Normalized image centered in a 500x500 square canvas with transparent background |
| `horizontal_safe` | Normalized image centered in an 800x300 horizontal canvas with transparent background |

Each derived variant SHALL be persisted as an independent record in `store_brand_assets` with:
- `asset_type` = `logo`
- `source` = `system_generated`
- `parent_asset_id` pointing to the `original` asset's id
- `status` = `active` (or `failed` if generation fails)
- `variant_type` matching the variant name above

The original asset SHALL have `source = 'user_upload'` and `parent_asset_id = null`, as set by the upload endpoint.

If a variant generation fails, the system SHALL record its status as `failed` with error details in metadata. The failure of one variant SHALL NOT block the remaining variants or the overall upload.

#### Scenario: All six technical variants created

- **WHEN** a valid logo file is uploaded and processed
- **THEN** six store_brand_assets records SHALL be created: one original and five derived variants
- **AND** each derived variant SHALL have `parent_asset_id` pointing to the original asset's id
- **AND** all variants SHALL have status `active`

#### Scenario: Individual variant failure does not block others

- **WHEN** a variant generation fails (e.g., on_dark generation errors)
- **THEN** the failed variant SHALL have status `failed` with error details in metadata
- **AND** the remaining variants SHALL still be created with status `active`
- **AND** the upload SHALL still succeed with partial results

### Requirement: Technical variant presets for campaign usage

The system SHALL select the appropriate technical variant based on availability, preferring the most faithful representation of the original logo:

1. `normalized` — preferred variant: preserves logo with transparency, resized to fit 500x500 canvas
2. `original` — fallback when normalized is unavailable
3. `on_dark` — secondary fallback, only when original also unavailable

When none of the logo variants are available, the system SHALL fall through to visual signature or store name text.

The variant resolution SHALL be performed at the `StoreIdentitySnapshot` level (`resolveStoreIdentity`), not per-renderer, because the campaign renderer receives the logo as an overlay element and `normalized` (transparent background) is the most versatile variant for any canvas composition.

#### Scenario: Variant resolved in normalized > original > on_dark order

- **WHEN** a campaign preview is rendered and a logo exists
- **THEN** the system SHALL select the `normalized` variant as the primary logo
- **AND** if `normalized` is unavailable, SHALL use `original`
- **AND** if `original` is also unavailable, SHALL use `on_dark`

#### Scenario: Fallback when no logo variant available

- **WHEN** no logo variants are active or available
- **THEN** the system SHALL render the visual signature or store name as text fallback

### Requirement: Variants archived with original on replacement

When a new logo is uploaded, all technical variants from the previous cycle SHALL be archived together with the original. The system SHALL change status from `active` to `archived` for all store_brand_assets records with the previous version number for that store.

#### Scenario: All variants archived on new upload

- **WHEN** a new logo replaces an existing one
- **THEN** all previous technical variants SHALL have status changed to `archived`
- **AND** their `version` number SHALL be preserved for history

### Requirement: Variants not exposed in UI

The system SHALL NOT expose technical variants, their statuses, or any processing details to the lojista in the UI. The lojista SHALL see only the original logo preview and a simple processing status indicator.

#### Scenario: UI shows only original preview

- **WHEN** a lojista views the store identity page after upload
- **THEN** the UI SHALL display only the original logo preview
- **AND** no variant types, variant statuses, or technical details SHALL be shown
