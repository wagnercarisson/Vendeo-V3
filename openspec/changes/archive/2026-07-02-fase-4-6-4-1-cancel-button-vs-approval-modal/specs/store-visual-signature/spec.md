> **Purpose**: Delta spec for store-visual-signature capability — generation failure in substitution mode SHALL NOT overwrite `logo_status`.

## ADDED Requirements

### Requirement: logo_status on generation failure SHALL respect mode and error type

When `POST /generate-without-logo` fails, `logo_status` behavior SHALL depend on the generation mode and error type:

- **mode: 'standard', non-storage error**: `logo_status` SHALL be set to `'failed'`. A failed attempt in standard mode means the store has no active VS (`identity_state = 'text_only'`), so `'failed'` accurately reflects the attempt outcome.
- **mode: 'standard', storage error**: `logo_status` SHALL NOT be modified. Storage errors are infrastructure failures that do not reflect the viability of VS generation.
- **mode: 'substitution', any error**: `logo_status` SHALL NOT be modified. The store has an active VS (`identity_state = 'visual_signature'`), and the generation failure does not change that the VS remains active.

#### Scenario: Standard mode non-storage error sets logo_status to failed

- **WHEN** POST /generate-without-logo is called with mode:'standard'
- **AND** the generation fails with a non-storage error or timeout
- **THEN** `logo_status` SHALL be set to `'failed'`

#### Scenario: Standard mode storage error preserves logo_status

- **WHEN** POST /generate-without-logo is called with mode:'standard'
- **AND** the generation fails with a storage error
- **THEN** `logo_status` SHALL NOT be modified

#### Scenario: Substitution mode error preserves logo_status

- **WHEN** POST /generate-without-logo is called with mode:'substitution'
- **AND** the generation fails (any error type)
- **THEN** `logo_status` SHALL NOT be modified
- **AND** `identity_state` SHALL remain `'visual_signature'`
