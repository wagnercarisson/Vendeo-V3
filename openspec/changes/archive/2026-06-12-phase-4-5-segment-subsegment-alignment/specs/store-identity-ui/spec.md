## MODIFIED Requirements

### Requirement: Segment dropdown uses STORE_SEGMENTS

The existing `Form fields` requirement SHALL be updated: the segment dropdown SHALL use `STORE_SEGMENTS` (13 options) instead of `VALID_SEGMENTS` (10 options). The subsegment field SHALL change from optional text input to a conditional dropdown with 3 modes (dropdown rico, dropdown travado, campo aberto).

#### Scenario: Segment dropdown shows 13 options

- **WHEN** the segment dropdown is opened
- **THEN** 13 options SHALL be displayed
- **AND** the options SHALL match `STORE_SEGMENTS` values

#### Scenario: Subsegment renders dropdown for rich segment

- **WHEN** a rich segment (e.g. `moda-calcados-acessorios`) is selected
- **THEN** the subsegment field SHALL render a dropdown with subsegments from `STORE_SUBSEGMENTS[segment]`

#### Scenario: Subsegment renders disabled dropdown for travado segment

- **WHEN** a travado segment (e.g. `mercados-mercearias`) is selected
- **THEN** the subsegment field SHALL render a disabled dropdown with the single auto-selected option

#### Scenario: Subsegment renders free-text for outros

- **WHEN** the segment `outros` is selected
- **THEN** the subsegment field SHALL render a free-text input

### Requirement: Subsegment reset on segment change

When the user changes the segment, the subsegment value SHALL be cleared and the "Outro" field SHALL be closed.

#### Scenario: Subsegment cleared on segment change

- **WHEN** the user changes the segment dropdown
- **THEN** the subsegment value SHALL be reset to empty
- **AND** any open "Outro" free-text field SHALL be closed

## ADDED Requirements

### Requirement: Segment validation uses STORE_SEGMENTS

The client-side validation SHALL check that the selected segment is one of the `STORE_SEGMENTS` values instead of `VALID_SEGMENTS`.

#### Scenario: Valid segment passes validation

- **WHEN** the user selects `moda-calcados-acessorios`
- **THEN** no segment validation error SHALL appear

#### Scenario: Invalid segment is rejected

- **WHEN** the user submits with segment set to an old value like `moda-vestuario`
- **THEN** the form SHALL reject the submission with a validation error
