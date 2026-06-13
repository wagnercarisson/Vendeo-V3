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
    "brand_color": "#FF6B6B",
    "accent_color": "#4ECDC4"
  },
  "drift_dismissed_snapshot": {
    "segment": "moda-feminina",
    "subsegment": "moda-feminina",
    "tone_of_voice": "elegante",
    "name": "Maria Boutique",
    "brand_color": "#FF6B6B",
    "accent_color": "#4ECDC4"
  }
}
```

Both use the same field schema (`DriftSnapshot`). Semantics differ:
- `input_snapshot`: values that **generated** the profile (populated post-inference)
- `drift_dismissed_snapshot`: store values **at dismiss moment** (populated via PATCH metadata)

#### Scenario: Snapshot stored on successful inference

- **WHEN** the BrandTextOnlyInferenceService completes successfully
- **THEN** `metadata.input_snapshot` SHALL contain the current store values for all 6 sensitive fields
- **AND** `metadata.drift_dismissed_snapshot` SHALL NOT be set

#### Scenario: Snapshot not stored on failed inference

- **WHEN** the BrandTextOnlyInferenceService fails
- **THEN** `metadata.input_snapshot` SHALL NOT be set

### Requirement: Sensitive field set

Drift detection SHALL compare exactly these 6 fields:

| Field | Source in store table | Source in snapshot |
|---|---|---|
| `segment` | `stores.segment` | `input_snapshot.segment` |
| `subsegment` | `stores.subsegment` | `input_snapshot.subsegment` |
| `tone_of_voice` | `stores.tone_of_voice` | `input_snapshot.tone_of_voice` |
| `name` | `stores.name` | `input_snapshot.name` |
| `brand_color` | `stores.brand_color` | `input_snapshot.brand_color` |
| `accent_color` | (no column — see normalization) | `input_snapshot.accent_color` |

The `positioning` field SHALL NOT trigger drift detection.

#### Scenario: All sensitive fields compared

- **WHEN** the system checks for drift
- **THEN** it SHALL compare `segment`, `subsegment`, `tone_of_voice`, `name`, `brand_color`, and `accent_color`
- **AND** `positioning` SHALL be excluded from comparison

### Requirement: Normalized current visual state

The system SHALL compute a `currentVisualState` object from the current store + profile data to normalize the comparison:

| Field | Resolution |
|---|---|
| `segment` | `stores.segment` |
| `subsegment` | `stores.subsegment` |
| `tone_of_voice` | `stores.tone_of_voice` |
| `name` | `stores.name` |
| `brand_color` | `stores.brand_color` (may be null) |
| `accent_color` | `brand_colors_chosen[1]` → `safe_color_tokens.accent` → `inferred_accent_color` (priority order, first non-null wins) |

If `brand_color` is null in the store but `input_snapshot.brand_color` is non-null (color was set during inference), the comparison SHALL detect drift.

#### Scenario: accent_color normalized from brand_colors_chosen

- **WHEN** `brand_colors_chosen` has 2+ colors
- **THEN** `currentVisualState.accent_color` SHALL be `brand_colors_chosen[1]`

#### Scenario: accent_color falls back to safe_color_tokens

- **WHEN** `brand_colors_chosen` has fewer than 2 elements
- **AND** `safe_color_tokens.accent` is non-null
- **THEN** `currentVisualState.accent_color` SHALL be `safe_color_tokens.accent`

#### Scenario: accent_color falls back to inferred_accent_color

- **WHEN** `brand_colors_chosen` has fewer than 2 elements
- **AND** `safe_color_tokens.accent` is null
- **AND** `inferred_accent_color` is non-null
- **THEN** `currentVisualState.accent_color` SHALL be `inferred_accent_color`

### Requirement: accent_color persistence across sessions

`accent_color` does not have a dedicated column in the `stores` table. The system SHALL persist user-changed accent colors via the existing `PATCH /api/store/[id]/brand-profile` endpoint, which updates `brand_colors_chosen[1]`. This is already implemented in the brand profile system (spec `store-brand-profile`). Drift detection reads `accent_color` from the normalized current visual state, which resolves `brand_colors_chosen[1]` first — so an accent change persisted via `brand_colors_chosen` will be detected as drift on the next session.

No new persistence mechanism is needed for accent_color in this phase. The flow is:

1. User changes accent color in Step 2 color picker
2. On save, `brand_colors_chosen[1]` is updated via `PATCH /api/store/[id]/brand-profile`
3. On next Step 2 mount, `currentVisualState.accent_color` resolves from `brand_colors_chosen[1]`
4. If it differs from `input_snapshot.accent_color`, drift is detected

#### Scenario: accent_color change persists via brand_colors_chosen

- **WHEN** the user changes the accent color picker in Step 2
- **AND** saves the form
- **THEN** `brand_colors_chosen[1]` SHALL be updated via `PATCH /api/store/[id]/brand-profile`
- **AND** on next mount, `currentVisualState.accent_color` SHALL resolve to the new value
- **AND** if it differs from `input_snapshot.accent_color`, `driftStatus` SHALL be `new`

### Requirement: Drift detection logic

The detection SHALL follow this algorithm on every Step 2 mount:

```
1. No brand profile with synced status exists?
   OR input_snapshot is absent?
   → No drift (silent)

2. currentVisualState ≠ input_snapshot?
   ├── No → No drift
   └── Yes → Drift exists

3. Drift exists + drift_dismissed_snapshot exists
   + currentVisualState == drift_dismissed_snapshot?
   → Same drift already dismissed → 'dismissed'
   (user already chose to ignore this exact drift)

4. Otherwise:
   → 'new' (handled by UX layer — see store-identity-ui spec)
```

String comparison SHALL normalize `null` and `undefined` to empty string for all fields. Color hex values SHALL be lowercased before comparison.

#### Scenario: No drift when snapshot matches store

- **WHEN** `input_snapshot` equals `currentVisualState` on all 6 fields
- **THEN** `driftStatus` SHALL be `none`

#### Scenario: Drift detected when segment differs

- **WHEN** `currentVisualState.segment` is `"mercados-mercearias"`
- **AND** `input_snapshot.segment` is `"moda-feminina"`
- **THEN** `driftStatus` SHALL be `new`

#### Scenario: Drift detected when name differs

- **WHEN** `currentVisualState.name` is `"Nova Loja"`
- **AND** `input_snapshot.name` is `"Antiga Loja"`
- **THEN** `driftStatus` SHALL be `new`

#### Scenario: Drift detected when brand_color differs

- **WHEN** `currentVisualState.brand_color` is `null`
- **AND** `input_snapshot.brand_color` is `"#FF6B6B"` (user cleared the color after inference)
- **THEN** `driftStatus` SHALL be `new`

#### Scenario: Dismissed drift shows discreet status

- **WHEN** `driftStatus` would be `new` (store differs from snapshot)
- **AND** `drift_dismissed_snapshot` equals `currentVisualState` on all 6 fields
- **THEN** `driftStatus` SHALL be `dismissed`

#### Scenario: Dismissed drift re-triggers on new change

- **WHEN** `driftStatus` was `dismissed`
- **AND** user changes `tone_of_voice` in the form and saves
- **THEN** on next mount, `driftStatus` SHALL be `new` again (store_atual ≠ drift_dismissed_snapshot)

#### Scenario: Drift resolves automatically on revert

- **WHEN** `driftStatus` was `new` or `dismissed`
- **AND** user reverts store fields to match `input_snapshot`
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
