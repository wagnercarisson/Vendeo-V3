> **Purpose**: Defines the BrandDirector retry endpoint — a dedicated mechanism for re-running the AI analysis on the active logo when the initial analysis fails. Replaces the misuse of the logo restore endpoint as a retry mechanism.

## ADDED Requirements

### Requirement: Retry BrandDirector analysis — POST /api/store/[id]/logo/retry-brand-director

The system SHALL expose a `POST /api/store/[id]/logo/retry-brand-director` endpoint that re-runs the BrandDirector analysis on the currently active logo asset. This endpoint SHALL only be available when the store is in `identity_state = 'logo'` and there is a failed profile from a previous analysis attempt.

The endpoint SHALL:
- Accept an empty body (no `asset_id` — the server resolves the active original asset)
- Validate that the store is in `identity_state = 'logo'` (HTTP 409 otherwise)
- Find the single active original asset (`variant_type = 'original'`, `status = 'active'`) for the store (HTTP 400 if none)
- Find the most recent profile for the store and validate: `status = 'failed'`, `source = 'logo_analysis'`, `active_logo_asset_id` matches the active asset (HTTP 400 if validation fails)
- Optionally find the current synced profile (fallback visual direction) — may be null on first upload
- Download the original logo buffer from Supabase Storage
- Run `BrandDirector.analyze()` with the same `storeData` mapping as the upload endpoint, including `userPrimaryColor` and `userAccentColor`
- On success:
  - If fallback exists: mark it as `outdated`, preserve its `brand_colors_chosen` in the new profile
  - If no fallback (first upload): `brand_colors_chosen = []`
  - Insert a new synced profile with ALL BrandDirector output fields + `metadata.input_snapshot` (7 fields via `buildStoreProfileInputSnapshot`)
  - If the insert fails AND fallback was marked outdated: restore fallback to `synced` and return an error
  - If the insert fails AND no fallback existed: return an error (nothing to restore)
- On failure: return `{ success: false, error, retry: true }` without mutating any records

The endpoint SHALL NOT:
- Change `store_brand_assets.status`
- Change `identity_state` or `logo_status`
- Execute drift detection
- Reactivate variants
- Create a new failed profile on error
- Accept an `asset_id` parameter

#### Scenario: Successful retry with fallback (second+ upload)

- **WHEN** a POST request is sent to /api/store/{store_id}/logo/retry-brand-director
- **AND** the store has `identity_state = 'logo'`
- **AND** there is an active original asset with a linked failed profile
- **AND** a previous synced profile exists (fallback)
- **AND** the BrandDirector analysis succeeds
- **THEN** the fallback synced profile SHALL be marked `outdated`
- **AND** a new profile SHALL be inserted with `status = 'synced'`
- **AND** the new profile SHALL have `brand_colors_chosen` from the fallback profile
- **AND** the new profile SHALL have `metadata.input_snapshot` populated with the 7 store fields
- **AND** the response SHALL be HTTP 200 with `{ profile, success: true }`

#### Scenario: Successful retry without fallback (first upload)

- **WHEN** a POST request is sent to /api/store/{store_id}/logo/retry-brand-director
- **AND** the store has `identity_state = 'logo'`
- **AND** there is an active original asset with a linked failed profile
- **AND** there is NO previous synced profile (first upload)
- **AND** the BrandDirector analysis succeeds
- **THEN** a new profile SHALL be inserted with `status = 'synced'`
- **AND** the new profile SHALL have `brand_colors_chosen = []`
- **AND** no profile SHALL be marked `outdated`
- **AND** the response SHALL be HTTP 200 with `{ profile, success: true }`

#### Scenario: Retry fails preserves fallback

- **WHEN** a POST request is sent to /api/store/{store_id}/logo/retry-brand-director
- **AND** the BrandDirector analysis fails
- **THEN** the fallback synced profile SHALL remain `synced` (if it existed)
- **AND** the failed profile SHALL remain `failed`
- **AND** the asset SHALL remain `active`
- **AND** the response SHALL be HTTP 200 with `{ success: false, error, retry: true }`

#### Scenario: Retry rejects store not in logo state

- **WHEN** a POST request is sent to /api/store/{store_id}/logo/retry-brand-director
- **AND** the store has `identity_state = 'text_only'` or `identity_state = 'visual_signature'`
- **THEN** the response SHALL be HTTP 409

#### Scenario: Retry rejects without active asset

- **WHEN** a POST request is sent to /api/store/{store_id}/logo/retry-brand-director
- **AND** the store has no active original asset
- **THEN** the response SHALL be HTTP 400

#### Scenario: Retry rejects without failed profile

- **WHEN** a POST request is sent to /api/store/{store_id}/logo/retry-brand-director
- **AND** the store has an active asset
- **AND** the most recent profile is NOT failed (e.g., already synced)
- **THEN** the response SHALL be HTTP 400

#### Scenario: Insert failure with fallback restores it

- **WHEN** the BrandDirector analysis succeeds
- **AND** a fallback exists and was marked `outdated`
- **AND** the new profile insert fails
- **THEN** the fallback profile SHALL be restored to `status = 'synced'`
- **AND** the response SHALL be HTTP 500

#### Scenario: Insert failure without fallback returns error

- **WHEN** the BrandDirector analysis succeeds
- **AND** no fallback existed
- **AND** the new profile insert fails
- **THEN** the response SHALL be HTTP 500
