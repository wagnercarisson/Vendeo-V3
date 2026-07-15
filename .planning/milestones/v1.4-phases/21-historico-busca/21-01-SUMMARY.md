# Wave 1 — Query Contract

## Status
DONE — committed `3886f96`

## What was built
- `src/lib/campaign/list.ts`: Evolved `listCampaigns(storeId)` → `listCampaigns(storeId, params?)` accepting `ListCampaignsParams` (page, pageSize, q, status, dateFrom, dateTo, sortBy, sortOrder), returning `ListCampaignsResult` with items, total, page, totalPages. Added `countCampaignsFiltered(storeId, params?)` for head-only count query. Added `generateBatchThumbnailUrls`.
- `src/lib/campaign/search-params.ts`: `parseCampaignListSearchParams(raw)` with URL validation for page, q, status, date presets (7d/30d/90d/year), sortBy, sortOrder. Normalizes to `ListCampaignsParams` shape.
- `src/__tests__/lib/campaign/list.test.ts`: 29 tests

## Verification
- 681 tests passing (+29)
- Typecheck: clean
- Lint: clean
