---
phase: 31-1-modelo-comercial-formulario
plan: 02
subsystem: api
tags: [typescript, form-state, validation, inference]
requires:
  - phase: 31-1-modelo-comercial-formulario
    provides: CampaignIntent type, BADGE_OPTIONS_BY_INTENT
provides:
  - CampaignFormFields with campaignIntent, preserveImageContext, optional discountedPriceCents
  - inferIntent function (exported) for price-based intent detection
  - Conditional validation per intent (discountedPrice required only for offer)
  - Badge validation against BADGE_OPTIONS_BY_INTENT
  - setField updated to accept boolean/undefined
  - handleSubmit blocks non-offer intents
  - Badge cleanup effect on intent change
affects: [31-2, 31-3]
tech-stack:
  added: []
  patterns: [inferIntent pure function, conditional validation by intent, userChangedIntent ref]
key-files:
  created: []
  modified:
    - src/components/flow/use-campaign-form.ts
key-decisions:
  - inferIntent uses nullish coalescing to normalize undefined/null to 0
  - userChangedIntent ref prevents inference from overriding manual choice
  - When user intent no longer available (e.g., DE+POR filled → only offer), auto-revert
  - validateDiscountedPrice and validateBadge exported for testability
requirements-completed: [INTENT-06, INTENT-09, INTENT-11]
completed: 2026-07-24
---

# Plan 02: Form Logic — State + Inference + Validation

**CampaignFormFields extended with intent fields, inferIntent function, and intent-conditional validation**

## Performance
- **Files modified:** 1
- **Tasks:** 4

## Accomplishments
- `CampaignFormFields.discountedPriceCents` is now `number | undefined`
- Added `campaignIntent: CampaignIntent` and `preserveImageContext: boolean` to form state
- `inferIntent()` implemented and exported — maps price combinations to intents
- Auto-inference via `useEffect` with `userChangedIntent` flag to respect manual choices
- Conditional validation: `validateDiscountedPrice` only errors for offer; `validateBadge` allows empty for non-offer
- `setField` updated to accept `boolean` and `undefined`
- `handleSubmit` blocks non-offer intents with "Disponível em breve"
- Badge cleanup + preserveImageContext reset when intent changes

## Decisions Made
- All decisions follow D2-D5 from CONTEXT.md
- `userChangedIntent` ref central in setField for "campaignIntent" field
- validateDiscountedPrice and validateBadge exported for test access
