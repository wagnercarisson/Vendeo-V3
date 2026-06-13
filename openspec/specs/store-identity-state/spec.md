> **Purpose**: Defines the identity state machine that governs the visual identity status of a store. Introduces `identity_state`, `text_only_origin`, and `manual_color_override` on `stores`, establishes the `text_only` state, and maintains dual-population with `logo_status` for backward compatibility.

## Requirements

### Requirement: identity_state field

The `stores` table SHALL have an `identity_state` column of type `text`, with a CHECK constraint limiting values to `'text_only'`, `'logo'`, or `'visual_signature'`. The default value SHALL be `'text_only'`.

| State | Meaning |
|-------|---------|
| `text_only` | Store has no logo and no visual signature. Identity inferred or user chose to continue without visual assets |
| `logo` | Store has an uploaded logo (via POST /api/store/[id]/logo) |
| `visual_signature` | Store has an AI-generated visual signature that was approved |

#### Scenario: identity_state column exists

- **WHEN** the `stores` table schema is inspected
- **THEN** there SHALL be a column `identity_state` of type `text`
- **AND** its default value SHALL be `'text_only'`

#### Scenario: CHECK constraint validates identity_state values

- **WHEN** a row is inserted with `identity_state = 'invalid'`
- **THEN** the insert SHALL fail with a CHECK constraint violation

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

The `stores` table SHALL have a `previous_identity_snapshot` column of type `jsonb`, intended for storing the previous identity state when transitioning between identity states (e.g., from logo back to text_only). In this phase (4.6.1), the column SHALL be created but SHALL NOT be populated — population will be implemented in a future subphase.

#### Scenario: previous_identity_snapshot column exists

- **WHEN** the `stores` table schema is inspected
- **THEN** there SHALL be a column `previous_identity_snapshot` of type `jsonb`
- **AND** it SHALL be nullable

### Requirement: Dual-population strategy

When the system enters the `text_only` state (via inference or direct state change), it SHALL update BOTH `identity_state` and `logo_status` in the same handler/operation. This ensures:

1. New code that reads `identity_state` works correctly
2. Existing code that reads `logo_status` (and depends on it for visual signature section rendering) continues to work

The dual-population rule: "whenever `identity_state` is set to `'text_only'`, `logo_status` SHALL be set to `'explicit_none'` in the same operation."

#### Scenario: Both fields updated in same operation

- **WHEN** the system sets `identity_state = 'text_only'`
- **THEN** `logo_status` SHALL be set to `'explicit_none'` in the same handler/controlled operation

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
