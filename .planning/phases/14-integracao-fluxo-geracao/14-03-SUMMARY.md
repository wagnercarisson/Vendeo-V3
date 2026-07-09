---
phase: 14-integracao-fluxo-geracao
plan: 03
subsystem: ui
tags: [consumer, navigation, sessionStorage, router, campaign-url]
requires:
  - phase: 14-02
    provides: NDJSON campaignId/campaignUrl result shape
provides:
  - Consumer navigation to /campanha/[id] via router.push
  - Removed campaign_preview sessionStorage post-generation
  - Preserved campaign_draft_image and useInputPreservation drafts
affects:
  - 15-pagina-de-campanha (will handle /campanha/[id] page)
  - 16-lista-de-campanhas

tech-stack:
  added: []
  patterns:
    - "NDJSON result handler checks 'campaignId' in event instead of event.success"
    - "Navigation uses campaignUrl from backend response, not hardcoded route"
    - "Draft data preserved in sessionStorage separate from post-generation state"

key-files:
  created:
    - src/components/flow/__tests__/use-campaign-form-navigation.test.ts
  modified:
    - src/components/flow/use-campaign-form.ts

key-decisions:
  - "Removed PreviewPayload construction and sessionStorage.setItem('campaign_preview', ...) from consumeStream success handler"
  - "Navigation changed from router.push('/campaign/preview') to router.push(result.campaignUrl)"
  - "Form draft (campaign_draft_image, useInputPreservation) preserved — NOT cleared on success"
  - "consumeStream signature simplified from 4 params to 2 (removed storeIdentityLocal, frozenImagePreviewUrlLocal)"
  - "placeholderIdentity removed from handleSubmit and handleConflictContinue (no longer needed for consumeStream)"
  - "resetSubmit still clears campaign_preview defensively"

requirements-completed:
  - REQ-CONSUMER-NAVIGATION

duration: ~2 min
completed: 2026-07-09
---

# Phase 14 Plan 03: Consumer Navigation — Summary

**Remove campaign_preview sessionStorage write, navigate to campaignUrl, preserve form drafts**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-09T17:40:20Z
- **Completed:** 2026-07-09T17:42:13Z
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)
- **Tests:** 505 passing (56 files) — 3 new navigation tests

## Accomplishments

- Replaced `event.success` check with `"campaignId" in event` for NDJSON result detection
- Removed `PreviewPayload` construction and `sessionStorage.setItem("campaign_preview")` from consumeStream
- Removed `clearFormState()` and `sessionStorage.removeItem(IMAGE_DRAFT_KEY)` from success branch (drafts preserved)
- Added `router.push(result.campaignUrl)` for backend-provided navigation URL
- Removed unused imports: `PreviewPayload`, `StoreIdentitySnapshot`, `CampaignSpec`
- Simplified `consumeStream` signature — removed `storeIdentityLocal` and `frozenImagePreviewUrlLocal` parameters
- Removed `placeholderIdentity` and `frozenImagePreviewUrl` from `handleSubmit` (no longer passed to `consumeStream`)
- Removed `placeholderIdentity` from `handleConflictContinue`
- `resetSubmit` still clears `campaign_preview` defensively
- Created 3 navigation tests covering: campaignUrl navigation, no campaign_preview write, campaign_draft_image preservation

## Task Commits

Each task was committed atomically:

1. **Task 1: Modify use-campaign-form.ts** — `c786399` (feat)
2. **Task 2: Create navigation tests** — `a131225` (test)

## Files Created/Modified

- `src/components/flow/use-campaign-form.ts` — Modified: consumeStream result handler simplified, sessionStorage writes removed, navigation uses campaignUrl, signature simplified
- `src/components/flow/__tests__/use-campaign-form-navigation.test.ts` — Created: 3 vitest tests for navigation behavior

## Decisions Made

- **Result handler check:** Changed from `event.type === "result" && event.success` to `event.type === "result" && "campaignId" in event` — aligns with new NDJSON shape from backend (14-02) where `success` field no longer exists
- **Draft preservation per D4:** `campaign_draft_image` and `useInputPreservation` remain in sessionStorage after successful generation. Only `campaign_preview` was removed as a post-generation source of truth since campaigns are now persisted in the database
- **Defensive cleanup:** `resetSubmit` still calls `sessionStorage.removeItem("campaign_preview")` to clean up any stale preview data from before this change
- **Simplified consumeStream:** The `storeIdentityLocal` and `frozenImagePreviewUrlLocal` parameters were only used to construct the removed `PreviewPayload`. With campaign persistence, these parameters are no longer needed

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None

## Threat Flags

No new threat surface introduced. Changes to sessionStorage and navigation follow D4 decisions (information disclosure mitigated by removing campaign_preview client-side storage).

## Verification Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ Zero errors |
| `npm run lint` | ✅ Zero errors |
| `npm run build` | ✅ Zero errors |
| `npx vitest run src/components/flow/__tests__/use-campaign-form-navigation.test.ts` | ✅ 3/3 passing |
| `npm run test` | ✅ 505/505 passing (56 files) |

## Next Phase Readiness

Plan 14-03 complete. The client consumer now navigates to `/campanha/[id]` and relies on the backend for campaign persistence. Draft data (image + text fields) remains in sessionStorage for form continuation.

Ready for Phase 15 (Página de Campanha — `/campanha/[id]` page) and Phase 16 (Lista de Campanhas — `/minhas-campanhas`).

## Self-Check: PASSED

- All 3 files exist on disk
- All 3 commits found in git log
- No `sessionStorage.setItem("campaign_preview")` in source
- No `router.push("/campaign/preview")` in source
- `router.push(result.campaignUrl)` present
- `IMAGE_DRAFT_KEY` write still present (draft preserved)
- `resetSubmit` still removes `campaign_preview` defensively
- `clearFormState()` present in `resetSubmit` (not in success branch)
- 505/505 tests passing
- TypeScript, lint, build all clean

---

*Phase: 14-integracao-fluxo-geracao*
*Completed: 2026-07-09*
