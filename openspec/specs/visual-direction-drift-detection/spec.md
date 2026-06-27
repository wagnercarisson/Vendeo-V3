> **Propósito**: Define a lógica de detecção de desalinhamento (drift) entre o estado atual da loja e o brand profile ativo. A detecção ocorre no frontend ao carregar superfícies de identidade da loja, comparando os valores normalizados da loja contra o snapshot armazenado no perfil.

## Requirements

### Requirement: Snapshot structure

The system SHALL store two snapshots in `store_brand_profiles.metadata`:

```json
{
  "input_snapshot": {
    "segment": "moda-feminina",
    "subsegment": "moda-feminina",
    "tone_of_voice": "elegante",
    "name": "Maria Boutique",
    "positioning": "Premium, sofisticado",
    "short_description": "Moda feminina com estilo europeu",
    "slogan": "Elegância que transforma"
  },
  "drift_dismissed_snapshot": {
    "segment": "moda-feminina",
    "subsegment": "moda-feminina",
    "tone_of_voice": "elegante",
    "name": "Maria Boutique",
    "positioning": "Premium, sofisticado",
    "short_description": "Moda feminina com estilo europeu",
    "slogan": "Elegância que transforma"
  }
}
```

Both use the same field schema (`StoreProfileInputSnapshot`). Semantics differ:
- `input_snapshot`: values that **generated** the profile (populated post-inference)
- `drift_dismissed_snapshot`: store values **at dismiss moment** (populated via PATCH metadata)

#### Scenario: Snapshot stored on successful inference

- **WHEN** the BrandTextOnlyInferenceService completes successfully
- **THEN** `metadata.input_snapshot` SHALL contain the current store values for all 7 snapshot fields
- **AND** `metadata.drift_dismissed_snapshot` SHALL NOT be set

#### Scenario: Snapshot not stored on failed inference

- **WHEN** the BrandTextOnlyInferenceService fails
- **THEN** `metadata.input_snapshot` SHALL NOT be set

### Requirement: Normalized current visual state

The system SHALL compute a `currentVisualState` object from the current store data only. It SHALL delegate to `buildStoreProfileInputSnapshot(store)` which resolves all 7 fields directly from the store:

```typescript
// StoreProfileInputSnapshot
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

The function SHALL NOT require a brand profile parameter — it reads exclusively from the store.

#### Scenario: currentVisualState reads from store only

- **WHEN** `currentVisualState` is called
- **THEN** it SHALL read all fields from the `store` object only
- **AND** SHALL NOT require a `profile` parameter
- **AND** SHALL return a `StoreProfileInputSnapshot` with all 7 fields

### Requirement: accent_color persistence across sessions

`accent_color` does not have a dedicated column in the `stores` table. The system SHALL persist user-changed accent colors via the existing `PATCH /api/store/[id]/brand-profile` endpoint, which updates `brand_colors_chosen[1]`. This is already implemented in the brand profile system (spec `store-brand-profile`).

`accent_color` SHALL NOT trigger drift detection — it is explicitly excluded from `DRIFT_FIELDS`. The color persistence mechanism remains valid, but a change in `accent_color` alone SHALL NOT produce a `new` driftStatus.

When drift IS detected (due to changes in one or more `DRIFT_FIELDS`), the dirty state of color pickers MAY still augment the drift message (see `store-form-alteration-tracking` spec).

No new persistence mechanism is needed for accent_color in this phase. The flow is:

1. User changes accent color in Step 2 color picker
2. On save, `brand_colors_chosen[1]` is updated via `PATCH /api/store/[id]/brand-profile`
3. On next Step 2 mount, the color picker reads from `brand_colors_chosen[1]` for hydration
4. The change SHALL NOT trigger drift detection — `accent_color` is not in `DRIFT_FIELDS`

#### Scenario: accent_color change persists but does not trigger drift

- **WHEN** the user changes the accent color picker in Step 2
- **AND** saves the form
- **THEN** `brand_colors_chosen[1]` SHALL be updated via `PATCH /api/store/[id]/brand-profile`
- **AND** on next mount, `driftStatus` SHALL NOT change due to this color change alone
- **AND** if none of the 4 `DRIFT_FIELDS` changed, `driftStatus` SHALL be `none`

### Requirement: Drift detection logic

The detection SHALL follow this algorithm on every Step 2 mount:

```
1. No brand profile with synced status exists?
   OR input_snapshot is absent?
   → No drift (silent)

2. currentVisualState deviates from input_snapshot on DRIFT_FIELDS?
   ├── No → No drift
   └── Yes → Drift exists

3. Drift exists + drift_dismissed_snapshot exists
   + currentVisualState == drift_dismissed_snapshot on DRIFT_FIELDS?
   → Same drift already dismissed → 'dismissed'
   (user already chose to ignore this exact drift)

4. Otherwise:
   → 'new' (handled by UX layer — see store-identity-ui spec)
```

String comparison SHALL normalize `null` and `undefined` to empty string for all fields. Comparison SHALL only consider fields in `DRIFT_FIELDS` (4 fields).

#### Scenario: No drift when snapshot matches store on DRIFT_FIELDS

- **WHEN** all 4 `DRIFT_FIELDS` in `input_snapshot` match `currentVisualState`
- **THEN** `driftStatus` SHALL be `none`

#### Scenario: No drift when only positioning differs

- **WHEN** `currentVisualState.segment` matches `input_snapshot.segment`
- **AND** `currentVisualState.subsegment` matches `input_snapshot.subsegment`
- **AND** `currentVisualState.tone_of_voice` matches `input_snapshot.tone_of_voice`
- **AND** `currentVisualState.name` matches `input_snapshot.name`
- **AND** `currentVisualState.positioning` differs from `input_snapshot.positioning`
- **THEN** `driftStatus` SHALL be `none` (positioning is not in DRIFT_FIELDS)

#### Scenario: Drift detected when segment differs

- **WHEN** `currentVisualState.segment` is `"mercados-mercearias"`
- **AND** `input_snapshot.segment` is `"moda-feminina"`
- **THEN** `driftStatus` SHALL be `new`

#### Scenario: Drift NOT detected when only brand_color differs

- **WHEN** all 4 `DRIFT_FIELDS` match between `currentVisualState` and `input_snapshot`
- **AND** only `stores.brand_color` would have differed under the old system
- **THEN** `driftStatus` SHALL be `none` (brand_color is not in DRIFT_FIELDS)

#### Scenario: Dismissed drift shows discreet status

- **WHEN** `driftStatus` would be `new` (store differs from snapshot on DRIFT_FIELDS)
- **AND** `drift_dismissed_snapshot` equals `currentVisualState` on all 4 `DRIFT_FIELDS`
- **THEN** `driftStatus` SHALL be `dismissed`

#### Scenario: Dismissed drift re-triggers on new change

- **WHEN** `driftStatus` was `dismissed`
- **AND** user changes `tone_of_voice` in the form and saves
- **THEN** on next mount, `driftStatus` SHALL be `new` again (store ≠ drift_dismissed_snapshot on DRIFT_FIELDS)

#### Scenario: Drift resolves automatically on revert

- **WHEN** `driftStatus` was `new` or `dismissed`
- **AND** user reverts store fields to match `input_snapshot` on all `DRIFT_FIELDS`
- **THEN** on next mount, `driftStatus` SHALL be `none`

### Requirement: No drift for new stores

When no brand profile exists (`store_brand_profiles` is empty) or no `input_snapshot` is set, drift detection SHALL return `none` without any comparison.

#### Scenario: No drift when brand profile absent

- **WHEN** no brand profile exists for the store (first time, mode=create)
- **THEN** `driftStatus` SHALL be `none`

#### Scenario: No drift when input_snapshot absent

- **WHEN** a brand profile exists but `metadata.input_snapshot` is null (e.g. failed profile)
- **THEN** `driftStatus` SHALL be `none`

### Requirement: DriftStatus type

The system SHALL define a `DriftStatus` type with exactly three values:

```typescript
type DriftStatus = 'none' | 'new' | 'dismissed'
```

This type SHALL be used by all consumers to determine which UI element to render.

### Requirement: Campaign generation not affected

The drift detection system SHALL NOT block, delay, or modify campaign generation in any way. The campaign flow uses the active visual direction regardless of drift state. A dismissed drift is a persisted user choice that does not affect campaign output.

### Requirement: Snapshot field set (SNAPSHOT_FIELDS)

The snapshot SHALL capture exactly 7 fields:

| Field | Source in store table | Type | Description |
|-------|----------------------|------|-------------|
| `segment` | `stores.segment` | `string \| null` | Segmento da loja |
| `subsegment` | `stores.subsegment` | `string \| null` | Subsegmento da loja |
| `tone_of_voice` | `stores.tone_of_voice` | `string \| null` | Tom de voz |
| `name` | `stores.name` | `string \| null` | Nome da loja |
| `positioning` | `stores.positioning` | `string \| null` | Posicionamento |
| `short_description` | `stores.short_description` | `string \| null` | Descrição curta |
| `slogan` | `stores.slogan` | `string \| null` | Slogan |

`brand_color` and `accent_color` SHALL NOT be part of the snapshot.

All 7 fields SHALL be captured regardless of which fields trigger drift detection (separation of capture from policy).

#### Scenario: All 7 fields captured in snapshot

- **WHEN** a snapshot is created
- **THEN** it SHALL contain exactly the 7 fields listed above
- **AND** `brand_color` SHALL NOT be present
- **AND** `accent_color` SHALL NOT be present

### Requirement: Drift field set (DRIFT_FIELDS)

Drift detection SHALL compare exactly these 4 fields:

| Field | Source in store table | Source in snapshot |
|-------|----------------------|-------------------|
| `segment` | `stores.segment` | `input_snapshot.segment` |
| `subsegment` | `stores.subsegment` | `input_snapshot.subsegment` |
| `tone_of_voice` | `stores.tone_of_voice` | `input_snapshot.tone_of_voice` |
| `name` | `stores.name` | `input_snapshot.name` |

`positioning`, `short_description`, `slogan`, `brand_color`, and `accent_color` SHALL NOT trigger drift detection in this phase.

#### Scenario: All drift fields compared

- **WHEN** the system checks for drift
- **THEN** it SHALL compare `segment`, `subsegment`, `tone_of_voice`, and `name`
- **AND** `positioning` SHALL be excluded from comparison
- **AND** `short_description` SHALL be excluded from comparison
- **AND** `slogan` SHALL be excluded from comparison
- **AND** `brand_color` SHALL be excluded from comparison
- **AND** `accent_color` SHALL be excluded from comparison

### Requirement: Helper type — `StoreProfileInputSnapshot`

The system SHALL define a `StoreProfileInputSnapshot` interface in `src/lib/snapshot.ts`:

```typescript
export interface StoreProfileInputSnapshot {
  segment: string | null;
  subsegment: string | null;
  tone_of_voice: string | null;
  name: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
}

export type StoredProfileSnapshot = Partial<StoreProfileInputSnapshot>;
```

`DriftSnapshot` SHALL be an alias of `StoreProfileInputSnapshot` — the two types SHALL share the same contract.

#### Scenario: DriftSnapshot aliases StoreProfileInputSnapshot

- **WHEN** the code references `DriftSnapshot`
- **THEN** it SHALL be the same type as `StoreProfileInputSnapshot`
- **AND** changes to one SHALL automatically apply to the other

### Requirement: `buildStoreProfileInputSnapshot` helper

The system SHALL provide a `buildStoreProfileInputSnapshot(store)` helper that constructs a complete `StoreProfileInputSnapshot` from a store object. This helper SHALL be used by ALL endpoints that create brand profile snapshots.

```typescript
export function buildStoreProfileInputSnapshot(
  store: Pick<Store, 'segment' | 'subsegment' | 'tone_of_voice' | 'name' | 'positioning' | 'short_description' | 'slogan'>
): StoreProfileInputSnapshot
```

#### Scenario: Helper returns 7 fields

- **WHEN** `buildStoreProfileInputSnapshot` is called with a valid store object
- **THEN** it SHALL return an object with exactly 7 keys
- **AND** `null` values SHALL be preserved as `null`
- **AND** the structure SHALL be consistent across all calls

### Requirement: Backward compatibility with old snapshots

Snapshots created before this phase (6 fields, without `positioning`/`short_description`/`slogan`) SHALL remain compatible. `computeDriftStatus` SHALL compare only `DRIFT_FIELDS` (4 fields that exist in all snapshots, old and new).

#### Scenario: Old snapshot without positioning does not trigger false drift

- **WHEN** a store has `positioning = "Premium"` in the current store
- **AND** the stored `input_snapshot` is an old-format snapshot (6 fields, no `positioning`)
- **THEN** `driftStatus` SHALL be `none` (positioning is not in DRIFT_FIELDS)
- **AND** no false drift SHALL be reported due to missing fields in the old snapshot
