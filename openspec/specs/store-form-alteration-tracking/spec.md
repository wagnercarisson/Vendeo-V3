> **Propósito**: Define o tracking de alterações (dirty tracking) em nível de sessão para campos de cor no formulário de identidade da loja. Esse tracking é usado pela lógica de detecção de drift para entender o escopo das alterações do usuário na sessão atual.

## Requirements

### Requirement: Session color dirty tracking

On mount of Step 2, the system SHALL capture the initial value of each color picker (primary and accent) regardless of origin (`brand_colors_chosen`, `inferred_*`, `safe_color_tokens`, segment fallback, store.brand_color). These initial values SHALL be stored in component-local state and compared on every `onChange`.

```typescript
type ColorDirtyState = {
  primaryInitial: string | null
  accentInitial: string | null
  primaryDirty: boolean
  accentDirty: boolean
}
```

#### Scenario: Initial values captured on mount

- **WHEN** the store identity form mounts
- **AND** a synced brand profile exists
- **THEN** `primaryInitial` SHALL be the current primary color picker value
- **AND** `accentInitial` SHALL be the current accent color picker value
- **AND** both `primaryDirty` and `accentDirty` SHALL be `false`

#### Scenario: Dirty flag set on color change

- **WHEN** the user changes the primary color picker to a different hex value
- **THEN** `primaryDirty` SHALL be `true`

#### Scenario: Dirty flag reset on revert

- **WHEN** `primaryDirty` is `true`
- **AND** the user reverts the primary color picker to its initial value
- **THEN** `primaryDirty` SHALL be `false`

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
