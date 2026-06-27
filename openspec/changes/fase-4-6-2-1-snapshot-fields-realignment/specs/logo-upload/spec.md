## MODIFIED Requirements

### Requirement: input_snapshot capture on synced profiles

When a brand profile is created with `status = 'synced'` during logo upload, the system SHALL populate `metadata.input_snapshot` via `buildStoreProfileInputSnapshot(store)`. The snapshot SHALL contain exactly 7 text fields from the store:

```typescript
buildStoreProfileInputSnapshot(store)
// Returns:
{
  segment: store.segment,
  subsegment: store.subsegment ?? null,
  tone_of_voice: store.tone_of_voice ?? null,
  name: store.name,
  positioning: store.positioning ?? null,
  short_description: store.short_description ?? null,
  slogan: store.slogan ?? null,
}
```

The system SHALL NOT resolve `brand_color` or `accent_color` for the snapshot.

#### Scenario: input_snapshot populated via helper on synced profile

- **WHEN** a synced brand profile is created from logo upload
- **THEN** `metadata.input_snapshot` SHALL be the result of `buildStoreProfileInputSnapshot(store)`
- **AND** it SHALL contain exactly 7 fields (segment, subsegment, tone_of_voice, name, positioning, short_description, slogan)
- **AND** it SHALL NOT contain `brand_color`
- **AND** it SHALL NOT contain `accent_color`

#### Scenario: input_snapshot NOT populated on failed profile

- **WHEN** a failed brand profile is created from logo upload (BrandDirector failure)
- **THEN** `metadata.input_snapshot` SHALL NOT be set
- **AND** `metadata.attempt_snapshot` SHALL be used instead

### Requirement: attempt_snapshot capture on failed profiles

When a brand profile is created with `status = 'failed'` during logo upload (BrandDirector failure), the system SHALL populate `metadata.attempt_snapshot` via `buildStoreProfileInputSnapshot(store)`. The `attempt_snapshot` serves as an audit trail — it records the state of the store at the time of the failed attempt.

#### Scenario: attempt_snapshot populated via helper on failed profile

- **WHEN** a failed brand profile is created from logo upload
- **THEN** `metadata.attempt_snapshot` SHALL be the result of `buildStoreProfileInputSnapshot(store)`
- **AND** `metadata.input_snapshot` SHALL NOT be set

### Requirement: Logo upload — POST /api/store/[id]/logo

The system SHALL expose a `POST /api/store/[id]/logo` endpoint that accepts a multipart/form-data file upload. The endpoint SHALL process in three sequential phases:

**Phase 1 — Pre-analysis (validation + storage):**
1. Validate format, MIME, size, and dimensions
2. Persist the original file to Supabase Storage bucket `store-brand-assets`
3. Archive previous active assets to `status = 'archived'` (prevents unique index violation before inserting new)
4. Create the corresponding `store_brand_assets` record with `variant_type = 'original'`, `source = 'user_upload'`, `parent_asset_id = null`, and `status = 'active'`
5. Trigger generation of technical variants via sharp
6. Capture `input_snapshot` of the 7 snapshot fields via `buildStoreProfileInputSnapshot(store)` (segment, subsegment, tone_of_voice, name, positioning, short_description, slogan)

**Phase 2 — BrandDirector (before any profile mutation):**
7. Execute the Store Brand Director analysis with the uploaded logo and current store data

**Phase 3 — Post-analysis (compensated profile transition):**

On BrandDirector SUCCESS:
8. Apply compensated transition:
   a. Mark previous synced profile as `outdated`
    b. Insert new profile with `status = 'synced'`, `source = 'logo_analysis'`, `active_logo_asset_id = originalAsset.id`, `metadata.input_snapshot` populated via helper, `brand_colors_chosen = preserved from previous synced profile (or [] if none)`
   c. If insert fails: restore previous profile to `synced` (compensation)
9. Set `identity_state = 'logo'` and synchronize `logo_status = 'uploaded'` via IDENTITY_TO_LOGO_STATUS mapping
10. Return HTTP 201 with the created assets and profile

On BrandDirector FAILURE:
8. Previous synced profile SHALL remain `synced` (NOT marked outdated)
9. Insert new profile with `status = 'failed'`, `source = 'logo_analysis'`, `active_logo_asset_id = originalAsset.id`, `metadata.attempt_snapshot` populated with the 7 snapshot fields via helper
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
- **AND** `brand_colors_chosen` SHALL preserve previous user choice or be `[]`
- **AND** `metadata.input_snapshot` SHALL contain the 7 snapshot fields via helper

#### Scenario: Upload with BrandDirector failure preserves previous profile

- **WHEN** a valid logo file is uploaded
- **AND** the BrandDirector analysis fails
- **THEN** the previous synced profile SHALL remain `synced`
- **AND** a new profile SHALL be created with `status = 'failed'`
- **AND** `metadata.attempt_snapshot` SHALL contain the 7 snapshot fields via helper
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

## ADDED Requirements

### Requirement: Snapshot construction uses helper

The logo upload endpoint SHALL NOT construct snapshots inline. All snapshot construction SHALL delegate to `buildStoreProfileInputSnapshot(store)` from `src/lib/snapshot.ts`.

#### Scenario: Logo upload uses helper for all snapshots

- **WHEN** the logo upload endpoint creates any snapshot (`input_snapshot` or `attempt_snapshot`)
- **THEN** it SHALL use `buildStoreProfileInputSnapshot(store)`
- **AND** SHALL NOT construct the snapshot object inline
