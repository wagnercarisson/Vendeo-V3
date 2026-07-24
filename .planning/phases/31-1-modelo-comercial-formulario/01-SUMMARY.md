---
phase: 31-1-modelo-comercial-formulario
plan: 01
subsystem: api
tags: [typescript, zod, types, constants]
requires:
  - phase: 25-integracao-transacional-pipeline
    provides: pipeline route, GenerateImageRequestSchema
  - phase: 27-conta-saldo-extrato
    provides: form structure, balance display
  - phase: 30-legal-foundation
    provides: legal clearance in pipeline pre-stream
provides:
  - CampaignIntent type ("offer" | "spotlight" | "exclusive")
  - InputSnapshot extended with campaignIntent and preserveImageContext
  - CampaignGenerationInputSchema with campaignIntent (default "offer")
  - GenerateImageRequestSchema with campaignIntent (default "offer") and preserveImageContext
  - BADGE_OPTIONS_BY_INTENT constant separated by intent
affects: [31-2, 31-3]
tech-stack:
  added: []
  patterns: [enum-based intent routing, Record<CampaignIntent> for badge options]
key-files:
  created: []
  modified:
    - src/lib/campaign/types.ts
    - src/lib/campaign-intelligence/schema.ts
    - src/lib/image-generation/schema.ts
    - src/lib/constants.ts
key-decisions:
  - CampaignIntent is an enum literal type, not string union
  - BADGE_OPTIONS remains backward compatible as BADGE_OPTIONS_BY_INTENT["offer"]
  - discountedPriceCents stays required in schemas (F31.2 will make optional)
requirements-completed: [INTENT-01, INTENT-02, INTENT-03, INTENT-04, INTENT-05]
completed: 2026-07-24
---

# Plan 01: Foundation — Types + Schemas + Constants

**CampaignIntent enum type, extended InputSnapshot, Zod schemas with campaignIntent default, and BADGE_OPTIONS_BY_INTENT constant**

## Performance
- **Files modified:** 4 (+4 existing test/benchmark files for type compatibility)
- **Tasks:** 3

## Accomplishments
- `CampaignIntent` type established as `"offer" | "spotlight" | "exclusive"`
- `InputSnapshot` extended with `campaignIntent?` and `preserveImageContext?`
- `CampaignGenerationInputSchema` and `GenerateImageRequestSchema` both have `campaignIntent` (optional, default "offer")
- `GenerateImageRequestSchema` also has `preserveImageContext` (optional)
- `BADGE_OPTIONS_BY_INTENT` with separate badge lists per intent; `BADGE_OPTIONS` stays backward-compatible
- Fixed 4 test/benchmark files that construct `CampaignInput` without `campaignIntent`

## Files Modified
- `src/lib/campaign/types.ts` — CampaignIntent type, InputSnapshot extended
- `src/lib/campaign-intelligence/schema.ts` — campaignIntent field
- `src/lib/image-generation/schema.ts` — campaignIntent + preserveImageContext
- `src/lib/constants.ts` — BADGE_OPTIONS_BY_INTENT
- `scripts/benchmark.ts`, `src/__tests__/actions/store-identity-service.test.ts`, `src/lib/actions/__tests__/store.test.ts` — type compat

## Decisions Made
- Followed D1-D6 exactly as specified in CONTEXT.md
- No deviations
