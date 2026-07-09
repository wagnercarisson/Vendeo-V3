# Plan 13-01: Types & Persistence Service ✓

**Objective:** Create campaign type definitions and persistence service with 7 helpers.

## Files Created

- `src/lib/campaign/types.ts` — `CampaignStatus`, `CampaignRecord`, `CreateCampaignInput`, `CampaignReadyData`, `InputSnapshot`, `IdentitySnapshot`, `RenderSnapshot`, `PublicationCopySnapshot`, `GenerationMetadata`
- `src/lib/campaign/persistence.ts` — `createCampaign`, `dataUrlToCampaignImage`, `uploadCampaignImage`, `updateCampaignReady`, `updateCampaignError`, `getCampaign`, `deleteCampaignImage`

## Key Decisions

- All helpers use `supabaseAdmin` (service_role) — never `createServerClient()`
- `dataUrlToCampaignImage` validates MIME (PNG/JPEG/WEBP), rejects unsupported/malformed
- `uploadCampaignImage` uses `upsert: false` and canonical `.jpg` path
- UUID via `crypto.randomUUID()` (no `uuid` package)
- Types are manual (no `supabase gen types`) per D5

## Verification

- `npm run typecheck`: ✓
- `npm run lint`: ✓
