> **Purpose**: Central identity state transition orchestrator for the Vendeo store identity system. Defines validation rules for all permitted identity state transitions and handles dual-population of `store_brand_profiles` + `store_identity`.

## Purpose

The identity-state-transitions capability ensures that all identity state changes (`text_only`, `logo`, `visual_signature`) follow a controlled, validated path. It prevents illegal transitions, manages dual-population of profile and identity records, and provides a single orchestration point for all route handlers that modify identity state.

## Requirements

### Requirement: Central transition orchestrator

The system SHALL provide a central transition function (`transition()`) that:

1. Accepts a `store_id`, the `targetState`, and a `persistFn` callback that performs the actual persistence work for that route handler
2. Validates the transition is permitted via `assertCanTransition(currentState, targetState)`
3. Calls `persistFn()` only if the transition is permitted
4. Returns `{ identity: storeIdentity, profile: storeBrandProfile | null }` — the dual-population result

#### Scenario: Transition validates before persistence

- **WHEN** `transition('store-1', 'logo', persistFn)` is called
- **AND** `currentState` is `text_only`
- **THEN** `assertCanTransition` SHALL return true
- **AND** `persistFn` SHALL be called with `store-1` and `'logo'`

#### Scenario: Transition blocks illegal move

- **WHEN** `transition('store-1', 'logo', persistFn)` is called
- **AND** `currentState` is `visual_signature`
- **THEN** `assertCanTransition` SHALL return false
- **AND** `persistFn` SHALL NOT be called
- **AND** the system SHALL throw a `TransitionError` with code `ILLEGAL_TRANSITION`

### Requirement: assertCanTransition validator

The system SHALL provide `assertCanTransition(currentState, targetState)` that validates the transition against a hardcoded set of permitted transitions:

| From | To | Permitted |
|------|----|-----------|
| text_only | logo | ✅ |
| logo | text_only | ✅ |
| text_only | visual_signature | ✅ |
| visual_signature | text_only | ✅ |
| logo | visual_signature | ❌ |
| visual_signature | logo | ❌ |

#### Scenario: Permitted transitions

- **WHEN** `assertCanTransition` is called with any of the 4 permitted pairs
- **THEN** it SHALL return `{ permitted: true, reason: undefined }`

#### Scenario: Blocked transitions

- **WHEN** `assertCanTransition` is called with `('logo', 'visual_signature')` or `('visual_signature', 'logo')`
- **THEN** it SHALL throw a `TransitionError` with code `ILLEGAL_TRANSITION`
- **AND** message SHALL explain "Cannot transition directly between logo and visual_signature"

### Requirement: Orchestrator does NOT handle persistence directly

The orchestrator SHALL NOT perform database writes itself. It delegates persistence to the route handler via the `persistFn` callback. The orchestrator's responsibility is:

1. Validate the transition
2. Call `persistFn` if valid
3. Return the dual-population result
4. Perform compensation (rollback) if `persistFn` fails via `onCompensate`

#### Scenario: Orchestrator delegates to persistFn

- **WHEN** `transition()` is called with a valid transition
- **THEN** the orchestrator SHALL call `persistFn(storeId, targetState)` exactly once
- **AND** SHALL NOT perform any direct database operations of its own

### Requirement: Dual-population result

The orchestrator SHALL return both the updated `store_identity` record and the affected `store_brand_profile` record (if any) in a structured result:

```typescript
{
  identity: StoreIdentity;
  profile: StoreBrandProfile | null;
}
```

#### Scenario: Logo transition returns both records

- **WHEN** transitioning from `text_only` to `logo`
- **THEN** the result SHALL include both `identity` (with identity_state = 'logo') and `profile` (with status = 'synced')

#### Scenario: Text-only removal returns identity only

- **WHEN** transitioning from `logo` to `text_only`
- **THEN** the result SHALL include `identity` (with identity_state = 'text_only') and `profile` as null (no active synced profile)

### Requirement: Profile preservation on text_only

When transitioning TO `text_only` (via logo removal or VS removal), the system SHALL NOT delete the existing `store_brand_profile`. The synced profile SHALL remain `synced` as a fallback visual direction.

#### Scenario: Logo removal preserves profile as synced fallback

- **WHEN** logo is removed (transition to text_only)
- **THEN** the previously synced profile SHALL remain `synced` (not marked outdated)
- **AND** the profile record SHALL NOT be deleted

### Requirement: Logo upload validation

The logo upload route SHALL validate via the orchestrator that the transition from the current state to `logo` is permitted before processing the upload.

#### Scenario: Logo upload succeeds when permitted

- **WHEN** `identity_state` is `text_only`
- **AND** user uploads a logo
- **THEN** the orchestrator SHALL permit the transition
- **AND** the upload SHALL proceed

#### Scenario: Logo upload blocked when illegal

- **WHEN** `identity_state` is `visual_signature`
- **AND** user attempts to upload a logo
- **THEN** the orchestrator SHALL block the transition
- **AND** the handler SHALL return HTTP 400 with error `ILLEGAL_TRANSITION`

### Requirement: Logo removal contract

The logo removal route SHALL:

1. Call `transition('store-1', 'text_only', persistFn)` to validate + orchestrate
2. Mark the synced profile as `outdated`
3. Update `store_identity` identity_state to `text_only`, logo_status to `explicit_none`
4. Return the updated dual-population result

#### Scenario: Logo removal succeeds

- **WHEN** user removes a logo (identity_state = 'logo')
- **THEN** the route SHALL call the orchestrator with target `text_only`
- **AND** the synced profile SHALL be marked as `outdated`
- **AND** identity_state SHALL change to `text_only`
- **AND** logo_status SHALL change to `explicit_none`

### Requirement: VS approve validation

The visual signature approve route SHALL validate via the orchestrator that the transition to `visual_signature` is permitted.

#### Scenario: VS approve succeeds when permitted

- **WHEN** `identity_state` is `text_only`
- **AND** user approves a visual signature
- **THEN** the orchestrator SHALL permit the transition
- **AND** the VS approval SHALL proceed

#### Scenario: VS approve blocked when illegal

- **WHEN** `identity_state` is `logo`
- **AND** user attempts to approve a visual signature
- **THEN** the orchestrator SHALL block the transition
- **AND** the handler SHALL return HTTP 400 with error `ILLEGAL_TRANSITION`

### Requirement: VS removal contract

The visual signature removal route SHALL:

1. Call `transition('store-1', 'text_only', persistFn)` to validate + orchestrate
2. Mark the synced profile as `outdated`
3. Update `store_identity` identity_state to `text_only`, vs_status to `explicit_none`
4. Return the updated dual-population result

#### Scenario: VS removal succeeds

- **WHEN** user removes a visual signature (identity_state = 'visual_signature')
- **THEN** the route SHALL call the orchestrator with target `text_only`
- **AND** the synced profile SHALL be marked as `outdated`
- **AND** identity_state SHALL change to `text_only`
- **AND** vs_status SHALL change to `explicit_none`

### Requirement: VS restore validation

The visual signature restore route SHALL validate via the orchestrator that the transition to `visual_signature` is permitted.

#### Scenario: VS restore succeeds when permitted

- **WHEN** `identity_state` is `text_only`
- **AND** user restores a visual signature
- **THEN** the orchestrator SHALL permit the transition
- **AND** the restore SHALL proceed

#### Scenario: VS restore blocked when illegal

- **WHEN** `identity_state` is `logo`
- **AND** user attempts to restore a visual signature
- **THEN** the orchestrator SHALL block the transition
- **AND** the handler SHALL return HTTP 400 with error `ILLEGAL_TRANSITION`
