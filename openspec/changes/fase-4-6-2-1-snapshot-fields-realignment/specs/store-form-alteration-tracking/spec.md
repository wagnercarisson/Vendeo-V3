## MODIFIED Requirements

### Requirement: Color dirty state as drift augmentation

The color dirty state SHALL be used to inform the alert message in the drift UI (modal, discreet button), NOT to trigger or suppress drift detection itself. Drift detection always compares `DRIFT_FIELDS` against `input_snapshot` — dirty tracking only augments the message copy.

When drift IS detected (one or more `DRIFT_FIELDS` differ), dirty colors MAY enrich the message:
- Drift detected from DRIFT_FIELDS + dirty colors → message may mention "Você alterou campos da loja e as cores"
- Drift detected from DRIFT_FIELDS only → message mentions the specific field

A color-only change (only `brand_color` or `accent_color` altered, no DRIFT_FIELDS changed) SHALL NOT produce drift, regardless of persistence state. `brand_color` and `accent_color` are not in `DRIFT_FIELDS` and SHALL NOT be compared for drift.

#### Scenario: Color dirty state does not affect drift status

- **WHEN** `primaryDirty` is `true`
- **AND** no DRIFT_FIELDS differ from snapshot
- **THEN** `driftStatus` SHALL still be `none` (dirty colors alone without persist do not create drift)

#### Scenario: Color-only change persisted does not trigger drift

- **WHEN** the user changes `brand_color` or `accent_color` in the color picker
- **AND** saves via PATCH
- **AND** none of the 4 `DRIFT_FIELDS` changed
- **THEN** `driftStatus` SHALL be `none` (colors are not in DRIFT_FIELDS)

#### Scenario: Color dirty state reflected in modal message

- **WHEN** `driftStatus` is `new` (detected via DRIFT_FIELDS)
- **AND** `primaryDirty` or `accentDirty` is `true`
- **THEN** the drift modal MAY mention that colors were also changed
