# Plan 31-2-02: Unblock — UI/Form/Route — Summary

**Status:** ✅ Complete
**Date:** 2026-07-25

## Changes Made

### campaign-input-form.tsx
- Removed "Em breve" badge from spotlight/exclusive options in IntentSelector
- Removed `fields.campaignIntent !== "offer"` from submit button `disabled` condition
- Removed "Disponível em breve" tooltip for non-offer intents
- Button text always shows "Criar Campanha" for all intents

### use-campaign-form.ts
- Removed early return in `handleSubmit` that blocked non-offer submissions
- `isValid` no longer requires `campaignIntent === "offer"` — depends only on field validation
- Exclusive naturally omits `discountedPriceCents` from request body (field is undefined, JSON.stringify drops it)

### route.ts
- Replaced campaign intent guard (HTTP 400 for non-offer) with:
  - **Offer validation**: returns HTTP 400 when offer has no `discountedPriceCents`
  - **Exclusive normalization**: `discountedPriceCents` → `undefined` + console.warn when exclusive has price
- Spotlight/exclusive now flow through the pipeline without rejection

## Verification
- `npx tsc --noEmit` — zero errors
- All intents can now be submitted through the pipeline
