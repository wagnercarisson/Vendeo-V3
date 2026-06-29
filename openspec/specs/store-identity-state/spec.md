> **Purpose**: Defines the identity state machine that governs the visual identity status of a store. Introduces `identity_state`, `text_only_origin`, and `manual_color_override` on `stores`, establishes the `text_only` state, and maintains dual-population with `logo_status` for backward compatibility.

## Requirements

### Requirement: identity_state field

The `stores` table SHALL have an `identity_state` column of type `text`, with a CHECK constraint limiting values to `'text_only'`, `'logo'`, or `'visual_signature'`. The default value SHALL be `'text_only'`.

`identity_state` é o campo canônico para o estado visual de identidade da loja. `logo_status` é derivado e mantido exclusivamente para backward compatibility. Código novo SHALL ler `identity_state`.

| State | Meaning | logo_status sync |
|-------|---------|-----------------|
| `text_only` | Store has no logo and no visual signature. Identity inferred or user chose text-only | `explicit_none` |
| `logo` | Store has an uploaded logo (via POST /api/store/[id]/logo) | `uploaded` |
| `visual_signature` | Store has an AI-generated visual signature that was approved | `generated` |

The IDENTITY_TO_LOGO_STATUS mapping:

```typescript
const IDENTITY_TO_LOGO_STATUS: Record<string, string | null> = {
  'text_only': 'explicit_none',
  'logo': 'uploaded',
  'visual_signature': 'generated',
};
```

#### Scenario: identity_state column exists

- **WHEN** the `stores` table schema is inspected
- **THEN** there SHALL be a column `identity_state` of type `text`
- **AND** its default value SHALL be `'text_only'`

#### Scenario: CHECK constraint validates identity_state values

- **WHEN** a row is inserted with `identity_state = 'invalid'`
- **THEN** the insert SHALL fail with a CHECK constraint violation

#### Scenario: identity_state drives logo_status sync

- **WHEN** `identity_state` is set to `'logo'`
- **THEN** `logo_status` SHALL be set to `'uploaded'` in the same operation

#### Scenario: identity_state text_only syncs logo_status explicit_none

- **WHEN** `identity_state` is set to `'text_only'`
- **THEN** `logo_status` SHALL be set to `'explicit_none'` in the same operation

### Requirement: text_only_origin field

The `stores` table SHALL have a `text_only_origin` column of type `text`, with a CHECK constraint limiting values to `'explicit'` or `'implicit'`. The default value SHALL be `'implicit'`.

| Value | Meaning |
|-------|---------|
| `explicit` | User clicked "Continuar sem logo" link |
| `implicit` | User saved without logo (with or without choosing colors) — system inferred text_only |

The `text_only_origin` field SHALL only be meaningful when `identity_state = 'text_only'`.

#### Scenario: text_only_origin column exists

- **WHEN** the `stores` table schema is inspected
- **THEN** there SHALL be a column `text_only_origin` of type `text`
- **AND** its default value SHALL be `'implicit'`

#### Scenario: CHECK constraint validates explicit/implicit

- **WHEN** a row is inserted with `text_only_origin = 'unknown'`
- **THEN** the insert SHALL fail with a CHECK constraint violation

### Requirement: manual_color_override field

The `stores` table SHALL have a `manual_color_override` column of type `boolean`, with a default value of `false`.

`manual_color_override` SHALL be `true` when the user actively chose colors via the color pickers in Step 2. It SHALL be `false` when colors were inferred by AI or no colors were set.

#### Scenario: manual_color_override column exists

- **WHEN** the `stores` table schema is inspected
- **THEN** there SHALL be a column `manual_color_override` of type `boolean`
- **AND** its default value SHALL be `false`

### Requirement: previous_identity_snapshot field

The `stores` table SHALL have a `previous_identity_snapshot` column of type `jsonb`, intended for storing the previous identity state when transitioning between identity states.

**Nesta fase (4.6.3):** o campo NÃO será populado. O mecanismo correto para restore de estado anterior é o par `store_brand_assets` + `store_brand_profiles`, que suporta N versões, é a source of truth (sem duplicação), e não introduz stale data risk. Campo candidato a remoção futura.

#### Scenario: previous_identity_snapshot column exists but is not populated

- **WHEN** the `stores` table schema is inspected
- **THEN** there SHALL be a column `previous_identity_snapshot` of type `jsonb`
- **AND** it SHALL be nullable
- **AND** it SHALL NOT be populated by any code path in this phase

### Requirement: Dual-population strategy

When the system updates `identity_state` (for any valid state: text_only, logo, or visual_signature), it SHALL update BOTH `identity_state` and `logo_status` in the same operation. The `logo_status` value SHALL be derived from the IDENTITY_TO_LOGO_STATUS mapping.

This ensures:
1. New code that reads `identity_state` works correctly
2. Existing code that reads `logo_status` continues to work

#### Scenario: Both fields updated in same operation for logo

- **WHEN** the system sets `identity_state = 'logo'`
- **THEN** `logo_status` SHALL be set to `'uploaded'` in the same operation

#### Scenario: Both fields updated in same operation for text_only

- **WHEN** the system sets `identity_state = 'text_only'` (via logo remove)
- **THEN** `logo_status` SHALL be set to `'explicit_none'` in the same operation

### Requirement: text_only_origin explicit vs implicit

The system SHALL distinguish between explicit and implicit entry into text_only:

- **explicit**: User clicked "Continuar sem logo" link in Step 2 (deliberate choice)
- **implicit**: User clicked "Salvar" without providing a logo, regardless of whether they chose colors (system-inferred)

#### Scenario: Explicit origin on "Continuar sem logo"

- **WHEN** the user clicks "Continuar sem logo"
- **THEN** `text_only_origin` SHALL be set to `'explicit'`

#### Scenario: Implicit origin on save without logo

- **WHEN** the user clicks "Salvar" in Step 2
- **AND** no logo is active and no visual signature is active
- **THEN** `text_only_origin` SHALL be set to `'implicit'`

### Requirement: Profile reconciliation on identity state transitions

When transitioning `identity_state` to a new active identity (activating a visual signature via approve or restore, uploading a logo), the system SHALL:

1. Mark all currently `synced` brand profiles whose `source` is incompatible with the new identity as `outdated`
2. Activate the target profile as `synced`

Compatibility matrix:

| Target identity | Target profile | Incompatible (marked outdated) |
|----------------|----------------|-------------------------------|
| `visual_signature` (approve/restore) | `without_logo` linked to the target `visual_signature_id` | Any other `synced` profile — including `without_logo` linked to a different `visual_signature_id`, `logo_analysis`, and `text_only` |
| `logo` (upload) | `logo_analysis` (newly created) | Any other `synced` profile — including `without_logo` and `text_only` |

#### Scenario: Approving VS marks logo profile as outdated

- **WHEN** a visual signature is approved
- **AND** the store has a synced `logo_analysis` profile
- **THEN** the `logo_analysis` profile SHALL be marked `outdated`
- **AND** the `without_logo` profile linked to the signature SHALL become `synced`

#### Scenario: Uploading logo marks VS profile as outdated

- **WHEN** a logo is uploaded
- **AND** the store has a synced `without_logo` profile
- **THEN** the `without_logo` profile SHALL be marked `outdated`
- **AND** the new `logo_analysis` profile SHALL become `synced`

### Requirement: text_only fallback preserves profile synced

When transitioning `identity_state` to `'text_only'` (via DELETE /visual-signature, DELETE /logo), the previously active profile SHALL remain `synced` as a fallback visual direction.

The profile SHALL only be marked `outdated` when a new identity is activated (approve VS, upload logo) — NOT at the moment of removal.

#### Scenario: Removing VS preserves profile as synced fallback

- **WHEN** a visual signature is removed (DELETE /visual-signature)
- **THEN** `identity_state` SHALL become `'text_only'`
- **AND** the associated `without_logo` profile SHALL remain `synced`

#### Scenario: Removing logo preserves profile as synced fallback

- **WHEN** a logo is removed (DELETE /logo)
- **THEN** `identity_state` SHALL become `'text_only'`
- **AND** the associated `logo_analysis` profile SHALL remain `synced`

### Requirement: Profile reconciliation on restore (visual signature only)

When restoring a visual signature, the reconciliation SHALL follow the same rules as activation:

1. Before activating the target profile, mark all other `synced` profiles with incompatible `source` as `outdated`
2. If the target profile is already the current `synced` profile (edge case: post-remove), it SHALL NOT be marked `outdated`

#### Scenario: Restore VS marks incompatible profiles as outdated

- **WHEN** a visual signature is restored
- **AND** the store has a `synced` `logo_analysis` profile
- **THEN** the `logo_analysis` profile SHALL be marked `outdated`
- **AND** the restored signature's profile SHALL become `synced`

#### Scenario: Restore VS marks previous VS profile as outdated

- **WHEN** a visual signature is restored (VS-to-VS swap)
- **AND** the store has a `synced` `without_logo` profile linked to a different (previously active) visual signature
- **THEN** the previous `without_logo` profile SHALL be marked `outdated`
- **AND** only the restored signature's `without_logo` profile SHALL remain `synced`



### Requirement: I1 — text_only has no active visual asset

When `identity_state` is `'text_only'`, the system SHALL have no active visual brand asset. This means:

- `logo_status` SHALL be `'explicit_none'` or `'not_provided'`
- `vs_status` SHALL be `'explicit_none'` or `'not_provided'`
- There SHALL be NO `store_brand_profile` with `status = 'synced'` for this store

#### Scenario: State includes status indicators

- **WHEN** `identity_state` is `'text_only'`
- **THEN** `logo_status` SHALL NOT be `'uploaded'`
- **AND** `vs_status` SHALL NOT be `'synced'` or `'generated'`

### Requirement: I2 — logo requires active logo asset

When `identity_state` is `'logo'`, the system SHALL have an active logo visual asset:

- `logo_status` SHALL be `'uploaded'`
- `vs_status` SHALL be `'explicit_none'` or `'not_provided'`
- There SHALL be exactly ONE `store_brand_profile` with `status = 'synced'` for this store
- The synced profile SHALL have a non-null `logo_asset_id`

#### Scenario: Logo state has uploaded status

- **WHEN** `identity_state` is `'logo'`
- **THEN** `logo_status` SHALL be `'uploaded'`
- **AND** `vs_status` SHALL NOT be `'synced'` or `'generated'`

### Requirement: I3 — visual_signature requires active VS

When `identity_state` is `'visual_signature'`, the system SHALL have an active visual signature asset:

- `vs_status` SHALL be `'synced'` or `'generated'`
- `logo_status` SHALL be `'explicit_none'` or `'not_provided'`
- There SHALL be exactly ONE `store_brand_profile` with `status = 'synced'` for this store
- The synced profile SHALL have a non-null `visual_signature_asset_id`

#### Scenario: Visual signature state has synced vs_status

- **WHEN** `identity_state` is `'visual_signature'`
- **THEN** `vs_status` SHALL be `'synced'` or `'generated'`
- **AND** `logo_status` SHALL NOT be `'uploaded'`

### Requirement: I4 — no direct logo ↔ visual_signature transition

The system SHALL NOT permit a direct transition between `logo` and `visual_signature`. Any change between these two states MUST pass through `text_only`:

- `logo → text_only → visual_signature`
- `visual_signature → text_only → logo`

#### Scenario: Logo to visual_signature requires text_only step

- **WHEN** `identity_state` is `'logo'`
- **AND** the user wants to switch to `visual_signature`
- **THEN** the system SHALL first require removing the logo (transition to `text_only`)
- **AND** only after that SHALL VS creation/approval be available

### Requirement: I5 — failure preserves previous state

If any persistence operation within a transition fails (database write failure, storage upload failure, constraint violation), the system SHALL:

- NOT change `identity_state`
- NOT change any `_status` field
- Restore any pre-existing synced profile to its original `status` if it was changed to `outdated` as part of the transition

#### Scenario: Logo upload failure preserves text_only

- **WHEN** user uploads a logo to a store with `identity_state` = `'text_only'`
- **AND** the profile insert fails after the old profile was marked as `outdated`
- **THEN** `identity_state` SHALL remain `'text_only'`
- **AND** the old profile SHALL be restored to `status = 'synced'`

### Requirement: I6 — state only changes after critical persistence

The system SHALL only update `identity_state` after ALL critical persistence operations in the transition have completed successfully. If the transition requires:
- File storage upload (S3/R2)
- Database insert/update
- Profile status change

Then `identity_state` SHALL only be updated after ALL of the above succeed. If any step fails, the state SHALL remain unchanged.

#### Scenario: Identity state updates after all persistence succeeds

- **WHEN** a transition involves file upload + DB insert + profile update
- **AND** all 3 steps succeed
- **THEN** `identity_state` SHALL be updated to the target state
- **AND** the response SHALL reflect the new state

#### Scenario: Partial failure keeps original state

- **WHEN** file upload succeeds but DB insert fails
- **THEN** `identity_state` SHALL remain unchanged
- **AND** any uploaded file SHALL be cleaned up
