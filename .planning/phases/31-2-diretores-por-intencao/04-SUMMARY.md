# Plan 31-2-04: Image Director Routing — Summary

**Status:** ✅ Complete
**Date:** 2026-07-25

## Changes Made

### buildPromptVariables (image-generation-service.ts)
- Added `campaignIntent` variable from `body.campaignIntent`
- Added `preserveImageDirective`: non-empty for spotlight/exclusive with `preserveImageContext=true`
- Added `commercialFrame`: varies by intent (IIFE with 3 cases + offer default)
- `discountedPrice` is now empty string when `discountedPriceCents` is undefined
- Updated `buildCreativeContextGuidance` call to pass `campaignIntent`

### assemblePrompt (image-generation-service.ts)
- Now loads `campaign-image-director-${intent}` based on `variables.campaignIntent`
- Falls back to "offer" when intent is undefined
- Errors propagate (preflight fail) if prompt file doesn't exist

### validatePrompts (image-generation-service.ts)
- Director prompt loaded by `campaignIntent`: `campaign-image-director-${campaignIntent}`
- Try/catch around prompt loading for missing prompt files
- `discountedPrice` in reviewer variables is empty when `discountedPriceCents` is undefined
- Errors include intent-specific message when prompt not found

### buildCreativeContextGuidance (image-generation-service.ts)
- Refactored from early-return to single-assignment for result post-processing
- Appends intent-specific framing for spotlight/exclusive
- Appends "Preço é oportunidade." for offer with non-empty result
- No framing modification for empty results

## Verification
- `npx tsc --noEmit` — zero errors
