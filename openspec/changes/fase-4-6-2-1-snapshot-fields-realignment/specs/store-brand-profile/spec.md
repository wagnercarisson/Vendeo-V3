## MODIFIED Requirements

### Requirement: input_snapshot values on first inference

When an inference runs for the first time after a new store is saved (mode=create → PATCH /api/store → POST /api/store/[id]/brand-profile/infer), the `input_snapshot` SHALL capture the values that were just saved plus the store name. This establishes the baseline for future drift detection.

The snapshot SHALL contain exactly 7 fields:

```json
{
  "segment": "moda-feminina",
  "subsegment": "moda-feminina",
  "tone_of_voice": "elegante",
  "name": "Maria Boutique",
  "positioning": "Premium, sofisticado",
  "short_description": "Moda feminina com estilo europeu",
  "slogan": "Elegância que transforma"
}
```

#### Scenario: First inference sets baseline snapshot

- **WHEN** the first text-only inference runs for a new store
- **AND** it completes successfully with status `synced`
- **THEN** `metadata.input_snapshot` SHALL contain the store's name, segment, subsegment, tone_of_voice, positioning, short_description, and slogan at that moment
- **AND** `brand_color` SHALL NOT be present in the snapshot
- **AND** `accent_color` SHALL NOT be present in the snapshot

### Requirement: drift_dismissed_snapshot on dismiss

When the user clicks "Manter direção visual atual" on the drift modal, the system SHALL call `PATCH /api/store/[id]/brand-profile/metadata` with `drift_dismissed_snapshot` set to the current `currentVisualState()`. The `dismissSnapshot` payload SHALL contain all 7 `SNAPSHOT_FIELDS`, but comparison against the current store SHALL use only `DRIFT_FIELDS` (4 fields) to decide if it's the same drift already dismissed.

#### Scenario: Dismiss persists 7 fields, compares 4

- **WHEN** the user dismisses the drift (clicks "Manter direção visual atual")
- **AND** the PATCH succeeds
- **THEN** `metadata.drift_dismissed_snapshot` SHALL contain all 7 `SNAPSHOT_FIELDS`
- **AND** on next page load, the system SHALL compare only the 4 `DRIFT_FIELDS` to determine if the drift is the same

### Requirement: drift_dismissed_snapshot removed on re-inference

When the user triggers re-inference ("Realinhar direção visual"), the system SHALL remove `metadata.drift_dismissed_snapshot` after successful inference.

#### Scenario: drift_dismissed_snapshot removed after re-inference

- **WHEN** re-inference completes successfully
- **THEN** `metadata.drift_dismissed_snapshot` SHALL be removed
- **AND** `metadata.input_snapshot` SHALL be updated with the 7 current store fields via helper

### Requirement: Brand profile generation — inline processing

The brand profile SHALL be generated inline during the `POST /api/store/[id]/logo` request. The system SHALL execute the BrandDirector analysis BEFORE mutating any existing profile. The processing order SHALL be:

1. Upload logo and generate variants (no profile mutation)
2. Execute BrandDirector analysis
3. On success: apply compensated profile transition (mark outdated → insert synced → compensate on failure)
4. On failure: preserve previous profile as fallback, insert failed profile with `metadata.attempt_snapshot` (7 fields via helper)

The `processing` status exists in the model as a reserved status for future use with a durable job queue. In V1, the profile SHALL be created directly as `synced` or `failed` — no transition through `processing`.

#### Scenario: BrandDirector executed before profile mutation

- **WHEN** a valid logo is uploaded
- **THEN** the Store Brand Director LLM call SHALL execute BEFORE any profile status change
- **AND** the previous synced profile SHALL NOT be marked `outdated` until the new profile is ready to be inserted

#### Scenario: Failed analysis inserts failed profile without outdated marking

- **WHEN** the Store Brand Director analysis fails
- **THEN** the previous synced profile SHALL remain `synced` (NOT marked outdated)
- **AND** a new profile SHALL be created with `status = 'failed'`
- **AND** `metadata.attempt_snapshot` SHALL be set with the 7 snapshot fields via `buildStoreProfileInputSnapshot(store)`
- **AND** `metadata.input_snapshot` SHALL NOT be set on the failed profile
- **AND** the upload endpoint SHALL return HTTP 201 (logo persists)

### Requirement: Brand profile generation — text_only inference (userChosenColors)

When a text-only inference is triggered via `POST /api/store/[id]/brand-profile/infer`, the endpoint SHALL accept an optional `userChosenColors: Array<string | null>` field in the request body.

When `userChosenColors` is provided and contains at least one valid HEX, the inference SHALL:
1. Persist the received colors in the new profile's `brand_colors_chosen`
2. NOT pass them as context to BrandTextOnlyInferenceService in this phase. The received colors SHALL only be persisted in `brand_colors_chosen` — do NOT use them to alter prompt, visual direction, creative decisions, or asset generation.

When `userChosenColors` is not provided or is `[]`, the inference SHALL:
1. Check the previous synced profile for existing `brand_colors_chosen`
2. If previous profile has `brand_colors_chosen` with at least one valid HEX, preserve it
3. If no previous profile or previous is `[]`, set `brand_colors_chosen = []`

`manualColorOverride` SHALL NOT be accepted or used by this endpoint.

The inference SHALL also:
1. Load store data (name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state)
2. Call the BrandTextOnlyInferenceService
3. Populate `metadata.input_snapshot` with the 7 snapshot fields via `buildStoreProfileInputSnapshot(store)`
4. Persist with `source = 'text_only'` and `status = 'synced'` on success, `'failed'` on failure
5. Respond only after the operation completes

The inference response SHALL include `profile.metadata` (containing `input_snapshot`) so the frontend can use it for color hydration after re-inference.

#### Scenario: Text-only inference creates synced profile with input_snapshot

- **WHEN** the BrandTextOnlyInferenceService completes successfully
- **THEN** the profile SHALL be created with `source = 'text_only'` and `status = 'synced'`
- **AND** `metadata.input_snapshot` SHALL be populated with the 7 snapshot fields via helper

### Requirement: input_snapshot update on re-inference

When re-inference is triggered via "Realinhar" (from drift modal or discreet button), the system SHALL update `metadata.input_snapshot` with the current store values via `buildStoreProfileInputSnapshot(store)` after successful inference.

#### Scenario: input_snapshot updated on re-inference

- **WHEN** re-inference is triggered via "Realinhar direção visual"
- **AND** the inference completes successfully
- **THEN** `metadata.input_snapshot` SHALL be updated via `buildStoreProfileInputSnapshot(store)`
- **AND** `metadata.drift_dismissed_snapshot` SHALL be removed (if present)

## ADDED Requirements

### Requirement: input_snapshot on logo upload

When a synced brand profile is created from logo upload, `metadata.input_snapshot` SHALL be populated via `buildStoreProfileInputSnapshot(store)` — 7 text fields from the store, without brand_color or accent_color.

#### Scenario: input_snapshot populated on synced profile from logo

- **WHEN** a synced brand profile is created from logo upload
- **THEN** `metadata.input_snapshot` SHALL contain the 7 text fields via the helper
- **AND** `brand_color` SHALL NOT be present
- **AND** `accent_color` SHALL NOT be present

### Requirement: attempt_snapshot on failed profiles

When a brand profile is created with `status = 'failed'` (BrandDirector failure), the system SHALL populate `metadata.attempt_snapshot` with the same 7 fields as `input_snapshot`, via `buildStoreProfileInputSnapshot(store)`. The `attempt_snapshot` serves as an audit trail.

`attempt_snapshot` SHALL NOT be used as a drift baseline. Only `input_snapshot` on synced profiles serves that purpose.

#### Scenario: attempt_snapshot populated on failed profile

- **WHEN** a failed brand profile is created
- **THEN** `metadata.attempt_snapshot` SHALL contain the 7 text fields via the helper
- **AND** `metadata.input_snapshot` SHALL NOT be set
