# 25-02: Integração Transacional

## Summary

Integrated all foundations into the real pipeline: `mandatoryArtworkText` (schema → UI → propagation), `mapBriefToCopyDirectorInput + buildOfferText`, 3-zone pipeline restructuring in `POST /api/campaign/generate-image`, onboarding grant via RPC, and retroactive `title?` compatibility.

## Changes

### Schema
- `src/lib/image-generation/schema.ts` — Added `mandatoryArtworkText?: string` to `GenerateImageRequestSchema`

### UI
- `src/components/campaign/mandatory-artwork-field.tsx` — New `MandatoryArtworkField` component (optional textarea)
- `src/components/flow/campaign-input-form.tsx` — Integrated `MandatoryArtworkField` below badge select
- `src/components/flow/use-campaign-form.ts` — Added `mandatoryArtworkText` to `CampaignFormFields`, `FieldErrors`, `EMPTY_FIELDS`, touched state, allFields, and request body

### Prompt
- `prompts/campaign-image-director.md` — Added `mandatoryArtworkText` row in campaign info table + rendering instruction

### Mapper
- `src/lib/copy/mapper.ts` — New `mapBriefToCopyDirectorInput(brief, input)` and `buildOfferText(input)` — `mandatoryArtworkText` explicitly excluded from Copy Director input

### Pipeline (3 zones)
- `src/app/api/campaign/generate-image/route.ts` — Full restructuring:
  - **PRÉ-STREAM:** Rate limit guard (429), record attempt, balance check (402), credit reservation before IA
  - **PARALELO:** `Promise.all([copyTask(), imageTask()])` with abort coordination and Gemini retry fallback
  - **PÓS-PARALELO:** Merge copy+image → transcode → upload → updateReady with Copy Director result; refund on failure
  - `publication_copy_snapshot` now comes from Copy Director (not deterministic fallback)

### Image Generation Service
- `src/lib/image-generation/services/image-generation-service.ts` — Added `mandatoryArtworkText` to prompt variables

### Onboarding Grant
- `supabase/migrations/20260717000002_create_store_with_initial_grant.sql` — Atomic RPC `create_store_with_initial_grant()` with 5-credit onboarding grant
- `src/app/api/store/route.ts` — POST handler now uses `supabase.rpc('create_store_with_initial_grant', ...)` instead of direct INSERT

### Retroactive Compatibility
- `src/lib/campaign/display.ts` — `CampaignPageProps.title?`, `getEffectivePublicationCopy` returns `title?`, `mapCampaignToProps` includes `title`
- `src/lib/campaign/publication-copy.ts` — `PublicationCopyUpdate` includes `title?`, `validatePublicationCopy` accepts optional `title` (0-200 chars)

## Verification
- [x] mandatoryArtworkText in schema, UI, inputSnapshot, Image Director prompt
- [x] mandatoryArtworkText excluded from Copy Director input and publication_copy_snapshot
- [x] 3-zone pipeline: 429 → 402 → reserve → parallel → merge/refund
- [x] Onboarding grant RPC with idempotency
- [x] title? backward compatible
