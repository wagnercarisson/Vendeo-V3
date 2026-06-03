## ADDED Requirements

### Requirement: Approval modal

When the lojista clicks "Não tenho logo" on the Logo e Cores step, the system SHALL present an approval modal/tela showing the generated visual signature.

The modal SHALL display:
- The generated visual signature in preview (~400x400px)
- Current attempt indicator (1/3, 2/3, 3/3)
- Button "Aprovar" (primary green style)
- Button "Não gostei, gerar outra versão" (outline style, only active when attempts < 3)

At attempt 3/3, the "Não gostei, gerar outra versão" button SHALL be inactive with tooltip "Limite de 3 versões atingido".

At attempt 3/3, the system SHALL display all 3 generated signatures for re-evaluation, allowing the lojista to approve any of them or continue without logo.

#### Scenario: Modal shows at attempt 1/3

- **WHEN** the first visual signature is generated
- **THEN** the modal SHALL display the signature preview
- **AND** show "1/3" attempt indicator
- **AND** both "Aprovar" and "Não gostei, gerar outra versão" SHALL be active

#### Scenario: Modal blocks re-generation at 3/3

- **WHEN** attempt is 3/3
- **THEN** "Não gostei, gerar outra versão" SHALL be inactive
- **AND** a tooltip SHALL read "Limite de 3 versões atingido"

#### Scenario: Exhausted attempts show all signatures

- **WHEN** attempt is 3/3
- **THEN** the modal SHALL display all 3 generated signatures side by side
- **AND** the lojista SHALL be able to select and approve any of them
- **AND** a "Continuar sem logo" option SHALL be available

### Requirement: Approval flow

When the lojista clicks "Aprovar":

1. The current visual signature SHALL be set to `active` in `store_visual_signatures`
2. Any previous active signature SHALL be set to `archived`
3. `stores.logo_status` SHALL be set to `generated`
4. `stores.visual_signature_attempts` SHALL be reset to 0
5. The `generation_events` record matching `asset_id` and `attempt_number` SHALL be updated with `approved = true`
6. The Store Brand Profiler SHALL be invoked to infer the brand profile
7. The modal SHALL close
8. The system SHALL return to the Logo e Cores screen
9. The store preview SHALL display the approved visual signature
10. Primary and accent colors SHALL be pre-filled from the brand profiler output (or identity art director's suggested colors)
11. The lojista SHALL be able to edit colors manually before saving

#### Scenario: Approval persists signature and profile

- **WHEN** the lojista clicks "Aprovar"
- **THEN** the visual signature SHALL become `active`
- **AND** `logo_status` SHALL become `generated`
- **AND** `visual_signature_attempts` SHALL reset to 0
- **AND** a brand profile SHALL be created with `source = 'without_logo'`

#### Scenario: Colors pre-filled after approval

- **WHEN** the lojista returns to Logo e Cores after approval
- **THEN** the primary color input SHALL be pre-filled with the inferred primary color
- **AND** the accent color input SHALL be pre-filled with the inferred accent color
- **AND** the color inputs SHALL be editable by the lojista

### Requirement: Rejection flow

When the lojista clicks "Não gostei, gerar outra versão" and attempts < 3:

1. The current visual signature asset SHALL be marked as `archived` with metadata: `rejected: true`, optional rejection reason, `attempt_number`
2. The `generation_events` record matching `asset_id` and `attempt_number` SHALL be updated with `rejected = true`
3. An optional text field SHALL be presented: "O que você não gostou?"
3. The system SHALL NOT increment `visual_signature_attempts` (increment happens at generation time)
4. Rejection context SHALL be structured and sent to the Store Identity Art Director:
   - If feedback provided: include the lojista's text
   - If no feedback: "A versão anterior foi rejeitada sem feedback específico. Busque uma direção criativa completamente diferente."
5. The next generation SHALL proceed with incremented attempt

#### Scenario: Rejection archives current asset

- **WHEN** the lojista clicks "Não gostei, gerar outra versão"
- **THEN** the current draft signature SHALL be set to `archived`
- **AND** metadata SHALL include `rejected: true` and `attempt_number`

#### Scenario: Rejection with feedback

- **WHEN** the lojista provides feedback text
- **THEN** the feedback SHALL be included in the rejection context sent to the AI
- **AND** the metadata SHALL include the rejection reason

#### Scenario: Rejection without feedback

- **WHEN** the lojista does not provide feedback
- **THEN** the rejection context SHALL state "sem feedback específico"
- **AND** SHALL instruct the AI to seek a completely new direction

### Requirement: Rejection at exhausted attempts

When `visual_signature_attempts >= 3` and the lojista attempts to reject:

1. No new generation SHALL be allowed
2. `logo_status` SHALL be set to or maintained as `exhausted`
3. All 3 generated signatures SHALL be displayed for re-evaluation
4. The lojista SHALL be able to approve any of the 3 generated signatures
5. A "Continuar sem logo" option SHALL be available

#### Scenario: Exhausted shows re-evaluation

- **WHEN** `visual_signature_attempts >= 3`
- **THEN** all 3 archived signatures SHALL be displayed
- **AND** each signature SHALL have an "Aprovar" button
- **AND** a "Continuar sem logo" link SHALL be displayed

#### Scenario: Approve from exhausted state

- **WHEN** the lojista approves one of the 3 signatures after exhaustion
- **THEN** the selected signature SHALL become `active`
- **AND** `logo_status` SHALL become `generated`
- **AND** the normal approval flow SHALL proceed

#### Scenario: Continue without logo from exhausted state

- **WHEN** the lojista clicks "Continuar sem logo" after exhausting 3 attempts
- **THEN** `logo_status` SHALL be set to `explicit_none`
- **AND** `visual_signature_attempts` SHALL remain 3
- **AND** all 3 archived signatures SHALL remain available for future re-evaluation
- **AND** no new generation SHALL be available in this version

### Requirement: Close modal without decision

If the lojista closes the approval modal without approving or rejecting:

1. The current draft signature SHALL remain as `draft` in `store_visual_signatures`
2. When the lojista revisits the Logo e Cores screen, the system SHALL detect the pending draft
3. The system SHALL offer to resume from where the lojista left off

#### Scenario: Draft persists after modal close

- **WHEN** the lojista closes the modal without deciding
- **THEN** the latest draft signature SHALL remain with `status = 'draft'`
- **AND** the system SHALL resume the flow on next visit

### Requirement: Sequential generation (no batching)

The system SHALL generate exactly 1 visual signature per invocation, sequentially. The system SHALL NOT generate 3 versions at once. Each generation requires the lojista's decision (approve or reject) before the next generation begins.

#### Scenario: One generation per invocation

- **WHEN** the lojista clicks "Não tenho logo"
- **THEN** exactly 1 visual signature SHALL be generated
- **AND** the system SHALL wait for lojista decision before generating another

### Requirement: Generation attempt tracking

`visual_signature_attempts` SHALL count versions generated, not rejections:
- Generation 1 → `visual_signature_attempts = 1`
- After rejection, Generation 2 → `visual_signature_attempts = 2`
- After rejection, Generation 3 → `visual_signature_attempts = 3`
- After approval → `visual_signature_attempts = 0` (reset)

The attempt number SHALL be incremented at the moment of generation, not at the moment of rejection.

#### Scenario: Attempt increments on generation

- **WHEN** a visual signature is generated
- **THEN** `visual_signature_attempts` SHALL be incremented by 1

#### Scenario: Attempt resets on approval

- **WHEN** a visual signature is approved
- **THEN** `visual_signature_attempts` SHALL be reset to 0

#### Scenario: Attempt not incremented on rejection

- **WHEN** a visual signature is rejected
- **THEN** `visual_signature_attempts` SHALL remain unchanged
