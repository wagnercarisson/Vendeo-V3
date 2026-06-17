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
