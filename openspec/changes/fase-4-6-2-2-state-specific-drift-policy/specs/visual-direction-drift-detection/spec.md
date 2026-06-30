## MODIFIED Requirements

### Requirement: Drift detection logic

The detection SHALL follow this algorithm on every Step 2 mount:

`
1. No brand profile with synced status exists?
   OR input_snapshot is absent?
   -> No drift (silent)

2. Determine identity_state from activeVsSummary or store:
   +-- text_only: sensitive fields = getDriftPolicy('text_only').sensitive (7 campos)
   +-- logo: sensitive fields = getDriftPolicy('logo').sensitive (6 campos, name excluido)
   +-- visual_signature: sensitive fields = getDriftPolicy('visual_signature').sensitive (4 campos)
       + critical_drift.status consumed from GET /visual-signature

3. currentVisualState deviates from input_snapshot on sensitive fields?
   +-- No -> No sensitive drift
   +-- Yes -> Sensitive drift exists

4. Drift exists + drift_dismissed_snapshot exists
   + currentVisualState == drift_dismissed_snapshot on sensitive fields?
   -> Same drift already dismissed -> sensitiveStatus = 'dismissed'

5. Otherwise:
   -> sensitiveStatus = 'new' (handled by UX layer)
`

String comparison SHALL normalize null and undefined to empty string for all fields. Comparison SHALL only consider the sensitive fields returned by getDriftPolicy(state).sensitive.

#### Scenario: No drift when snapshot matches store on sensitive fields

- WHEN all sensitive fields from getDriftPolicy(state).sensitive in input_snapshot match currentVisualState
- THEN driftStatus SHALL be none

#### Scenario: Drift detected in logo state only for 6 fields

- WHEN identity_state is 'logo'
- AND currentVisualState.name differs from input_snapshot.name
- THEN driftStatus SHALL be none (name is not in getDriftPolicy('logo').sensitive)
- AND logo.status change does NOT trigger drift for name

#### Scenario: Sensitive drift detected when subsegment differs in VS state

- WHEN identity_state is 'visual_signature'
- AND currentVisualState.subsegment differs from input_snapshot.subsegment
- THEN sensitive drift SHALL be detected (subsegment is in getDriftPolicy('visual_signature').sensitive)
- AND critical_drift.status SHALL come from GET /visual-signature (segment is critical, not sensitive, in VS state)

#### Scenario: Dismissed drift shows discreet status

- WHEN driftStatus would be new (store differs from snapshot on sensitive fields)
- AND drift_dismissed_snapshot equals currentVisualState on all sensitive fields
- THEN driftStatus SHALL be dismissed

#### Scenario: Dismissed drift re-triggers on new change

- WHEN driftStatus was dismissed
- AND user changes a sensitive field in the form and saves
- THEN on next mount, driftStatus SHALL be new again (store != drift_dismissed_snapshot on sensitive fields)

#### Scenario: Drift resolves automatically on revert

- WHEN driftStatus was new or dismissed
- AND user reverts store fields to match input_snapshot on all sensitive fields
- THEN on next mount, driftStatus SHALL be none

### Requirement: Drift field set (DRIFT_FIELDS)

The DRIFT_FIELDS constant is removed. The system SHALL use getDriftPolicy(identityState, contentUsed?) to determine sensitive and critical fields per state.

| Estado | Campos sensiveis | Campos criticos (condicionais) |
|--------|-----------------|-------------------------------|
| text_only | name, segment, subsegment, tone_of_voice, positioning, short_description, slogan | -- |
| logo | segment, subsegment, tone_of_voice, positioning, short_description, slogan | -- |
| visual_signature | subsegment, tone_of_voice, positioning, short_description | name, segment (+ slogan/city/state se content_used) |

The frontend compares only sensitive fields locally. Critical fields are obtained via activeVsSummary.critical_drift.status from GET /visual-signature.

#### Scenario: Drift policy returns correct fields per state

- WHEN getDriftPolicy('text_only') is called
- THEN sensitive SHALL contain 7 fields
- AND critical SHALL be []

- WHEN getDriftPolicy('logo') is called
- THEN sensitive SHALL contain 6 fields (name excluded)
- AND critical SHALL be []

- WHEN getDriftPolicy('visual_signature', { slogan: true, city: true, state: false }) is called
- THEN sensitive SHALL contain 4 fields
- AND critical SHALL contain ['name', 'segment', 'slogan', 'city']

#### Scenario: Segment is not sensitive in visual_signature state

- WHEN identity_state is 'visual_signature'
- AND getDriftPolicy('visual_signature').sensitive is inspected
- THEN segment SHALL NOT be in the sensitive array
- AND segment SHALL be in the critical array (evaluated server-side, consumed from GET)

## ADDED Requirements

### Requirement: DriftCategory type

The system SHALL define a DriftCategory type:

type DriftCategory = 'critical' | 'sensitive' | 'none'

#### Scenario: DriftCategory used for save bifurcation

- WHEN the system decides which modal to open on save
- THEN it SHALL use DriftCategory to determine critical vs sensitive vs none

### Requirement: getDriftPolicy function

The system SHALL provide getDriftPolicy(identityState, contentUsed?) returning { sensitive: readonly string[], critical: readonly string[] }.

export function getDriftPolicy(
  identityState: string,
  contentUsed?: { slogan?: boolean; city?: boolean; state?: boolean }
): { sensitive: readonly string[]; critical: readonly string[] }

#### Scenario: getDriftPolicy returns static policy

- WHEN getDriftPolicy('text_only') is called without contentUsed
- THEN critical fields SHALL be empty
- AND sensitive fields SHALL be all 7 snapshot fields

#### Scenario: getDriftPolicy adds conditional critical fields for VS

- WHEN getDriftPolicy('visual_signature', { slogan: true, city: true, state: true }) is called
- THEN critical fields SHALL include 'name', 'segment', 'slogan', 'city', 'state'

### Requirement: evaluateCriticalDrift

The system SHALL provide evaluateCriticalDrift(vsSnapshot, contentUsed, store) that compares store current values against the VS input_snapshot (11 fields, canonical source for critical fields). Returns { hasDrift: boolean, fields: string[] }. This function SHALL be used server-side only.

#### Scenario: evaluateCriticalDrift detects critical drift

- WHEN store.name differs from vsSnapshot.name
- THEN hasDrift SHALL be true
- AND fields SHALL include 'name'

#### Scenario: evaluateCriticalDrift respects content_used

- WHEN contentUsed.city is false
- AND store.city differs from vsSnapshot.city
- THEN hasDrift SHALL be false (city is not critical when content_used.city is false)

### Requirement: evaluateSensitiveDrift

The system SHALL provide evaluateSensitiveDrift(bpSnapshot, store, fields) that compares store current values against the BP input_snapshot (7 fields) using the provided field list.

#### Scenario: evaluateSensitiveDrift detects sensitive drift

- WHEN store.subsegment differs from bpSnapshot.subsegment
- AND fields includes 'subsegment'
- THEN hasDrift SHALL be true

### Requirement: Properties ausentes em snapshots antigos

Snapshots created before this phase may have missing properties. The system SHALL treat missing properties as "not comparable": property absent -> skip comparison; property present -> compare normally.

#### Scenario: Missing property in old snapshot skipped

- WHEN input_snapshot has no 'positioning' key (old-format snapshot)
- AND current store has positioning = 'Premium'
- THEN positioning SHALL NOT be compared
- AND no false drift SHALL be reported for positioning