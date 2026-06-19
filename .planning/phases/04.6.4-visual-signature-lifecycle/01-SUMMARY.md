# Plan 01: Foundation — Types, Constants & Profile Reconciliation

## Objective
Create the foundational data layer, shared reconciliation logic, and shared drift validator for the entire Visual Signature Lifecycle phase.

## Tasks Executed

### Task 1: Expand VisualSignatureMetadata
- Added `VisualSignatureMetadataInputSnapshot` type with all 10 store fields (name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, city, state, brand_color)
- Added `VisualSignatureMetadataArtDirectorOutput` type with visual_direction, content_used, visual_elements, intended_palette, color_usage
- Updated `VisualSignatureMetadata` to include `input_snapshot` and extended `artDirectorOutput` to accept both old and new types

### Task 2: Create RestoreEligibility type
- Created `RestoreEligibilityReason` union type: 'ok' | 'critical_drift' | 'missing_metadata'
- Created `RestoreEligibility` interface with can_restore, drift_fields, requires_regeneration, reason

### Task 3: Create profile-reconciliation.ts
- Created `src/lib/brand-assets/profile-reconciliation.ts`
- Implemented `reconcileProfiles()` with `ReconciliationOptions` supporting:
  - `activateProfileIds` — profiles to mark as synced
  - `outdatedSources` — filter incompatible profiles by source
  - `markIncompatibleAsOutdated` — marks other synced profiles as outdated before activating
  - `preserveCurrentAsFallback` — preserves current synced profile without marking as outdated
- Returns `ReconciliationResult` with lists of activated/outdated profiles

### Task 4: Create drift-validator.ts
- Created `src/lib/visual-signature/drift-validator.ts`
- Implemented `validateDrift()` with rules:
  - name/segment: always critical, case-sensitive comparison
  - city/state/slogan: critical only when content_used says so
  - Missing metadata returns reason='missing_metadata'
  - No drift returns reason='ok'

## Quality Gate
- `npm run typecheck` PASSES with zero errors
- All types exported and usable by downstream plans
- profile-reconciliation.ts is single source of truth for profile transitions
- drift-validator.ts is single source of truth for drift comparison
- No handler files modified — call sites belong in Plans 02 and 03
