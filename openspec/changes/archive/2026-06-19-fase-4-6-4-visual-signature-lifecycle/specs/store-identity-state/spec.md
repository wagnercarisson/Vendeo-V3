## ADDED Requirements

### Requirement: Profile reconciliation on identity state transitions

When transitioning `identity_state` to a new active identity (activating a visual signature via approve or restore, uploading a logo), the system SHALL:

1. Mark all currently `synced` brand profiles whose `source` is incompatible with the new identity as `outdated`
2. Activate the target profile as `synced`

Compatibility matrix:

| Target identity | Target profile | Incompatible (marked outdated) |
|----------------|----------------|-------------------------------|
| `visual_signature` (approve/restore) | `without_logo` linked to the **target** `visual_signature_id` | Any other `synced` profile — including `without_logo` linked to a different `visual_signature_id`, `logo_analysis`, and `text_only` |
| `logo` (upload/restore) | `logo_analysis` (newly created or restored) | Any other `synced` profile — including `without_logo` and `text_only` |

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

### Requirement: Profile reconciliation on restore

When restoring a visual signature or logo, the reconciliation SHALL follow the same rules as activation:

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

#### Scenario: Restore logo with profile already synced (post-remove)

- **WHEN** a logo is restored
- **AND** the target profile is already the current `synced` profile (from post-remove fallback)
- **THEN** the profile SHALL NOT be marked `outdated`
- **AND** only the assets SHALL be re-activated
