## MODIFIED Requirements

### Requirement: Drift validation — sensitive field comparison

The system SHALL compare exactly 4 `DRIFT_FIELDS` between `input_snapshot` and the current store values:

- `segment`
- `subsegment`
- `tone_of_voice`
- `name`

`brand_color`, `accent_color`, `positioning`, `short_description`, and `slogan` SHALL NOT be compared for drift in the restore flow.

A field is considered different if the string values are not strictly equal. `null` and `undefined` SHALL be normalized to empty string before comparison, matching the drift detection contract. If `input_snapshot` is missing or null, the system SHALL treat it as drift (conservative approach).

The comparison SHALL use `DRIFT_FIELDS` constant from `drift.ts` instead of a hardcoded field list.

#### Scenario: All fields match on DRIFT_FIELDS = no drift

- **WHEN** all 4 `DRIFT_FIELDS` in `input_snapshot` match current store values after normalization
- **THEN** drift status SHALL be `none`

#### Scenario: Only brand_color differs = no drift

- **WHEN** all 4 `DRIFT_FIELDS` in `input_snapshot` match current store values
- **AND** only `brand_color` differs (which is not in `DRIFT_FIELDS`)
- **THEN** drift status SHALL be `none`

#### Scenario: Any DRIFT_FIELD differs = drift

- **WHEN** at least one of the 4 `DRIFT_FIELDS` differs after normalization
- **THEN** drift status SHALL be `drift`
- **AND** the drift restore path SHALL be executed

#### Scenario: Missing input_snapshot = drift

- **WHEN** the historical profile has no `metadata.input_snapshot`
- **THEN** the system SHALL treat this as drift
- **AND** execute the drift restore path

### Requirement: Logo history — GET /api/store/[id]/logo/history

The system SHALL expose a `GET /api/store/[id]/logo/history` endpoint that returns all archived logo versions with their associated brand profiles. The endpoint SHALL:

1. Query `store_brand_assets` with `variant_type = 'original'` and `status = 'archived'` for the given store
2. LEFT JOIN `store_brand_profiles` on `store_brand_profiles.active_logo_asset_id = store_brand_assets.id`
3. Order results by `store_brand_assets.version` DESC
4. For each item, compute `drift_status` server-side by comparing the profile's `input_snapshot` (if available) against the current store's 4 `DRIFT_FIELDS` (segment, subsegment, tone_of_voice, name)
5. Return an array of objects, each containing the asset record, the associated profile record (or null), the created_at timestamp, and the pre-computed `drift_status`

When resolving the associated profile for an archived asset, the query SHALL order profiles by `created_at ASC` to ensure the oldest profile (created at original upload time) is used for drift computation, avoiding masking by newer profiles created during restore-with-drift operations.

#### Scenario: Returns archived logos with profiles and drift status

- **WHEN** a GET request is sent to `/api/store/{store_id}/logo/history`
- **AND** the store has 2 archived logo versions with associated profiles
- **THEN** the response SHALL return an array of 2 items ordered by version descending
- **AND** each item SHALL contain `asset`, `profile`, `version`, `created_at`, `visual_style`, `safe_color_tokens`, `input_snapshot`, and `drift_status`

### Requirement: Logo restore — POST /api/store/[id]/logo/restore

The system SHALL expose a `POST /api/store/[id]/logo/restore` endpoint that restores a historical logo version. The endpoint SHALL:

1. Accept `{ "asset_id": string }` — the ID of the original archived asset to restore
2. Validate that the `asset_id` belongs to the requesting store_id and has `status = 'archived'`
3. Archive any currently active assets (prevents unique index violation before re-activating restored assets)
4. Load the associated brand profile via `active_logo_asset_id = asset_id` (may be null)
5. If a profile exists, extract `metadata.input_snapshot` for drift validation
6. Compare the 4 `DRIFT_FIELDS` (segment, subsegment, tone_of_voice, name) from `input_snapshot` against the current store values
7. Execute the appropriate restore path based on drift status

#### Scenario: Invalid asset_id returns 400

- **WHEN** a POST request is sent to `/api/store/{store_id}/logo/restore`
- **AND** `asset_id` does not belong to the store's archived assets
- **THEN** HTTP 400 SHALL be returned with an error message

### Requirement: Restore without drift

When `input_snapshot` matches the current store values for all 4 `DRIFT_FIELDS`, the system SHALL execute the no-drift restore path:

1. Archive any currently active assets
2. If the chosen profile is already the active synced profile (post-remove scenario): do NOT mark it as outdated — only re-activate the assets
3. Otherwise: mark the current active profile as `outdated`, then re-activate the chosen profile to `synced`
4. Re-activate the chosen assets to `status = 'active'`
5. Set `identity_state = 'logo'` and `logo_status = 'uploaded'`

#### Scenario: Restore without drift reactivates profile and assets

- **WHEN** the user restores a historical logo version
- **AND** all 4 `DRIFT_FIELDS` match between `input_snapshot` and current store data
- **AND** the chosen profile is NOT the current active synced profile
- **THEN** any currently active assets SHALL be archived
- **AND** the current active profile SHALL be marked `outdated`
- **AND** the chosen profile SHALL be re-activated to `synced`
- **AND** the chosen assets SHALL be re-activated to `active`
- **AND** `identity_state` SHALL be set to `'logo'`

#### Scenario: Restore without drift when profile already synced

- **WHEN** the user restores a historical logo version
- **AND** all 4 `DRIFT_FIELDS` match
- **AND** the chosen profile IS the current active synced profile (post-remove)
- **THEN** any currently active assets SHALL be archived
- **AND** the profile SHALL NOT be marked `outdated`
- **AND** the chosen assets SHALL be re-activated to `active`
- **AND** `identity_state` SHALL be set to `'logo'`

### Requirement: Restore with drift

When `input_snapshot` differs from the current store values for any of the 4 `DRIFT_FIELDS`, the system SHALL execute the drift restore path:

1. Archive any currently active assets
2. Execute the BrandDirector with the restored logo image and current store data
3. Mark the current active profile as `outdated`
4. Create a NEW brand profile with status `synced` from the BrandDirector result, explicitando:
   - `source = 'logo_analysis'`
   - `active_logo_asset_id = asset_id` (asset escolhido no restore)
   - `metadata.input_snapshot` com os 7 campos atuais da loja via `buildStoreProfileInputSnapshot(store)`
   - `brand_colors_chosen` NÃO recebe cores detectadas (isolamento mantido)
   - `safe_color_tokens` recebe a paleta final do BrandDirector
5. The historical profile SHALL NOT be re-activated — it remains with its current status
6. Re-activate the chosen assets to `status = 'active'`
7. Set `identity_state = 'logo'` and `logo_status = 'uploaded'`

The system SHALL NOT offer a "Restore anyway" option — realignment is mandatory when drift is detected.

#### Scenario: Restore with drift creates new synced profile

- **WHEN** the user restores a historical logo version
- **AND** at least one of the 4 `DRIFT_FIELDS` differs between `input_snapshot` and current store data
- **THEN** any currently active assets SHALL be archived
- **AND** the BrandDirector SHALL be executed with the restored logo and current store data
- **AND** the current active profile SHALL be marked `outdated`
- **AND** a NEW profile SHALL be created with `status = 'synced'` and `source = 'logo_analysis'`
- **AND** `active_logo_asset_id` SHALL be set to the restored `asset_id`
- **AND** `metadata.input_snapshot` SHALL contain the 7 current store fields via helper
- **AND** `brand_colors_chosen` SHALL NOT receive detected colors
- **AND** the restored assets SHALL be re-activated to `active`
- **AND** `identity_state` SHALL be set to `'logo'`

#### Scenario: BrandDirector failure on drift restore

- **WHEN** the BrandDirector analysis fails during drift restore
- **THEN** the current active profile SHALL remain `synced` (fallback preserved)
- **AND** a new profile SHALL be created with `status = 'failed'`
- **AND** `active_logo_asset_id` SHALL be set to the restored `asset_id`
- **AND** `metadata.attempt_snapshot` SHALL contain the 7 current store fields via helper
- **AND** `metadata.input_snapshot` SHALL NOT be set on the failed profile
- **AND** the restored assets SHALL still be re-activated to `active`
- **AND** `identity_state` SHALL still be set to `'logo'`

## ADDED Requirements

### Requirement: Snapshot construction uses helper

The logo restore endpoint SHALL NOT construct snapshots inline. `currentSnapshot` (for drift comparison) and `attempt_snapshot` (on BrandDirector failure) SHALL use `buildStoreProfileInputSnapshot(store)`.

#### Scenario: Restore uses helper for snapshot construction

- **WHEN** the restore endpoint needs to build `currentSnapshot`
- **THEN** it SHALL use `buildStoreProfileInputSnapshot(store)`
- **AND** SHALL NOT construct the snapshot object inline
