## MODIFIED Requirements

### Requirement: Approval modal (MODIFIED)

When the lojista clicks "Não tenho logo" on the Logo e Cores step, the system SHALL present an approval modal/tela showing the generated visual signature.

The modal SHALL call `requireLegalClearance()` at the start of the flow with capability `"content_generation"`. If clearance is not ok, the modal SHALL NOT proceed with generation and SHALL display a blocking message with a link to `/legal/reaccept`.

All existing behavior ('standard' and 'substitution' modes, approval, re-generation, historical versions, credit handling) SHALL remain unchanged when clearance passes.

#### Scenario: VS generation blocked by legal clearance

- **WHEN** a user tries to generate a visual signature without valid legal acceptance
- **THEN** the modal SHALL display a blocking message
- **AND** SHALL NOT proceed with generation
- **AND** SHALL link to `/legal/reaccept`

#### Scenario: VS generation proceeds when clearance passes

- **WHEN** a user tries to generate a visual signature with valid legal acceptance
- **THEN** the modal SHALL proceed with the normal VS generation flow
