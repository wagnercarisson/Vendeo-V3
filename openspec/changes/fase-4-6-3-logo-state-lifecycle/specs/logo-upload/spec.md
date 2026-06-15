> **Purpose**: Delta spec for logo-upload changes in fase 4.6.3 — reordered BrandDirector execution, compensated profile transition, identity_state sync, input_snapshot/attempt_snapshot capture, brand_colors_chosen isolation.

## MODIFIED Requirements

### Requirement: Logo upload — POST /api/store/[id]/logo

The system SHALL expose a `POST /api/store/[id]/logo` endpoint that accepts a multipart/form-data file upload. The endpoint SHALL process in three sequential phases:

**Phase 1 — Pre-analysis (validation + storage):**
1. Validate format, MIME, size, and dimensions
2. Persist the original file to Supabase Storage bucket `store-brand-assets`
3. Archive previous active assets to `status = 'archived'` (antes de inserir novo, para não violar o índice único parcial `(store_id, asset_type, variant_type) WHERE status = 'active'`)
4. Create the corresponding `store_brand_assets` record with `variant_type = 'original'`, `source = 'user_upload'`, `parent_asset_id = null`, and `status = 'active'`
5. Trigger generation of technical variants via sharp
6. Capture `input_snapshot` of the 6 sensitive store fields (segment, subsegment, tone_of_voice, name, brand_color, accent_color)

**Phase 2 — BrandDirector (before any profile mutation):**
7. Execute the Store Brand Director analysis with the uploaded logo and current store data

**Phase 3 — Post-analysis (compensated profile transition):**

On BrandDirector SUCCESS:
8. Apply compensated transition:
   a. Mark previous synced profile as `outdated`
   b. Insert new profile with `status = 'synced'`, `source = 'logo_analysis'`, `active_logo_asset_id = originalAsset.id`, `metadata.input_snapshot` populated
   c. If insert fails: restore previous profile to `synced` (compensation), set `identity_state = 'logo'`, `logo_status = 'uploaded'`
9. Set `identity_state = 'logo'` and synchronize `logo_status = 'uploaded'` via IDENTITY_TO_LOGO_STATUS mapping
10. Return HTTP 201 with the created assets and profile

On BrandDirector FAILURE:
8. Previous synced profile SHALL remain `synced` (NOT marked outdated)
9. Insert new profile with `status = 'failed'`, `source = 'logo_analysis'`, `active_logo_asset_id = originalAsset.id`, `metadata.attempt_snapshot` populated with the 6 store fields
10. Set `identity_state = 'logo'` and synchronize `logo_status = 'uploaded'`
11. Return HTTP 201 with the created assets and failed profile

The `brand_colors_chosen` field SHALL NOT be populated from `logo_colors_detected`. The detected colors remain in `logo_colors_detected`, and the final palette is in `safe_color_tokens`.

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
- **AND** the compensation marks the previous profile as `outdated`
- **AND** the new profile insert fails (constraint violation, network error)
- **THEN** the previous profile SHALL be restored to `synced`
- **AND** `identity_state` SHALL be set to `'logo'`
- **AND** `logo_status` SHALL be set to `'uploaded'`
- **AND** the new assets SHALL remain `active`

### Requirement: Logo removal — soft delete

A especificação base já reflete o comportamento correto para REMOVE. Esta fase confirma e não altera o contrato existente. The system SHALL expose a `DELETE /api/store/[id]/logo` endpoint that performs a soft delete. The active store_brand_assets records SHALL have status changed to `archived`. The associated brand profile SHALL remain `synced` (direction visual is preserved, not archived). The `active_logo_asset_id` FK on the profile SHALL be preserved (provenance link to the original asset is maintained). The assets in storage SHALL NOT be deleted.

The endpoint SHALL also update the store's `identity_state` to `'text_only'` and synchronize `logo_status` to `'explicit_none'`.

#### Scenario: Soft delete archives assets, preserves profile synced

- **WHEN** a DELETE request is sent to /api/store/{store_id}/logo
- **THEN** the active store_brand_assets for that store SHALL have status changed to `archived`
- **AND** the active brand profile SHALL remain `synced` (NOT archived)
- **AND** the profile's `active_logo_asset_id` SHALL be preserved
- **AND** the store's `identity_state` SHALL be set to `'text_only'`
- **AND** the store's `logo_status` SHALL be set to `'explicit_none'`
- **AND** the storage files SHALL NOT be deleted

## ADDED Requirements

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

### Requirement: brand_colors_chosen isolation on logo upload

The system SHALL NOT populate `brand_colors_chosen` with `logo_colors_detected` during logo upload. The `brand_colors_chosen` field is reserved exclusively for colors explicitly chosen by the user via the color picker. The detected colors SHALL remain in `logo_colors_detected`, and the final campaign palette SHALL be consumed from `safe_color_tokens`.

#### Scenario: brand_colors_chosen empty after upload

- **WHEN** a synced brand profile is created from logo upload
- **AND** the user did not manually choose colors
- **THEN** `brand_colors_chosen` SHALL be `[]`
- **AND** `logo_colors_detected` SHALL contain the extracted colors
- **AND** `safe_color_tokens` SHALL contain the final palette
