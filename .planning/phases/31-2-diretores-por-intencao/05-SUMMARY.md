# Plan 31-2-05: Copy Director + Content Adaptation — Summary

**Status:** ✅ Complete
**Date:** 2026-07-25

## Changes Made

### schema.ts
- `CopyDirectorInputSchema`: replaced `offer: z.string().min(1)` with `commercialFrame: z.string().min(1)`
- Added `campaignIntent: z.enum(["offer","spotlight","exclusive"]).optional().default("offer")`

### copy-director-service.ts
- `generateCopy` now loads `campaign-copy-director-${campaignIntent}` prompt name (dynamic routing)
- Variables use `commercialFrame` instead of `offer`
- Added `campaignIntent` to variables

### mapper.ts — buildCommercialFrame
- Replaces `buildOfferText` with intent-aware variant
- `offer`: same behavior as old `buildOfferText` (badge + original + discounted)
- `spotlight`: "Destaque — R$ X" or "Destaque do produto"
- `exclusive`: "Produto exclusivo — sem divulgação de preço"
- `buildOfferText` kept as backward-compatible delegate → `buildCommercialFrame("offer", input)`

### mapper.ts — buildDeterministicCopy
- New function for fallback copy when Copy Director is disabled
- `offer`: product name + commercialFrame
- `spotlight`: "Novidade na {store}!" with optional price
- `exclusive`: "Exclusivo na {store}!" without price

### mapper.ts — mapBriefToCopyDirectorInput
- Extracts `campaignIntent` from brief
- Uses `buildCommercialFrame` instead of `buildOfferText`
- Returns `commercialFrame` and `campaignIntent` instead of `offer`

### route.ts
- Uses `buildDeterministicCopy` for fallback (when copyDirectorEnabled=false)
- Uses `buildCommercialFrame` for commercial frame generation
- Imports `CampaignIntent` type

### image-generation-service.ts — buildCommercialRepertoire
- Filters scarcity notes for spotlight (no scarcity)
- Filters validity for non-offer intents
- Uses "Disponibilidade:" prefix for exclusive scarcity framing

### match tests (copy-director-service.test.ts)
- Updated test data to use `commercialFrame` + `campaignIntent` instead of `offer`
- Test "rejeita offer vazio" → "rejeita commercialFrame vazio"

## Verification
- `npx tsc --noEmit` — zero errors
