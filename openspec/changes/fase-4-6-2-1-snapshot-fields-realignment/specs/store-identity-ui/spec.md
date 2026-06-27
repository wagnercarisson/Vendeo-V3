## ADDED Requirements

### Requirement: driftStore object expanded

The `driftStore` object in `store-identity-form.tsx` SHALL include `positioning`, `short_description`, and `slogan` in addition to existing fields. `brand_color` SHALL be removed from the drift store object.

```typescript
const driftStore = useMemo(() => storeId ? {
  id: storeId,
  segment: formData.segment,
  subsegment: formData.subsegment,
  tone_of_voice: formData.tone_of_voice,
  name: formData.name,
  positioning: formData.positioning ?? null,
  short_description: formData.short_description ?? null,
  slogan: formData.slogan ?? null,
} : null, [...]);
```

#### Scenario: driftStore includes new text fields

- **WHEN** the component builds `driftStore`
- **THEN** it SHALL include `positioning`, `short_description`, `slogan` from `formData`
- **AND** `brand_color` SHALL NOT be present

### Requirement: use-drift-detection pick expanded

The hook `use-drift-detection` SHALL expand its store Pick to include `positioning`, `short_description`, and `slogan`, and remove `brand_color`.

```typescript
// Before
Pick<Store, 'id' | 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'brand_color'>

// After
Pick<Store, 'id' | 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'>
```

#### Scenario: use-drift-detection accepts expanded store

- **WHEN** `use-drift-detection` receives store data
- **THEN** its type SHALL accept `positioning`, `short_description`, `slogan`
- **AND** SHALL NOT require `brand_color`

### Requirement: snapshotsEqual uses SNAPSHOT_FIELDS

The `snapshotsEqual` function in `use-drift-detection.ts` SHALL compare all 7 `SNAPSHOT_FIELDS` for structural equality. This ensures the React dependency array detects changes correctly and avoids unnecessary re-renders.

#### Scenario: snapshotsEqual compares 7 fields

- **WHEN** `snapshotsEqual` compares two snapshot objects
- **THEN** it SHALL compare all 7 `SNAPSHOT_FIELDS`
- **AND** any difference in any of the 7 fields SHALL return `false`

### Requirement: Drift detection uses DRIFT_FIELDS

The `allFields` array used for drift detection in the hook SHALL use `DRIFT_FIELDS` (4 fields) instead of the previous 6-field array.

#### Scenario: drift detection compares 4 DRIFT_FIELDS

- **WHEN** the hook checks for drift between current visual state and `input_snapshot`
- **THEN** it SHALL compare only the 4 `DRIFT_FIELDS` (`segment`, `subsegment`, `tone_of_voice`, `name`)
- **AND** SHALL NOT compare `brand_color`, `accent_color`, `positioning`, `short_description`, or `slogan`

### Requirement: dismissSnapshot persists with SNAPSHOT_FIELDS

When dismissing a drift, the `dismissSnapshot` payload SHALL contain all 7 `SNAPSHOT_FIELDS`. However, the comparison to determine if the same drift has already been dismissed SHALL use only `DRIFT_FIELDS` (4 fields).

#### Scenario: dismissSnapshot contains 7 fields but compares 4

- **WHEN** the user dismisses a drift
- **THEN** the dismiss payload SHALL include all 7 `SNAPSHOT_FIELDS`
- **AND** on next mount, the comparison SHALL check only the 4 `DRIFT_FIELDS`
- **AND** if only a non-DRIFT_FIELD changed, the drift SHALL still be considered `dismissed`
