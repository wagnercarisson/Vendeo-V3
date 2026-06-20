> **Purpose**: Defines the logo history and restore system: listing archived logos with associated brand profiles via the `active_logo_asset_id` FK, and restoring a historical version with drift validation.

## Requirements

### Requirement: Logo history — GET /api/store/[id]/logo/history

The system SHALL expose a `GET /api/store/[id]/logo/history` endpoint that returns all archived logo versions with their associated brand profiles. The endpoint SHALL:

1. Query `store_brand_assets` with `variant_type = 'original'` and `status = 'archived'` for the given store
2. LEFT JOIN `store_brand_profiles` on `store_brand_profiles.active_logo_asset_id = store_brand_assets.id`
3. Order results by `store_brand_assets.version` DESC
4. For each item, compute `drift_status` server-side by comparing the profile's `input_snapshot` (if available) against the current store's 6 sensitive fields
5. Return an array of objects, each containing the asset record, the associated profile record (or null), the created_at timestamp, and the pre-computed `drift_status`

When resolving the associated profile for an archived asset, the query SHALL order profiles by `created_at ASC` to ensure the oldest profile (created at original upload time) is used for drift computation, avoiding masking by newer profiles created during restore-with-drift operations.

#### Scenario: Returns archived logos with profiles and drift status

- **WHEN** a GET request is sent to `/api/store/{store_id}/logo/history`
- **AND** the store has 2 archived logo versions with associated profiles
- **THEN** the response SHALL return an array of 2 items ordered by version descending
- **AND** each item SHALL contain `asset`, `profile`, `version`, `created_at`, `visual_style`, `safe_color_tokens`, `input_snapshot`, and `drift_status`

#### Scenario: Returns empty array when no history

- **WHEN** a GET request is sent to `/api/store/{store_id}/logo/history`
- **AND** the store has no archived logo versions
- **THEN** the response SHALL return an empty array

#### Scenario: Returns profile null when no associated profile

- **WHEN** a GET request is sent to `/api/store/{store_id}/logo/history`
- **AND** an archived asset exists but no profile has `active_logo_asset_id` pointing to it
- **THEN** the `profile` field for that item SHALL be `null`
- **AND** `visual_style`, `safe_color_tokens`, `input_snapshot`, and `drift_status` SHALL be `null`

### Requirement: Logo restore — POST /api/store/[id]/logo/restore

The system SHALL expose a `POST /api/store/[id]/logo/restore` endpoint that restores a historical logo version. The endpoint SHALL:

1. Accept `{ "asset_id": string }` — the ID of the original archived asset to restore
2. Validate that the `asset_id` belongs to the requesting store_id and has `status = 'archived'`
3. Archive any currently active assets (prevents unique index violation before re-activating restored assets)
4. Load the associated brand profile via `active_logo_asset_id = asset_id` (may be null)
5. If a profile exists, extract `metadata.input_snapshot` for drift validation
6. Compare the 6 sensitive fields from `input_snapshot` against the current store values
7. Execute the appropriate restore path based on drift status

#### Scenario: Invalid asset_id returns 400

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo/restore`
- **AND** `asset_id` does not belong to the store's archived assets
- **THEN** HTTP 400 SHALL be returned with an error message

#### Scenario: Asset_id without profile

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo/restore`
- **AND** the asset exists and is archived
- **AND** no brand profile has `active_logo_asset_id` pointing to this asset
- **THEN** any currently active assets SHALL be archived first
- **AND** the restored assets SHALL be re-activated to `status = 'active'`
- **AND** `identity_state` SHALL be set to `'logo'`
- **AND** `logo_status` SHALL be set to `'uploaded'`

### Requirement: Restore without drift

When `input_snapshot` matches the current store values for all 6 sensitive fields, the system SHALL execute the no-drift restore path:

1. Archive any currently active assets
2. If the chosen profile is already the active synced profile (post-remove scenario): do NOT mark it as outdated — only re-activate the assets
3. Otherwise: mark the current active profile as `outdated`, then re-activate the chosen profile to `synced`
4. Re-activate the chosen assets to `status = 'active'`
5. Set `identity_state = 'logo'` and `logo_status = 'uploaded'`

#### Scenario: Restore without drift reactivates profile and assets

- **WHEN** the user restores a historical logo version
- **AND** all 6 sensitive fields match between `input_snapshot` and current store data
- **AND** the chosen profile is NOT the current active synced profile
- **THEN** any currently active assets SHALL be archived
- **AND** the current active profile SHALL be marked `outdated`
- **AND** the chosen profile SHALL be re-activated to `synced`
- **AND** the chosen assets SHALL be re-activated to `active`
- **AND** `identity_state` SHALL be set to `'logo'`
- **AND** `logo_status` SHALL be set to `'uploaded'`

#### Scenario: Restore without drift when profile already synced

- **WHEN** the user restores a historical logo version
- **AND** all 6 sensitive fields match
- **AND** the chosen profile IS the current active synced profile (post-remove)
- **THEN** any currently active assets SHALL be archived
- **AND** the profile SHALL NOT be marked `outdated`
- **AND** the chosen assets SHALL be re-activated to `active`
- **AND** `identity_state` SHALL be set to `'logo'`

### Requirement: Restore with drift

When `input_snapshot` differs from the current store values for any of the 6 sensitive fields, the system SHALL execute the drift restore path:

1. Archive any currently active assets
2. Execute the BrandDirector with the restored logo image and current store data
3. Mark the current active profile as `outdated`
4. Create a NEW brand profile with status `synced` from the BrandDirector result, explicitando:
   - `source = 'logo_analysis'`
   - `active_logo_asset_id = asset_id` (asset escolhido no restore)
   - `metadata.input_snapshot` com os 6 campos atuais da loja
   - `brand_colors_chosen` NÃO recebe cores detectadas (isolamento mantido)
   - `safe_color_tokens` recebe a paleta final do BrandDirector
5. The historical profile SHALL NOT be re-activated — it remains with its current status
6. Re-activate the chosen assets to `status = 'active'`
7. Set `identity_state = 'logo'` and `logo_status = 'uploaded'`

The system SHALL NOT offer a "Restore anyway" option — realignment is mandatory when drift is detected.

#### Scenario: Restore with drift creates new synced profile

- **WHEN** the user restores a historical logo version
- **AND** at least one of the 6 sensitive fields differs between `input_snapshot` and current store data
- **THEN** any currently active assets SHALL be archived
- **AND** the BrandDirector SHALL be executed with the restored logo and current store data
- **AND** the current active profile SHALL be marked `outdated`
- **AND** a NEW profile SHALL be created with `status = 'synced'` and `source = 'logo_analysis'`
- **AND** `active_logo_asset_id` SHALL be set to the restored `asset_id`
- **AND** `metadata.input_snapshot` SHALL contain the 6 current store fields
- **AND** `brand_colors_chosen` SHALL NOT receive detected colors
- **AND** the restored assets SHALL be re-activated to `active`
- **AND** `identity_state` SHALL be set to `'logo'`

#### Scenario: Historical profile not reactivated on drift

- **WHEN** the drift restore path is executed
- **THEN** the historical profile chosen for restore SHALL NOT have its status changed to `synced`
- **AND** it SHALL retain its current status (outdated, synced, or failed)

#### Scenario: BrandDirector failure on drift restore

- **WHEN** the BrandDirector analysis fails during drift restore
- **THEN** the current active profile SHALL remain `synced` (fallback preserved)
- **AND** a new profile SHALL be created with `status = 'failed'`
- **AND** `active_logo_asset_id` SHALL be set to the restored `asset_id`
- **AND** `metadata.attempt_snapshot` SHALL contain the 6 current store fields
- **AND** `metadata.input_snapshot` SHALL NOT be set on the failed profile
- **AND** the restored assets SHALL still be re-activated to `active`
- **AND** `identity_state` SHALL still be set to `'logo'`
- **AND** `logo_status` SHALL be set to `'uploaded'`

### Requirement: identity_state validation on logo restore

The system SHALL validate `stores.identity_state` before processing any logo restore request. Logo restore SHALL only be permitted when `identity_state = 'text_only'` — toda mudança de identidade ativa passa por text_only.

If `identity_state = 'visual_signature'`, the endpoint SHALL reject with HTTP 409:
```json
{
  "error": "Remova a assinatura visual ativa antes de restaurar um logotipo.",
  "requires_identity_removal": true,
  "current_identity_state": "visual_signature"
}
```

If `identity_state = 'logo'`, the endpoint SHALL also reject with HTTP 409 — o logo ativo deve ser removido primeiro:
```json
{
  "error": "Remova o logotipo ativo antes de restaurar outro logotipo.",
  "requires_logo_removal": true,
  "current_identity_state": "logo"
}
```

The validation SHALL use `stores.identity_state` as the source of truth — NOT the status of assets or profiles.

#### Scenario: Restore rejected when identity_state is visual_signature

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo/restore`
- **AND** `stores.identity_state` is `'visual_signature'`
- **THEN** HTTP 409 SHALL be returned
- **AND** `requires_identity_removal` SHALL be `true`
- **AND** `current_identity_state` SHALL be `'visual_signature'`

#### Scenario: Restore rejected when identity_state is logo

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo/restore`
- **AND** `stores.identity_state` is `'logo'`
- **THEN** HTTP 409 SHALL be returned
- **AND** `requires_logo_removal` SHALL be `true`
- **AND** `current_identity_state` SHALL be `'logo'`

#### Scenario: Restore permitted only in text_only state

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo/restore`
- **AND** `stores.identity_state` is `'text_only'`
- **THEN** the restore SHALL proceed normally

### Requirement: Drift validation — sensitive field comparison

The system SHALL compare exactly 6 sensitive fields between `input_snapshot` and the current store values:

- `segment`
- `subsegment`
- `tone_of_voice`
- `name`
- `brand_color`
- `accent_color` (resolved from `brand_colors_chosen[1]` → `safe_color_tokens.accent` → `inferred_accent_color` → `null`)

A field is considered different if the string values are not strictly equal (case-sensitive). If `input_snapshot` is missing or null, the system SHALL treat it as drift (conservative approach).

#### Scenario: All fields match = no drift

- **WHEN** all 6 sensitive fields in `input_snapshot` match current store values exactly
- **THEN** drift status SHALL be `none`

#### Scenario: Any field differs = drift

- **WHEN** at least one of the 6 sensitive fields differs
- **THEN** drift status SHALL be `drift`
- **AND** the drift restore path SHALL be executed

#### Scenario: Missing input_snapshot = drift

- **WHEN** the historical profile has no `metadata.input_snapshot`
- **THEN** the system SHALL treat this as drift
- **AND** execute the drift restore path
