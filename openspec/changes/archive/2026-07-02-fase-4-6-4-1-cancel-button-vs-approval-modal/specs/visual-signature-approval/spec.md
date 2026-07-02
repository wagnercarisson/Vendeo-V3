> **Purpose**: Delta spec for visual-signature-approval capability — replaces "Continuar sem logo/assinatura" button in error phase with "Cancelar" that only closes the modal via `onClose()`.

## ADDED Requirements

### Requirement: Error phase — secondary button SHALL close modal without mutations

When the approval modal enters the `"error"` phase (regardless of error origin, including generation, timeout, drift validation, or approval failure), the system SHALL display a secondary button labeled "Cancelar" that closes the modal without persisting any identity decision.

The "Cancelar" button SHALL:
- Call `onClose()` to dismiss the modal
- Not initiate any new requests or persist additional identity decisions

The "Cancelar" button SHALL NOT:
- Execute any fetch/PATCH request
- Call `onComplete()` with any `logoStatus` value
- Initiate any new API request

The resulting state after "Cancelar" continues to be the responsibility of operations already initiated prior to the click.

The primary button label in the error phase SHALL adapt to context:
- When `state.drift` is present: "Ajustar assinatura"
- Otherwise: "Tentar novamente"

#### Scenario: Cancelar closes modal without mutations

- **WHEN** the approval modal is in the `"error"` phase
- **AND** the lojista clicks "Cancelar"
- **THEN** the modal SHALL close
- **AND** `onClose()` SHALL be called
- **AND** `onComplete()` SHALL NOT be called
- **AND** no fetch/PATCH request SHALL be initiated by the click
- **AND** Step 2 SHALL return to its state before the modal opened, subject to any mutations already persisted by prior operations

#### Scenario: Cancelar does not interfere with prior generation

- **WHEN** the lojista clicks "Cancelar" after a generation timeout
- **THEN** the button SHALL NOT initiate any new request
- **AND** a prior generation request may still complete server-side (backend timeout exceeds client timeout)
- **AND** the resulting persisted state MAY diverge from what the client expects on next load
