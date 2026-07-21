> **Purpose**: Defines the visual signature restore endpoint — reapply an archived signature as active with drift validation using input_snapshot and content_used.

## Requirements

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
>      ```json
>      { "error": "Remova a assinatura ativa antes de aplicar outra versão.",
>        "requires_vs_removal": true, "current_identity_state": "visual_signature" }
>      ```
   - `'logo'` → REJECTED: user must remove the logo before restoring a visual signature
     ```json
     { "error": "Remova o logotipo ativo antes de restaurar uma assinatura visual.",
       "requires_logo_removal": true, "current_identity_state": "logo" }
     ```
4. Validate drift (see Requirement: Drift validation on restore)

If validation passes (no drift), the endpoint SHALL:
5. Archive the currently active signature (if any)
6. Set the chosen signature as `active`
7. Update stores: `identity_state = 'visual_signature'`, `logo_status = 'generated'`
8. Reuse the existing brand profile associated with the signature:
   - Mark other synced profiles of the store as `outdated`
   - Activate the signature's profile as `synced`
9. Return `{ success: true, signature: { id, assetUrl, ... } }`

Restore SHALL NOT consume a generation — it does not count toward the limit of 3.

#### Scenario: Successful restore with no drift

- **WHEN** a POST request is sent to `/api/store/{store_id}/visual-signature/restore`
- **AND** `identity_state` is `'text_only'`
- **AND** no drift is detected
- **THEN** the chosen signature SHALL become `active`
- **AND** `identity_state` SHALL become `'visual_signature'`
- **AND** `logo_status` SHALL become `'generated'`
- **AND** other synced brand profiles SHALL be marked `outdated`
- **AND** the signature's profile SHALL be activated as `synced`
- **AND** `visual_signature_attempts` SHALL NOT be incremented

#### Scenario: Restore of already active signature is no-op

- **WHEN** the chosen signature is already `active`
- **THEN** the endpoint SHALL return `{ success: true }`
- **AND** no changes SHALL be made

#### Scenario: Restore rejected when identity_state is logo

- **WHEN** `identity_state` is `'logo'`
- **AND** a restore request is sent
- **THEN** HTTP 409 SHALL be returned
- **AND** `requires_logo_removal` SHALL be `true`
- **AND** `current_identity_state` SHALL be `'logo'`

### Requirement: Drift validation on restore

Before restoring, the system SHALL compare the current store data against the `input_snapshot` captured at generation time, using `content_used` to determine whether a field was actually used in the visual signature composition.

The drift comparison SHALL use these fields:

| Field | Content used check | Criticality |
|-------|-------------------|-------------|
| `name` | Always used (even if metadata missing) | Critical — always blocks restore |
| `segment` | Always critical (drives visual direction) | Critical — always blocks restore |
| `city` | `content_used.city === true` | Conditional — blocks if used |
| `state` | `content_used.state === true` | Conditional — blocks if used |
| `slogan` | `content_used.slogan === true` | Conditional — blocks if used |

A field is considered different if the string values are not strictly equal (case-sensitive).

If `input_snapshot` or `content_used` is missing from metadata (signatures created before this feature), the system SHALL assume drift in all fields — restore is blocked with conservative behavior.

#### Scenario: Drift detected on critical field (name)

- **WHEN** `input_snapshot.name` differs from current store `name`
- **THEN** drift SHALL be considered critical
- **AND** the endpoint SHALL return `{ success: false, drift: { critical: true, fields: ["name"], requires_regeneration: true } }`

#### Scenario: Drift detected on conditional field (city) only if used

- **WHEN** `input_snapshot.city` differs from current store `city`
- **AND** `content_used.city === true`
- **THEN** drift SHALL be considered critical

- **WHEN** `input_snapshot.city` differs from current store `city`
- **AND** `content_used.city === false`
- **THEN** drift SHALL NOT be triggered for this field

#### Scenario: No drift permits restore

- **WHEN** all critical fields match
- **AND** all conditional fields match (or differ but were not used)
- **THEN** restore SHALL proceed normally

#### Scenario: Missing metadata blocks restore

- **WHEN** the signature metadata has no `input_snapshot` or no `content_used`
- **THEN** drift SHALL be assumed in all fields
- **AND** restore SHALL be blocked
- **AND** the response SHALL indicate `requires_regeneration: true`

### Requirement: Profile reconciliation on restore

When restoring a visual signature, the system SHALL reconcile brand profiles:

1. Search for an existing brand profile associated with the restored signature (`visual_signature_id`, `source = 'without_logo'`)
2. **If a profile exists:**
   a. Mark all other `synced` profiles of the store as `outdated`
   b. Activate the restored signature's profile as `synced`
3. **If no profile exists** (e.g., the signature was a draft that was never approved): execute `BrandProfilerWithoutLogoService.generate()` — same flow as the approve handler — to create a new `without_logo` profile linked to this signature, then activate it as `synced`

#### Scenario: Reconciliation marks outdated profiles

- **WHEN** a visual signature is restored
- **AND** a brand profile exists for the signature
- **AND** the store has other synced brand profiles (e.g., from previous logo upload)
- **THEN** those other profiles SHALL be marked `outdated`
- **AND** only the restored signature's profile SHALL remain `synced`

#### Scenario: No existing profile triggers BrandProfilerWithoutLogoService

- **WHEN** a visual signature is restored
- **AND** no brand profile exists for the signature (draft that was never approved)
- **THEN** `BrandProfilerWithoutLogoService.generate()` SHALL be executed
- **AND** a new brand profile SHALL be created with `source = 'without_logo'` and `visual_signature_id` linked to the restored signature

## REMOVED Requirements

The following requirement was removed in F29.1.2 (D3):

### Requirement (removed): identity_state = 'visual_signature' permitted

**Removed in:** Phase 29.1.2 — Histórico Curto + Assinatura Visual
**Reason:** D3 from alinhamento F29.1.2 — users must remove active VS before applying another version. Previously, users could swap/reapply between archived signatures while `identity_state = 'visual_signature'`. Now this state is blocked: user must first remove the active VS (setting `identity_state = 'text_only'`) before applying a different version.

**Previous behavior:**
- `'visual_signature'` → permitted: swap/reapply between archived signatures
- The system would archive the current active VS and activate the chosen one (substitution)

**New behavior:**
- `'visual_signature'` → **REJECTED** with `requires_vs_removal: true`
- User must first remove the active VS (DELETE /api/store/[id]/visual-signature)
- Then apply the archived/draft VS from `text_only` state

**Impact:** Substitution mode in POST /approve still exists for the drift-based substitution flow, but the restore endpoint no longer supports in-place substitution while `identity_state = 'visual_signature'`.
