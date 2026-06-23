## ADDED Requirements

### Requirement: Central transition orchestrator

The system SHALL provide a central orchestrator at `src/lib/identity-transitions.ts` responsible for validating, executing, and confirming each identity state transition. The orchestrator SHALL expose an async function `transition(storeId, type, payload?)` supporting exactly 4 transition types:

- `text_only_to_logo`
- `logo_to_text_only`
- `text_only_to_visual_signature`
- `visual_signature_to_text_only`

Each transition SHALL follow this lifecycle:
1. Validate `identity_state` current — reject if incompatible with the requested transition
2. Execute the critical persistence for this transition (archive previous asset on removals; activate new asset on activations)
3. Only after critical persistence succeeds, update `stores.identity_state` to the target state
4. If failure occurs before critical persistence, maintain previous state
5. If critical persistence completes but `identity_state` update fails, execute compensation when possible or return error recording the detectable partial state — the UI SHALL NOT declare success

#### Scenario: Orchestrator rejects text_only_to_logo when identity_state is visual_signature

- **WHEN** `transition(storeId, 'text_only_to_logo')` is called
- **AND** `stores.identity_state` is `'visual_signature'`
- **THEN** the orchestrator SHALL reject with an error indicating the active VS must be removed first
- **AND** `stores.identity_state` SHALL remain `'visual_signature'`

#### Scenario: Orchestrator rejects logo_to_text_only when identity_state is visual_signature

- **WHEN** `transition(storeId, 'logo_to_text_only')` is called
- **AND** `stores.identity_state` is `'visual_signature'`
- **THEN** the orchestrator SHALL reject with an error indicating no active logo to remove

#### Scenario: Orchestrator rejects direct logo to visual_signature

- **WHEN** `transition(storeId, 'text_only_to_visual_signature')` is called
- **AND** `stores.identity_state` is `'logo'`
- **THEN** the orchestrator SHALL reject — user must remove logo first

#### Scenario: Orchestrator rejects direct visual_signature to logo

- **WHEN** `transition(storeId, 'text_only_to_logo')` is called
- **AND** `stores.identity_state` is `'visual_signature'`
- **THEN** the orchestrator SHALL reject — user must remove VS first

#### Scenario: Successful text_only_to_logo transition

- **WHEN** `transition(storeId, 'text_only_to_logo')` is called
- **AND** `stores.identity_state` is `'text_only'`
- **AND** the logo upload/activation succeeds
- **THEN** `stores.identity_state` SHALL become `'logo'`
- **AND** `stores.logo_status` SHALL become `'uploaded'`

#### Scenario: Successful logo_to_text_only transition

- **WHEN** `transition(storeId, 'logo_to_text_only')` is called
- **AND** `stores.identity_state` is `'logo'`
- **AND** the active logo is archived
- **THEN** `stores.identity_state` SHALL become `'text_only'`
- **AND** `stores.logo_status` SHALL become `'explicit_none'`
- **AND** the brand profile SHALL remain `synced`

#### Scenario: Successful text_only_to_visual_signature transition

- **WHEN** `transition(storeId, 'text_only_to_visual_signature')` is called
- **AND** `stores.identity_state` is `'text_only'`
- **AND** the VS is approved/activated
- **THEN** `stores.identity_state` SHALL become `'visual_signature'`
- **AND** `stores.logo_status` SHALL become `'generated'`

#### Scenario: Successful visual_signature_to_text_only transition

- **WHEN** `transition(storeId, 'visual_signature_to_text_only')` is called
- **AND** `stores.identity_state` is `'visual_signature'`
- **AND** the active VS is archived
- **THEN** `stores.identity_state` SHALL become `'text_only'`
- **AND** `stores.logo_status` SHALL become `'explicit_none'`
- **AND** the brand profile SHALL remain `synced`

#### Scenario: Failure before critical persistence maintains state

- **WHEN** a transition's critical persistence fails (e.g., logo upload fails)
- **THEN** `stores.identity_state` SHALL remain unchanged
- **AND** no asset SHALL be activated or archived
- **AND** an error SHALL be returned to the caller

#### Scenario: Critical persistence succeeds but identity_state update fails

- **WHEN** the asset is archived/activated successfully
- **BUT** the `stores.identity_state` UPDATE fails (network error, constraint violation)
- **THEN** the orchestrator SHALL attempt to reverse the persistence change (compensation)
- **AND** if compensation fails, the orchestrator SHALL log the partial state
- **AND** an error SHALL be returned — the UI SHALL NOT declare success

### Requirement: Orchestrator scope limitation

The orchestrator SHALL NOT reimplement BrandDirector, visual signature generation, logo analysis, color management, or advanced lifecycle logic. It SHALL only validate permitted transitions and coordinate the minimum state/asset persistence already existing in each route's flow.

#### Scenario: Orchestrator does not call BrandDirector

- **WHEN** `transition(storeId, 'text_only_to_logo')` is called
- **THEN** the orchestrator SHALL NOT execute BrandDirector analysis
- **AND** the BrandDirector analysis SHALL happen before the transition (by the calling route)
- **AND** the logo asset activation SHALL happen inside the transition flow, after identity_state validation

#### Scenario: Orchestrator does not generate visual signatures

- **WHEN** `transition(storeId, 'text_only_to_visual_signature')` is called
- **THEN** the orchestrator SHALL NOT generate VS images
- **AND** the VS preparation/generation SHALL happen before the transition (by the calling route)
- **AND** the VS activation SHALL happen inside the transition flow, after identity_state validation and before the final store update

### Requirement: Dual-population on transition

When the orchestrator updates `stores.identity_state`, it SHALL also update `stores.logo_status` in the same operation using the IDENTITY_TO_LOGO_STATUS mapping.

#### Scenario: text_only sets logo_status to explicit_none

- **WHEN** the orchestrator sets `identity_state` to `'text_only'`
- **THEN** `logo_status` SHALL be set to `'explicit_none'` in the same UPDATE

#### Scenario: logo sets logo_status to uploaded

- **WHEN** the orchestrator sets `identity_state` to `'logo'`
- **THEN** `logo_status` SHALL be set to `'uploaded'` in the same UPDATE

#### Scenario: visual_signature sets logo_status to generated

- **WHEN** the orchestrator sets `identity_state` to `'visual_signature'`
- **THEN** `logo_status` SHALL be set to `'generated'` in the same UPDATE

### Requirement: Profile preservation on removal transitions

When transitioning `logo` → `text_only` or `visual_signature` → `text_only`, the previously active brand profile SHALL remain `synced` as a fallback visual direction. It SHALL NOT be marked `outdated` by the removal operation.

#### Scenario: Logo removal preserves synced profile

- **WHEN** `transition(storeId, 'logo_to_text_only')` completes
- **THEN** the brand profile associated with the removed logo SHALL remain `synced`
- **AND** `active_logo_asset_id` on the profile SHALL remain unchanged

#### Scenario: VS removal preserves synced profile

- **WHEN** `transition(storeId, 'visual_signature_to_text_only')` completes
- **THEN** the brand profile associated with the archived VS SHALL remain `synced`

### Requirement: Visual signature restore — identity_state validation

The `POST /api/store/[id]/visual-signature/restore` endpoint SHALL validate `stores.identity_state` before proceeding. Restore SHALL be permitted ONLY when `identity_state = 'text_only'`. Restore SHALL be blocked when `identity_state = 'logo'` or `'visual_signature'` — the user must remove the active identity before restoring a VS.

No drift, revalidation, or realignment logic SHALL be added in this phase — restore is scoped to transition validation only.

#### Scenario: Restore permitted from text_only

- **WHEN** a restore request is sent to `/api/store/{store_id}/visual-signature/restore`
- **AND** `stores.identity_state` is `'text_only'`
- **THEN** the restore SHALL proceed (existing restore logic unchanged)

#### Scenario: Restore rejected from logo

- **WHEN** a restore request is sent to `/api/store/{store_id}/visual-signature/restore`
- **AND** `stores.identity_state` is `'logo'`
- **THEN** HTTP 409 SHALL be returned
- **AND** `requires_logo_removal` SHALL be `true`
- **AND** `current_identity_state` SHALL be `'logo'`

#### Scenario: Restore rejected from visual_signature (no direct swap)

- **WHEN** a restore request is sent to `/api/store/{store_id}/visual-signature/restore`
- **AND** `stores.identity_state` is `'visual_signature'`
- **THEN** HTTP 409 SHALL be returned
- **AND** `requires_identity_removal` SHALL be `true`
- **AND** `current_identity_state` SHALL be `'visual_signature'`
- **AND** the error SHALL instruct the user to remove the active VS first

### Requirement: Logo upload — identity_state validation

The `POST /api/store/[id]/logo` endpoint SHALL validate `stores.identity_state` before processing. Upload SHALL be permitted ONLY when `identity_state = 'text_only'`. Upload SHALL be blocked when `identity_state = 'logo'` or `'visual_signature'` — the user must remove the active identity before uploading a logo.

#### Scenario: Upload blocked on visual_signature

- **WHEN** a logo upload is attempted
- **AND** `stores.identity_state` is `'visual_signature'`
- **THEN** HTTP 409 SHALL be returned
- **AND** the error SHALL indicate the active VS must be removed first

#### Scenario: Upload blocked on logo (no direct replacement)

- **WHEN** a logo upload is attempted
- **AND** `stores.identity_state` is `'logo'`
- **THEN** HTTP 409 SHALL be returned
- **AND** the error SHALL indicate the active logo must be removed first

#### Scenario: Upload permitted on text_only

- **WHEN** a logo upload is attempted
- **AND** `stores.identity_state` is `'text_only'`
- **THEN** the upload SHALL proceed normally

### Requirement: Logo removal — contract

The `DELETE /api/store/[id]/logo` endpoint SHALL archive the active logo and transition the store to `text_only`. It SHALL NOT offer history, management, or reapplication of the removed logo in the UI.

Before calling DELETE, the UI SHALL display a warning: "Ao remover o logo, ele não ficará disponível para reaplicação pela interface. Você poderá enviar o arquivo novamente quando quiser."

#### Scenario: Logo removal archives and transitions

- **WHEN** `DELETE /api/store/{store_id}/logo` is called
- **AND** `stores.identity_state` is `'logo'`
- **THEN** the active logo assets SHALL be archived
- **AND** `stores.identity_state` SHALL become `'text_only'`
- **AND** `stores.logo_status` SHALL become `'explicit_none'`
- **AND** the associated brand profile SHALL remain `synced`

#### Scenario: UI shows warning before logo removal

- **WHEN** the user clicks "Remover logo" in the UI
- **THEN** a confirmation dialog SHALL appear with the removal warning text
- **AND** the DELETE request SHALL only be sent after the user confirms
