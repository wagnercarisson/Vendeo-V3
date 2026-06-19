# Plan 03: Transition APIs — RESTORE, Logo Gates + reconcileProfiles

## Objective
Implement remaining API changes: POST /visual-signature/restore with drift validation via DriftValidator and profile reconciliation, identity_state gates on POST /logo and POST /logo/restore, and wire reconcileProfiles() calls in all eligible handlers.

## Tasks Executed

### Task 1: POST /visual-signature/restore
- Created new `src/app/api/store/[id]/visual-signature/restore/route.ts`
- Validates signature belongs to requesting store
- Rejects with 409 when identity_state='logo' (requires_logo_removal)
- Uses shared `validateDrift()` for drift validation (input_snapshot + content_used vs current store)
- Drift returns blocked response with `reason: 'critical_drift' | 'missing_metadata'`
- No-drift restores: archives active, activates chosen, syncs identity_state, reconciles profiles
- Draft without profile triggers BrandProfilerWithoutLogoService
- Does NOT increment visual_signature_attempts

### Task 2: POST /logo identity_state gate
- Added identity_state check at start of POST handler
- Rejects with 409 when identity_state='visual_signature'
- Calls reconcileProfiles() on successful upload to mark incompatible profiles as outdated

### Task 3: POST /logo/restore identity_state gate
- Added identity_state check: rejects 'visual_signature' (requires_identity_removal) and 'logo' (requires_logo_removal)
- Only permitted when identity_state='text_only'
- Replaced inline profile outdated logic with reconcileProfiles() in both no-drift and drift paths
- Calls reconcileProfiles() on successful restore

## Quality Gate
- `npm run typecheck` PASSES with zero errors
- DELETE is handled by Plan 02 (visual-signature/route.ts) — not touched here
- All handlers use shared DriftValidator and reconcileProfiles
- Logo gates use identity_state as canonical source
