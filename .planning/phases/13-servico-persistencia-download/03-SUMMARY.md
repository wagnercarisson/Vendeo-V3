# Plan 13-03: Tests ✓

**Objective:** Create test coverage for persistence service (19 scenarios) and download route (6 scenarios).

## Files Created

- `src/__tests__/lib/campaign/persistence.test.ts` — 19 tests
- `src/__tests__/api/campaign-download.test.ts` — 6 tests

## Test Coverage

### Persistence Service (19 tests)
- `createCampaign`: 2 (UUID generation + error propagation)
- `dataUrlToCampaignImage`: 6 (3 accept PNG/JPEG/WEBP + 3 reject unsupported/malformed/empty)
- `uploadCampaignImage`: 4 (path, upsert, contentType, reject non-JPEG)
- `updateCampaignReady`: 2 (snapshots + error_message=null)
- `updateCampaignError`: 2 (status=error + reject empty)
- `getCampaign`: 2 (exists + null)
- `deleteCampaignImage`: 1 (bucket remove)

### Download Route (6 scenarios)
- 401 (unauthenticated)
- 400 (malformed UUID)
- 404 (campaign not found)
- 404 (ownership mismatch)
- 302 (successful redirect)
- 502 (signed URL failure)

## Verification

- Full test suite: 490 passing (53 files)
- `npm run typecheck`: ✓
- `npm run lint`: ✓
