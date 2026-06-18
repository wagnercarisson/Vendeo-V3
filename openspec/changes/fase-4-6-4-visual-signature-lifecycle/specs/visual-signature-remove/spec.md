> **Purpose**: Defines the visual signature removal endpoint — archive active signature, transition identity_state to text_only, preserve brand profiles as fallback.

## Requirements

### Requirement: Remove visual signature — DELETE /api/store/[id]/visual-signature

The system SHALL expose a `DELETE /api/store/[id]/visual-signature` endpoint that removes the active visual signature and transitions the store back to `text_only`.

The endpoint SHALL execute the following operations sequentially, with error handling at each step (partial unique index on `(store_id) WHERE status = 'active'` at `store_visual_signatures` serves as safety net to prevent duplicate active signatures):

1. Validate that the store exists and has an active visual signature (`store_visual_signatures.status = 'active'`)
2. Set the active signature's status to `archived`
3. Update the store:
   - `identity_state` → `'text_only'`
   - `logo_status` → `'explicit_none'` (via IDENTITY_TO_LOGO_STATUS mapping)
   - `visual_signature_attempts` SHALL be preserved (NOT reset)
4. The brand profile (`source = 'without_logo'` associated with the visual signature) SHALL remain `synced` — it serves as fallback visual direction in `text_only`
5. No brand profiles SHALL be marked `outdated` by this operation
6. No `store_brand_assets` SHALL be affected by this operation

If no active signature exists, the endpoint SHALL return HTTP 404:
```json
{ "error": "Nenhuma assinatura visual ativa para remover." }
```

#### Scenario: Successful removal archives signature and transitions state

- **WHEN** a DELETE request is sent to `/api/store/{store_id}/visual-signature`
- **AND** the store has an active visual signature
- **THEN** the signature status SHALL become `archived`
- **AND** `stores.identity_state` SHALL become `'text_only'`
- **AND** `stores.logo_status` SHALL become `'explicit_none'`
- **AND** `stores.visual_signature_attempts` SHALL remain unchanged
- **AND** the brand profile SHALL remain `synced`
- **AND** no brand profiles SHALL be marked `outdated`

#### Scenario: Removal without active signature returns 404

- **WHEN** a DELETE request is sent to `/api/store/{store_id}/visual-signature`
- **AND** the store has no active visual signature
- **THEN** HTTP 404 SHALL be returned
- **AND** the response body SHALL contain an error message

#### Scenario: After removal, logo upload is permitted

- **WHEN** DELETE /visual-signature succeeds
- **AND** `identity_state` becomes `'text_only'`
- **THEN** `POST /api/store/{store_id}/logo` SHALL be accepted (no longer blocked by identity_state)

### Requirement: Profile preservation on removal

When a visual signature is removed, the associated brand profile (`source = 'without_logo'`, linked via `visual_signature_id`) SHALL NOT have its status changed. It SHALL remain `synced` as a fallback visual direction for the `text_only` state.

This profile SHALL only be marked `outdated` when a new identity is activated (upload of logo, approval of a new visual signature).

#### Scenario: Profile preserved after removal

- **WHEN** DELETE /visual-signature succeeds
- **THEN** the brand profile associated with the archived signature SHALL remain `synced`
- **AND** `active_logo_asset_id` SHALL remain unchanged
