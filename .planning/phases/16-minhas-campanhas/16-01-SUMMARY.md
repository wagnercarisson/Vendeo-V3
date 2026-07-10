# Plan 16-01 Summary — Contrato de Listagem

**Status:** ✅ Complete  
**Date:** 2026-07-10  

## Created

- `src/lib/campaign/list.ts` (68 lines) — `listCampaigns`, `generateBatchThumbnailUrls`, `CampaignListItem`
- `src/__tests__/lib/campaign/list.test.ts` (233 lines) — 7 test cases

## Implementation Details

### `listCampaigns(storeId: string)`
- Uses `createServerClient()` (RLS-aware) — non-owners receive `[]`
- Filters `status IN ('ready', 'error')`, excludes `generating`
- Orders by `created_at DESC` with `LIMIT 50`
- Calls `generateBatchThumbnailUrls` internally and merges results

### `generateBatchThumbnailUrls(items)`
- Only processes items with `status === "ready"` and non-empty `storagePath`
- Uses `Promise.allSettled` for parallel signed URL generation
- Pre-initializes all ready items with `null` — failures stay `null`, not missing keys
- Calls `supabaseAdmin.storage.from("campaign-images").createSignedUrl(path, 3600)`

### Tests (7/7 passing)
- `listCampaigns`: owner returns campaigns, `.in()` status filter, empty store, cross-tenant RLS
- `generateBatchThumbnailUrls`: ready generates URLs, error skipped, partial failure → null
