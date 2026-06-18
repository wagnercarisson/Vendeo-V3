## ADDED Requirements

### Requirement: identity_state sync on approval

When the lojista approves a visual signature, the system SHALL update the store's `identity_state` to `'visual_signature'` and `logo_status` to `'generated'` in the same operation. This ensures the UI (Step 2) reflects the active visual signature state.

#### Scenario: Approval sets identity_state to visual_signature

- **WHEN** the lojista clicks "Aprovar"
- **THEN** `stores.identity_state` SHALL be set to `'visual_signature'`
- **AND** `stores.logo_status` SHALL be set to `'generated'`
- **AND** both fields SHALL be updated in the same UPDATE statement

### Requirement: Rejection context propagation to review phase

When the lojista provides rejection feedback in the "feedback" phase, the `rejectionContext` SHALL be preserved in the modal state and propagated to `generate()` when the user chooses to generate a new version from the "review" phase.

The modal SHALL store `rejectionContext` as component state across phases. When the user navigates from "feedback" to "review" (by confirming rejection) and then clicks "Gerar nova versão" (attempts < 3), the stored `rejectionContext` SHALL be passed to the `generate-without-logo` API call.

#### Scenario: Rejection context passed from feedback to review generate

- **WHEN** the lojista provides feedback in the "feedback" phase
- **AND** confirms the rejection
- **AND** the modal transitions to "review" phase (existing signatures listed)
- **AND** the lojista clicks "Gerar nova versão" (attempts < 3)
- **THEN** the stored `rejectionContext` SHALL be sent to the `generate-without-logo` API
- **AND** the new generation SHALL include the rejection context in the prompt

#### Scenario: Rejection context preserved across phase transitions

- **WHEN** the lojista rejects without feedback
- **AND** the modal transitions to "review" phase
- **AND** the lojista clicks "Gerar nova versão"
- **THEN** the rejection context SHALL state "sem feedback específico"
- **AND** SHALL instruct to seek a completely new direction
