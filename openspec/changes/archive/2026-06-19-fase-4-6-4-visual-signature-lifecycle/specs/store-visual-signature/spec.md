## MODIFIED Requirements

### Requirement: Metadata includes input_snapshot and content_used

The `metadata` JSONB column SHALL be expanded to include:

1. `input_snapshot` — a snapshot of the store's 10 visual fields at the time of generation:
   - `name`, `segment`, `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan`, `city`, `state`, `brand_color`

2. `artDirectorOutput` — the structured output from the art director prompt:
   - `visual_direction`: string
   - `content_used`: `{ store_name: boolean, city: boolean, state: boolean, slogan: boolean }`
   - `visual_elements`: string[]
   - `intended_palette`: object
   - `color_usage`: object

On first attempt (full art director prompt), the JSON SHALL be extracted from the AI response `response.output.message` and persisted.

On retry (simplified prompt that does not return JSON), `content_used` SHALL be inferred by conservative heuristic: all available input fields marked as `true`.

#### Scenario: input_snapshot captured on first generation

- **WHEN** a visual signature is generated via AI (first attempt)
- **THEN** `metadata.input_snapshot` SHALL contain the 10 store fields at generation time
- **AND** `metadata.artDirectorOutput.content_used` SHALL reflect the AI's composition decisions

#### Scenario: content_used inferred conservatively on retry

- **WHEN** a visual signature is generated via retry (simplified prompt)
- **THEN** `metadata.artDirectorOutput.content_used` SHALL have all fields set to `true`

#### Scenario: pre-feature signatures have null metadata

- **WHEN** inspecting a signature created before this feature
- **THEN** `metadata.input_snapshot` SHALL be absent
- **AND** `metadata.artDirectorOutput.content_used` SHALL be absent

### Requirement: GET /api/store/[id]/visual-signature — history response

The GET endpoint SHALL serve as the history/list of visual signatures for the store. The response SHALL be expanded beyond the current simple list.

The response SHALL include for each signature:
- `id`, `status`, `assetUrl`, `type`, `attempt`
- `created_at`, `approved_at` (null if never active, or if archived — see below)
- `art_direction`: object containing `visual_direction`, `content_used`, `intended_palette` (from `metadata.artDirectorOutput`), or `null` if unavailable
- `restore_eligibility`: object computed server-side by comparing `metadata.input_snapshot` against current store data using `content_used` (same drift rules as POST /restore):
  - `can_restore: boolean` — true only if no drift AND metadata exists
  - `drift_fields: string[]` — list of fields with drift (empty if can_restore)
  - `requires_regeneration: boolean` — true if drift detected OR metadata is missing (in both cases user must generate a new signature)
  - `reason: 'ok' | 'critical_drift' | 'missing_metadata'` — for UI differentiation:
    - `'ok'` → can_restore = true
    - `'critical_drift'` → can_restore = false, drift_fields populated, "Os dados da loja mudaram..."
    - `'missing_metadata'` → can_restore = false, drift_fields empty, "Assinatura antiga não pode ser restaurada..."

`approved_at` SHALL be reliably populated only for the **currently active** signature (its `updated_at` reflects the approval time). For archived signatures that were previously active, `updated_at` has been overwritten by archival — `approved_at` SHALL be `null`. Signatures that were never active (`draft`) SHALL also have `null`.

#### Scenario: Active signature includes approved_at

- **WHEN** GET /api/store/{store_id}/visual-signature returns the currently active signature
- **THEN** `approved_at` SHALL contain a timestamp
- **AND** `art_direction` SHALL contain the metadata from `artDirectorOutput`

#### Scenario: Archived signature returns null for approved_at

- **WHEN** GET /api/store/{store_id}/visual-signature returns an archived signature
- **THEN** `approved_at` SHALL be `null`

#### Scenario: Pre-feature signature returns null for art_direction

- **WHEN** GET /api/store/{store_id}/visual-signature returns a signature without `artDirectorOutput`
- **THEN** `art_direction` SHALL be `null`

#### Scenario: restore_eligibility indicates ok when no drift

- **WHEN** GET /api/store/{store_id}/visual-signature returns a signature
- **AND** metadata.input_snapshot matches current store data
- **THEN** `restore_eligibility.can_restore` SHALL be `true`
- **AND** `restore_eligibility.drift_fields` SHALL be `[]`
- **AND** `restore_eligibility.requires_regeneration` SHALL be `false`
- **AND** `restore_eligibility.reason` SHALL be `'ok'`

#### Scenario: restore_eligibility blocks restore on drift with reason critical_drift

- **WHEN** GET /api/store/{store_id}/visual-signature returns a signature
- **AND** metadata.input_snapshot differs from current store data
- **THEN** `restore_eligibility.can_restore` SHALL be `false`
- **AND** `restore_eligibility.drift_fields` SHALL list the drifted fields
- **AND** `restore_eligibility.requires_regeneration` SHALL be `true`
- **AND** `restore_eligibility.reason` SHALL be `'critical_drift'`

#### Scenario: restore_eligibility blocks restore on missing metadata with reason missing_metadata

- **WHEN** GET /api/store/{store_id}/visual-signature returns a signature
- **AND** metadata has no `input_snapshot`
- **THEN** `restore_eligibility.can_restore` SHALL be `false`
- **AND** `restore_eligibility.drift_fields` SHALL be `[]`
- **AND** `restore_eligibility.requires_regeneration` SHALL be `true`
- **AND** `restore_eligibility.reason` SHALL be `'missing_metadata'`

### Requirement: Active signature lifecycle — restore support

The lifecycle requirement "Archived signatures are never reactivated" SHALL be updated.

Archived signatures SHALL be reactivable via `POST /visual-signature/restore`. When restored, the archived signature becomes `active` and the previous active signature becomes `archived`.

#### Scenario: Archived signature can be restored

- **WHEN** a visual signature with `status = 'archived'` is restored via POST /restore
- **THEN** its status SHALL become `active`
- **AND** any previously active signature SHALL become `archived`
