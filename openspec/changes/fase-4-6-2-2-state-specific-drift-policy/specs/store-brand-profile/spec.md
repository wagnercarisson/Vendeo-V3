## MODIFIED Requirements

### Requirement: Read brand profile -- GET /api/store/[id]/brand-profile

The system SHALL expose a GET /api/store/[id]/brand-profile endpoint that returns the latest brand profile for the store (the most recently created, regardless of status). This enables the frontend to detect failed profiles on page load.

The endpoint SHALL accept an optional query parameter ?status=synced that filters to return only the active synced profile.

When ?status=synced is provided:
- If a synced profile exists, return it (HTTP 200)
- If no synced profile exists, return HTTP 200 with null data
- The most recent profile (regardless of status) remains accessible without the parameter

If no profile exists at all, the endpoint SHALL return HTTP 200 with null data.

#### Scenario: Latest profile returned regardless of status

- WHEN a GET request is sent to /api/store/{store_id}/brand-profile
- AND a profile exists (synced, failed, or outdated)
- THEN the response SHALL contain the most recent brand profile record

#### Scenario: No profile returns null

- WHEN a GET request is sent to /api/store/{store_id}/brand-profile
- AND no profile exists for this store
- THEN the response status SHALL be 200 with data set to null

#### Scenario: GET with status=synced returns active profile

- WHEN a GET request is sent to /api/store/{store_id}/brand-profile?status=synced
- AND a synced brand profile exists
- THEN the response SHALL contain the synced profile

#### Scenario: GET with status=synced returns null when none synced

- WHEN a GET request is sent to /api/store/{store_id}/brand-profile?status=synced
- AND no synced profile exists (only failed profiles)
- THEN the response body SHALL be null

## ADDED Requirements

### Requirement: Brand profile realinhamento -- POST /api/store/[id]/brand-profile/realign

The system SHALL expose a POST /api/store/[id]/brand-profile/realign endpoint that re-infers the brand profile based on the current identity_state. The endpoint SHALL decide the strategy exclusively by identity_state (the client SHALL NOT select the strategy):

| identity_state | Strategy | Service |
|---|---|---|
| text_only | Textual inference | BrandTextOnlyInferenceService |
| logo | Brand Director | BrandDirectorService |
| visual_signature | Profiler VS mode 'regenerate' | BrandProfilerWithoutLogoService with mode: 'regenerate' |

The endpoint SHALL apply compensation, with rules that vary by identity_state:

**text_only and logo:**
1. Inference executed BEFORE any database mutation
2. Previous profile marked outdated ONLY after successful inference
3. New profile inserted with status 'synced'
4. If the insert fails: previous profile restored to 'synced'

**visual_signature (same VS, sensitive drift):**
1. Inference executed BEFORE any database mutation (mode:'regenerate')
2. UPDATE the existing BP (same visual_signature_id) — no INSERT, no status change
3. If the update fails: previous profile remains synced and intact
4. No restore needed — no status was changed

The system SHALL never have two records with status 'synced' for the same store.

In the visual_signature path the endpoint SHALL:
- Locate the active VS
- Re-infer the linked profile (source = 'without_logo')
- Preserve identity_state = 'visual_signature'
- Preserve visual_signature_id
- Use profiler mode 'regenerate' (do not reuse existing profile)
- Read content_used from the active VS metadata (store_visual_signatures.metadata.artDirectorOutput.content_used), NOT from the previous profile
- On success: update snapshot + resolve drift
- On failure: alert + retry/keep (existing VS maintained)

#### Scenario: Realinhamento text_only executes textual inference

- WHEN identity_state is text_only
- AND POST /realign is called
- THEN BrandTextOnlyInferenceService SHALL be used
- AND the response SHALL include the synced profile

#### Scenario: Realinhamento logo executes Brand Director

- WHEN identity_state is logo
- AND a logo asset exists
- THEN BrandDirectorService SHALL be used

#### Scenario: Realinhamento VS executes profiler mode regenerate

- WHEN identity_state is visual_signature
- AND an active VS exists
- THEN BrandProfilerWithoutLogoService SHALL be used with mode: 'regenerate'
- AND identity_state SHALL remain 'visual_signature'
- AND visual_signature_id SHALL be preserved

#### Scenario: content_used read from VS metadata in VS path

- WHEN identity_state is visual_signature
- AND realinhamento is triggered
- THEN content_used SHALL be read from the active VS metadata (store_visual_signatures.metadata.artDirectorOutput.content_used)
- AND SHALL NOT be read from the previous brand profile

#### Scenario: Realinhamento VS preserves content_used

- WHEN identity_state is visual_signature
- AND realinhamento succeeds
- THEN the new profile SHALL preserve content_used from the VS metadata
- AND metadata.input_snapshot SHALL be updated with current store values

#### Scenario: Compensation in text_only path -- insert fails

- WHEN text_only inference succeeds
- AND the previous synced profile is marked outdated
- AND the new profile insert fails
- THEN the previous profile SHALL be restored to synced

#### Scenario: Compensation in logo path -- insert fails

- WHEN BrandDirector analysis succeeds
- AND the previous synced profile is marked outdated
- AND the new profile insert fails
- THEN the previous profile SHALL be restored to synced

#### Scenario: Compensation in VS path -- update fails

- WHEN BrandProfilerWithoutLogo mode:'regenerate' succeeds
- AND the existing BP (same visual_signature_id) is updated
- AND the update fails
- THEN the previous profile SHALL remain synced and intact
- AND no second BP record SHALL be created

#### Scenario: Failed inference -- previous profile NOT marked outdated

- WHEN inference fails in any of the 3 paths
- THEN the previous synced profile SHALL remain synced
- AND no mutation SHALL be made to any profile status