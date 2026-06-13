> **Propósito**: Este documento contém as alterações delta da fase 4.6.2 sobre a spec `store-brand-profile`. As seções abaixo listam requirements **adicionados** ou **modificados** em relação à spec base.
>
> Base: `openspec/specs/store-brand-profile/spec.md`

---

## ADDED Requirements

### Requirement: input_snapshot in metadata on inference

When the BrandTextOnlyInferenceService completes successfully (status = `synced`), the system SHALL populate `metadata.input_snapshot` with the current visual state for all 6 sensitive fields:

```json
{
  "input_snapshot": {
    "segment": "moda-feminina",
    "subsegment": "moda-feminina",
    "tone_of_voice": "elegante",
    "name": "Maria Boutique",
    "brand_color": "#FF6B6B",
    "accent_color": "#4ECDC4"
  }
}
```

This SHALL happen as part of the same inference flow, after the brand profile is persisted. The snapshot SHALL be merged into the existing `metadata` JSONB, preserving any existing metadata fields.

#### Scenario: input_snapshot populated after successful inference

- **WHEN** the BrandTextOnlyInferenceService completes with status `synced`
- **THEN** `metadata.input_snapshot` SHALL be set in the brand profile
- **AND** the snapshot SHALL contain the current store values for all 6 fields
- **AND** existing metadata fields SHALL be preserved

#### Scenario: input_snapshot not populated on failed inference

- **WHEN** the BrandTextOnlyInferenceService fails (status = `failed`)
- **THEN** `metadata.input_snapshot` SHALL NOT be set

### Requirement: input_snapshot update on re-inference

When re-inference is triggered via "Realinhar" (from banner or discreet button), the system SHALL update `metadata.input_snapshot` with the current visual state (dados atuais da loja + cores vigentes normalizadas) after successful inference.

#### Scenario: input_snapshot updated on re-inference

- **WHEN** re-inference is triggered via "Realinhar direção visual"
- **AND** the inference completes successfully
- **THEN** `metadata.input_snapshot` SHALL be updated with the current visual state
- **AND** `metadata.drift_dismissed_snapshot` SHALL be removed (if present)

### Requirement: input_snapshot values on first inference

When an inference runs for the first time after a new store is saved (mode=create → PATCH /api/store → POST /api/store/[id]/brand-profile/infer), the `input_snapshot` SHALL capture the values that were just saved plus the store name. This establishes the baseline for future drift detection.

#### Scenario: First inference sets baseline snapshot

- **WHEN** the first text-only inference runs for a new store
- **AND** it completes successfully with status `synced`
- **THEN** `metadata.input_snapshot` SHALL contain the store's name, segment, subsegment, tone_of_voice, brand_color, and normalized accent_color at that moment
- **AND** this becomes the baseline for drift detection

### Requirement: PATCH /api/store/[id]/brand-profile/metadata endpoint

The system SHALL expose a `PATCH /api/store/[id]/brand-profile/metadata` endpoint that receives metadata updates for the active brand profile. This endpoint SHALL:

- Accept `PATCH` method only at `/api/store/[id]/brand-profile/metadata`
- Accept a JSON body with metadata fields to merge (e.g., `{ "drift_dismissed_snapshot": {...} }`)
- Update the `metadata` JSONB column of the active synced brand profile for the store
- Perform a deep merge: provided fields SHALL replace or add, omitted fields SHALL retain current values
- Return HTTP 200 on success
- Return HTTP 404 if no synced brand profile exists
- Return HTTP 400 on invalid request body

#### Scenario: Metadata updated successfully

- **WHEN** a PATCH request is sent to `/api/store/{store_id}/brand-profile/metadata`
- **AND** body contains `{ "drift_dismissed_snapshot": {"segment": "moda", "name": "Loja"} }`
- **THEN** the active profile's `metadata.drift_dismissed_snapshot` SHALL be set to the provided value
- **AND** other metadata fields SHALL remain unchanged
- **AND** HTTP 200 SHALL be returned

#### Scenario: Deep merge preserves existing metadata

- **WHEN** the active profile has `metadata = { "existing_field": "value", "input_snapshot": {...} }`
- **AND** a PATCH request sends `{ "drift_dismissed_snapshot": {...} }`
- **THEN** `metadata.existing_field` SHALL be preserved
- **AND** `metadata.input_snapshot` SHALL be preserved
- **AND** `metadata.drift_dismissed_snapshot` SHALL be added

#### Scenario: 404 returned when no active profile

- **WHEN** a PATCH request is sent
- **AND** no synced brand profile exists for this store
- **THEN** HTTP 404 SHALL be returned

### Requirement: drift_dismissed_snapshot on dismiss

When the user clicks "Manter direção visual atual" on the drift banner, the system SHALL call `PATCH /api/store/[id]/brand-profile/metadata` with `drift_dismissed_snapshot` set to the current normalized visual state. This persists the user's choice across sessions.

#### Scenario: Dismiss persists across sessions

- **WHEN** the user dismisses the drift banner
- **AND** the PATCH succeeds
- **THEN** on the next page load with the same store state, `driftStatus` SHALL be `dismissed`
- **AND** the discreet button SHALL be shown instead of the banner

### Requirement: drift_dismissed_snapshot removed on re-inference

When the user triggers re-inference (clicks "Realinhar direção visual" from any entry point), the system SHALL remove `metadata.drift_dismissed_snapshot` after successful inference. This ensures a clean slate for future drift detection.

#### Scenario: drift_dismissed_snapshot removed after re-inference

- **WHEN** re-inference completes successfully
- **THEN** `metadata.drift_dismissed_snapshot` SHALL be removed
- **AND** `metadata.input_snapshot` SHALL be updated with the new values from inference

---

## MODIFIED Requirements

### Requirement: Brand profile generation — text_only inference (modified)

> Modifies the existing "Brand profile generation — text_only inference" requirement.

The inference service SHALL also populate `metadata.input_snapshot` after successful inference, in addition to creating the brand profile with `source = 'text_only'` and `status = 'synced'`.

#### Scenario: Inference populates input_snapshot

- **WHEN** the BrandTextOnlyInferenceService completes successfully
- **THEN** `metadata.input_snapshot` SHALL be populated with current visual state
- **AND** the profile SHALL be created with `source = 'text_only'` and `status = 'synced'`

### Requirement: Regenerate brand profile — POST /api/store/[id]/brand-profile/generate (modified)

> Modifies the existing "Regenerate brand profile" requirement.

The regenerate endpoint SHALL also update `metadata.input_snapshot` after successful regeneration, and clear `metadata.drift_dismissed_snapshot`.

#### Scenario: Regenerate updates input_snapshot

- **WHEN** a POST request is sent to /api/store/{store_id}/brand-profile/generate
- **AND** regeneration succeeds
- **THEN** `metadata.input_snapshot` SHALL be updated with current store values
- **AND** `metadata.drift_dismissed_snapshot` SHALL be removed
