# Plan 31-2-01: Schema Contracts — Summary

**Status:** ✅ Complete
**Date:** 2026-07-25

## Changes Made

### src/lib/image-generation/schema.ts
- `discountedPriceCents` changed from `z.number().int().positive()` to `.optional()` in `GenerateImageRequestSchema`

### src/lib/campaign-intelligence/schema.ts
- `discountedPriceCents` changed from `z.number().int().positive()` to `.optional()` in `CampaignGenerationInputSchema`
- `discounted_price_display` changed from `z.string().min(1)` to `z.string().nullable()` in `CampaignSpecSchema.offer`
- `badge_text` changed from `z.string().min(1)` to `z.string().nullable()` in `CampaignSpecSchema.offer`

### src/lib/campaign/types.ts
- `discountedPriceCents` in `InputSnapshot` changed from required `number` to optional `number | undefined`

### src/lib/campaign-intelligence/providers/mock.ts
- `discountedFormatted` is now conditional (null when `discountedPriceCents` is undefined)
- `offer.discounted_price_display` accepts `string | null`
- `offer.badge_text` accepts `string | null`
- Default `badge_text` is `null` instead of `"Oferta"` when absent

### Type Fixes in Dependent Files
- `campaign-adjustments-panel.tsx`: Handle null `discounted_price_display`/`badge_text` with `?? ""`
- `openai.ts`: Handle undefined `discountedPriceCents` with conditional formatting
- `mapper.ts`: `buildOfferText` accepts optional `discountedPriceCents` (returns "Oferta" when absent); `mapBriefToCopyDirectorInput` propagates optional
- `image-generation-service.ts`: `formatPriceBRL` accepts `number | undefined` (returns `""` when undefined)

## Verification
- `npx tsc --noEmit` — zero errors
- All 8 modified files compile cleanly
- Zero regressão para offer com discountedPriceCents presente
