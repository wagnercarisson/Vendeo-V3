## MODIFIED Requirements

### Requirement: GET /api/store/[id]/visual-signature -- history response

The GET endpoint SHALL serve as the history/list of visual signatures for the store. The response SHALL be expanded beyond the current simple list.

The response SHALL include for each signature:
- id, status, assetUrl, type, attempt
- created_at, approved_at (null if never active, or if archived)
- art_direction: object containing visual_direction, content_used, intended_palette (from metadata.artDirectorOutput), or null if unavailable
- restore_eligibility: object computed server-side by comparing metadata.input_snapshot against current store data using content_used (same drift rules as POST /restore):
  - can_restore: boolean -- true only if no drift AND metadata exists
  - drift_fields: string[] -- list of fields with drift (empty if can_restore)
  - requires_regeneration: boolean -- true if drift detected OR metadata is missing
  - reason: 'ok' | 'critical_drift' | 'missing_metadata'
- critical_drift: object | null -- computed server-side, non-null ONLY when this signature is the active signature:

critical_drift: {
  status: 'none' | 'new' | 'dismissed'
  fields: string[]
  reason: 'ok' | 'critical_drift' | 'missing_metadata'
} | null

critical_drift SHALL be null for non-active signatures.

Calculation of status:
- reason = restore_eligibility.reason
- If reason === 'ok' -> status = 'none'
- If reason === 'critical_drift' | 'missing_metadata': compare visual_signature_drift_dismissed_snapshot (if exists) with current store values. If match -> status = 'dismissed'. If no match or snapshot absent -> status = 'new'

The frontend SHALL select the active item as activeVsSummary and consume critical_drift.status.

approved_at SHALL be reliably populated only for the currently active signature (its updated_at reflects the approval time). For archived signatures that were previously active, updated_at has been overwritten by archival -- approved_at SHALL be null. Signatures that were never active (draft) SHALL also have null.

#### Scenario: Active signature includes approved_at and critical_drift

- WHEN GET /api/store/{store_id}/visual-signature returns the currently active signature
- THEN approved_at SHALL contain a timestamp
- AND art_direction SHALL contain the metadata from artDirectorOutput
- AND critical_drift SHALL be non-null

#### Scenario: Archived signature returns null for approved_at and critical_drift

- WHEN GET /api/store/{store_id}/visual-signature returns an archived signature
- THEN approved_at SHALL be null
- AND critical_drift SHALL be null

#### Scenario: Pre-feature signature returns null for art_direction

- WHEN GET /api/store/{store_id}/visual-signature returns a signature without artDirectorOutput
- THEN art_direction SHALL be null
- AND critical_drift SHALL be null (only non-null on active)

#### Scenario: Active VS with no drift returns status none

- WHEN a store has an active VS with restore_eligibility.reason === 'ok'
- THEN critical_drift.status SHALL be 'none'
- AND critical_drift.reason SHALL be 'ok'

#### Scenario: Critical drift detected returns status new

- WHEN a store has an active VS with restore_eligibility.reason === 'critical_drift'
- AND no visual_signature_drift_dismissed_snapshot exists
- THEN critical_drift.status SHALL be 'new'
- AND critical_drift.fields SHALL contain the drifted fields

#### Scenario: Critical drift dismissed returns status dismissed

- WHEN a store has an active VS with restore_eligibility.reason === 'critical_drift'
- AND visual_signature_drift_dismissed_snapshot exists with values matching current store
- THEN critical_drift.status SHALL be 'dismissed'

#### Scenario: Missing metadata treated as new (conservative)

- WHEN a store has an active VS with restore_eligibility.reason === 'missing_metadata'
- AND no visual_signature_drift_dismissed_snapshot exists
- THEN critical_drift.status SHALL be 'new'
- AND critical_drift.reason SHALL be 'missing_metadata'

#### Scenario: restore_eligibility indicates ok when no drift

- WHEN GET /api/store/{store_id}/visual-signature returns a signature
- AND metadata.input_snapshot matches current store data
- THEN restore_eligibility.can_restore SHALL be true
- AND restore_eligibility.drift_fields SHALL be []
- AND restore_eligibility.requires_regeneration SHALL be false
- AND restore_eligibility.reason SHALL be 'ok'

#### Scenario: restore_eligibility blocks restore on drift with reason critical_drift

- WHEN GET /api/store/{store_id}/visual-signature returns a signature
- AND metadata.input_snapshot differs from current store data
- THEN restore_eligibility.can_restore SHALL be false
- AND restore_eligibility.drift_fields SHALL list the drifted fields
- AND restore_eligibility.requires_regeneration SHALL be true
- AND restore_eligibility.reason SHALL be 'critical_drift'

#### Scenario: restore_eligibility blocks restore on missing metadata with reason missing_metadata

- WHEN GET /api/store/{store_id}/visual-signature returns a signature
- AND metadata has no input_snapshot
- THEN restore_eligibility.can_restore SHALL be false
- AND restore_eligibility.drift_fields SHALL be []
- AND restore_eligibility.requires_regeneration SHALL be true
- AND restore_eligibility.reason SHALL be 'missing_metadata'

## ADDED Requirements

### Requirement: POST /api/store/[id]/visual-signature/dismiss-critical-drift

The system SHALL expose a POST endpoint that dismisses critical drift for the active visual signature.

Endpoint: POST /api/store/[id]/visual-signature/dismiss-critical-drift
Request body: empty
Response: 204 No Content

The backend SHALL:
1. Verify the store has an active visual signature
2. Read current store values (store.name, store.segment, store.slogan, store.city, store.state)
3. Merge into metadata preserving all existing fields
4. Persist visual_signature_drift_dismissed_snapshot with the current store values

Only visual_signature_drift_dismissed_snapshot SHALL be persisted. critical_drift is a calculated field on GET, never stored.

#### Scenario: Dismiss persists current store snapshot

- WHEN POST /dismiss-critical-drift is called
- AND the store has an active visual signature
- THEN metadata.visual_signature_drift_dismissed_snapshot SHALL contain store.name, store.segment, store.slogan, store.city, store.state
- AND existing metadata fields SHALL be preserved
- AND HTTP 204 SHALL be returned

#### Scenario: Dismiss fails when no active VS

- WHEN POST /dismiss-critical-drift is called
- AND the store has no active visual signature
- THEN HTTP 404 SHALL be returned

### Requirement: Guardas do backend no generate-without-logo (mode: substitution)

Quando generate-without-logo is called with mode:'substitution', the endpoint SHALL validate before generating:

1. Loja exists and is active
2. Generation lock per store (process-local/best effort)
3. identity_state === 'visual_signature' and active VS exists
4. Critical drift confirmed (revalidated via drift-revalidator.ts)
5. Signature limit respected (< 3 successful generated)
6. Existence of historical drafts does NOT block substitution

Guard failure -> 4xx with specific code and userMessage.

If guard 4 fails (critical drift not confirmed on revalidation), the frontend SHALL reload/recalculate the drift diagnosis from GET /visual-signature. The frontend SHALL NOT automatically assume sensitive drift flow -- sensitive drift may not exist.

#### Scenario: Substitution guard blocks when no VS active

- WHEN POST /generate-without-logo is called with mode:'substitution'
- AND store has identity_state !== 'visual_signature' or no active VS
- THEN HTTP 4xx SHALL be returned with error code

#### Scenario: Substitution guard revalidates critical drift

- WHEN POST /generate-without-logo is called with mode:'substitution'
- THEN drift-revalidator.ts SHALL be called server-side
- AND if critical drift is not confirmed, HTTP 4xx SHALL be returned
- AND the frontend SHALL NOT automatically fall back to sensitive drift flow
- AND the frontend SHALL recalculate drift diagnosis from GET /visual-signature

### Requirement: Limite de assinaturas

The system SHALL enforce a limit of 3 successfully generated signatures (type IN ('ai_generated', 'automatic_generated')). Failed attempts SHALL NOT count toward the limit. The backend is the authority in generate-without-logo/route.ts.

Credit purchase and billing are out of scope. The "Comprar creditos -- Em breve" button remains disabled as informational.

#### Scenario: Limit blocks generation at 3 successful signatures

- WHEN a store has 3 signatures with type 'ai_generated' or 'automatic_generated'
- AND POST /generate-without-logo is called
- THEN HTTP 403 SHALL be returned with exhausted flag

#### Scenario: Failed signatures do not count toward limit

- WHEN a store has 2 successful signatures and 1 failed attempt
- THEN the count SHALL be 2
- AND generation SHALL still be permitted

### Requirement: Generate-without-logo mode parameter

POST /generate-without-logo SHALL accept an optional mode field in the request body: 'standard' | 'substitution'. Default: 'standard'.

- 'standard' (current): normal VS creation flow for text_only stores
- 'substitution': exceptional flow for visual_signature stores with critical drift. Revalidates drift server-side.

#### Scenario: Standard mode unchanged

- WHEN POST /generate-without-logo is called with mode:'standard'
- THEN the existing behavior SHALL apply unchanged

#### Scenario: Substitution mode revalidates drift

- WHEN POST /generate-without-logo is called with mode:'substitution'
- THEN drift-revalidator.ts SHALL be called before generation
- AND the response SHALL indicate substitution mode is in progress