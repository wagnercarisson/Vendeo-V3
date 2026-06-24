## ADDED Requirements

### Requirement: I1 — text_only has no active visual asset

When `stores.identity_state = 'text_only'`:
- There SHALL NOT exist a logo with `status = 'active'` for this store
- There SHALL NOT exist a visual signature with `status = 'active'` for this store

This does NOT imply absence of visual direction. `text_only` SHALL permit a brand profile with `status = 'synced'` used as the current visual direction.

#### Scenario: text_only store has no active logo

- **WHEN** `stores.identity_state` is `'text_only'`
- **THEN** a query for active `store_brand_assets` with `asset_type = 'logo'` SHALL return zero active records

#### Scenario: text_only store has no active visual signature

- **WHEN** `stores.identity_state` is `'text_only'`
- **THEN** a query for `store_visual_signatures` with `status = 'active'` SHALL return zero active records

#### Scenario: text_only store may have synced brand profile

- **WHEN** `stores.identity_state` is `'text_only'`
- **THEN** a brand profile with `status = 'synced'` MAY exist
- **AND** that profile SHALL be valid as visual direction for campaigns

### Requirement: I2 — logo requires active logo asset

When `stores.identity_state = 'logo'`:
- There SHALL exist exactly one active original logo asset (`store_brand_assets` with `status = 'active'`, `asset_type = 'logo'`, and `variant_type = 'original'`) for this store
- Zero or more technical variants (`normalized`, `on_light`, `on_dark`, `square_safe`, `horizontal_safe`) MAY be active alongside the original
- The UI SHALL treat this logo as the current visual identity
- No active visual signature SHALL exist

#### Scenario: logo state has active original logo

- **WHEN** `stores.identity_state` is `'logo'`
- **THEN** exactly one `store_brand_assets` record with `variant_type = 'original'`, `status = 'active'`, and `asset_type = 'logo'` SHALL exist

#### Scenario: logo state without active logo is violation

- **WHEN** `stores.identity_state` is `'logo'`
- **AND** no active logo is found
- **THEN** this SHALL be considered an invariant violation — the system SHALL NOT allow this state

### Requirement: I3 — visual_signature requires active VS

When `stores.identity_state = 'visual_signature'`:
- There SHALL exist exactly one active visual signature (`store_visual_signatures` with `status = 'active'`) for this store
- The UI SHALL treat this VS as the current visual identity

#### Scenario: visual_signature state has active VS

- **WHEN** `stores.identity_state` is `'visual_signature'`
- **THEN** exactly one `store_visual_signatures` record SHALL exist with `status = 'active'`

#### Scenario: visual_signature state without active VS is violation

- **WHEN** `stores.identity_state` is `'visual_signature'`
- **AND** no active VS is found
- **THEN** this SHALL be considered an invariant violation

### Requirement: I4 — no direct logo ↔ visual_signature transition

The system SHALL NOT allow direct transition between `logo` and `visual_signature`:
- `logo → visual_signature` SHALL be blocked
- `visual_signature → logo` SHALL be blocked

The user SHALL remove the active identity before applying a different one (transition through `text_only`).

#### Scenario: Upload logo blocked when VS active

- **WHEN** a logo upload is attempted
- **AND** `stores.identity_state` is `'visual_signature'`
- **THEN** the upload SHALL be rejected with HTTP 409
- **AND** the error SHALL instruct the user to remove the VS first

#### Scenario: Restore VS blocked when logo active

- **WHEN** a VS restore is attempted
- **AND** `stores.identity_state` is `'logo'`
- **THEN** the restore SHALL be rejected with HTTP 409
- **AND** the error SHALL instruct the user to remove the logo first

### Requirement: I5 — failure preserves previous state

If a transition fails:
- `stores.identity_state` SHALL remain in the previous state
- The previously active asset/VS SHALL remain active if one existed
- The UI SHALL NOT declare success
- The error SHALL be visible for diagnosis

#### Scenario: Transition failure does not change identity_state

- **WHEN** a transition is initiated (e.g., logo upload, VS activation)
- **AND** it fails before critical persistence completes
- **THEN** `stores.identity_state` SHALL remain unchanged
- **AND** NO new asset SHALL be activated

#### Scenario: Error visibility on failure

- **WHEN** a transition fails
- **THEN** the error message SHALL be returned to the caller
- **AND** the UI SHALL display the error in a dismissible banner

### Requirement: I6 — state only changes after critical persistence

The system SHALL only update `stores.identity_state` after the critical persistence required for the new state is confirmed complete.

- `text_only → logo`: only after logo is persisted, active, and variants generated
- `text_only → visual_signature`: only after VS is persisted and active
- `logo → text_only`: only after the active logo is archived
- `visual_signature → text_only`: only after the active VS is archived

#### Scenario: identity_state not updated before logo persistence

- **WHEN** a logo upload is in progress
- **AND** the asset has not yet been persisted as active
- **THEN** `stores.identity_state` SHALL NOT be updated to `'logo'`

#### Scenario: identity_state updated after logo activation

- **WHEN** the logo has been persisted and activated
- **THEN** `stores.identity_state` SHALL be updated to `'logo'`

#### Scenario: identity_state not updated before VS approval

- **WHEN** a VS approval is in progress
- **AND** the VS has not yet been set to `'active'`
- **THEN** `stores.identity_state` SHALL NOT be updated to `'visual_signature'`

#### Scenario: identity_state updated after archiving logo

- **WHEN** the active logo has been archived
- **THEN** `stores.identity_state` SHALL be updated to `'text_only'`
