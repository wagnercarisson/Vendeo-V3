## MODIFIED Requirements

### Requirement: Restore visual signature — POST /api/store/[id]/visual-signature/restore

The system SHALL expose a `POST /api/store/[id]/visual-signature/restore` endpoint that restores an archived visual signature as active.

The endpoint SHALL accept:
```json
{ "signature_id": "uuid" }
```

The endpoint SHALL execute the following validation before proceeding:

1. Validate that the signature belongs to the requesting store (can be `archived` or `active`)
2. If already `active`, return success with no-op
3. Validate `identity_state` of the store:
   - `'text_only'` → permitted
   - `'visual_signature'` → **REJECTED**: user must remove the active visual signature before applying another
     ```json
     { "error": "Remova a assinatura ativa antes de aplicar outra versão.",
       "requires_vs_removal": true, "current_identity_state": "visual_signature" }
     ```
   - `'logo'` → REJECTED: user must remove the logo before restoring a visual signature
     ```json
     { "error": "Remova o logotipo ativo antes de restaurar uma assinatura visual.",
       "requires_logo_removal": true, "current_identity_state": "logo" }
     ```
4. Validate drift using `input_snapshot` against current store data with `content_used` (drift comparison rules unchanged from existing spec)

If validation passes (no drift), the endpoint SHALL:
5. Set the chosen signature as `active`
6. Update stores: `identity_state = 'visual_signature'`, `logo_status = 'generated'`
7. Reuse the existing brand profile associated with the signature:
   - Mark other synced profiles of the store as `outdated`
   - Activate the signature's profile as `synced`
8. Return `{ success: true, signature: { id, assetUrl, ... } }`

Restore SHALL NOT consume a credit — it does not call `reserveCredit` or `refundCredit`.

#### Scenario: Successful restore with no drift (text_only)

- **WHEN** a POST request is sent to `/api/store/{store_id}/visual-signature/restore`
- **AND** `identity_state` is `'text_only'`
- **AND** no drift is detected
- **THEN** the chosen signature SHALL become `active`
- **AND** `identity_state` SHALL become `'visual_signature'`
- **AND** `logo_status` SHALL become `'generated'`
- **AND** other synced brand profiles SHALL be marked `outdated`
- **AND** the signature's profile SHALL be activated as `synced`
- **AND** no credit SHALL be consumed

#### Scenario: Restore of already active signature is no-op

- **WHEN** the chosen signature is already `active`
- **THEN** the endpoint SHALL return `{ success: true }`
- **AND** no changes SHALL be made

#### Scenario: Restore rejected when identity_state is visual_signature

- **WHEN** `identity_state` is `'visual_signature'`
- **AND** a restore request is sent
- **THEN** HTTP 409 SHALL be returned
- **AND** `requires_vs_removal` SHALL be `true`
- **AND** `current_identity_state` SHALL be `'visual_signature'`
- **AND** the error message SHALL read "Remova a assinatura ativa antes de aplicar outra versão."

#### Scenario: Restore rejected when identity_state is logo

- **WHEN** `identity_state` is `'logo'`
- **AND** a restore request is sent
- **THEN** HTTP 409 SHALL be returned
- **AND** `requires_logo_removal` SHALL be `true`
- **AND** `current_identity_state` SHALL be `'logo'`

## REMOVED Requirements

### Requirement: identity_state = 'visual_signature' permitted for restore

**Reason**: The new `identity_state` policy (D3 in alinhamento F29.1.2) blocks restore/apply when a visual signature is already active. Users must first remove the active VS before applying another version. This protects the core drift invariant and avoids substitution mode complexity in the history scope.

**Migration**: The identity state validation rule 3 now returns HTTP 409 for `'visual_signature'` instead of proceeding. The frontend SHALL display the blocking message "Remova a assinatura ativa antes de aplicar outra versão." The `'visual_signature'` state is still handled by the substitution mode (if implemented in a future phase), but restore/apply via POST /restore and POST /approve SHALL reject this state.
