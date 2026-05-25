## Why

The campaign input form (Phase 2) collects product/offer/store data but has no backend layer to transform it into a structured specification the visual renderer can consume. Without this phase, there's no bridge between "data entered" and "image rendered." This phase creates the AI Campaign Intelligence backend that validates, structures, and enriches the input into a `CampaignSpec` — the contract that future Phase 4 rendering will consume.

## What Changes

- New backend service directory `src/lib/campaign-intelligence/` with Zod schemas, service layer, and abstract provider interface
- New POST endpoint `/api/campaign/generate`
- `CampaignGenerationInput` schema: validates incoming form data + store identity into a typed contract
- `CampaignSpec` output schema with typed contracts for:
  - `commercial_copy` — title, subtitle, hook, cta
  - `offer` — product_name, original_price_display (optional), discounted_price_display, badge_text
  - `visual_parameters` — layout_preset, composition_type, hierarchy_focus, palette_accent, badge_style, background_style
  - `generation_metadata` — provider, model, generated_at
  All fields validated via Zod before returning; invalid output never passes through
- Abstract `AIProvider` interface allowing future swap between OpenAI/Anthropic
- Mock provider (`providers/mock.ts`) as the required implementation for this phase. OpenAI provider (`providers/openai.ts`) may be included only if `OPENAI_API_KEY` is available at runtime, with automatic fallback to mock when the key is absent
- No database writes, no image handling, no preview, no history, no dashboard
- This phase does not decide final visual quality; it only produces the validated intelligence contract consumed by the future renderer.

## Capabilities

### New Capabilities
- `ai-campaign-intelligence`: Backend service that transforms campaign form data + store identity into a validated `CampaignSpec` via AI inference, with abstract provider interface and Zod-enforced I/O contracts

### Modified Capabilities

*(None — no existing spec requirements are changing)*

## Impact

- **New code**: `src/lib/campaign-intelligence/schema.ts`, `service.ts`, `providers/types.ts`, `providers/mock.ts` (+ `providers/openai.ts` if included)
- **Error handling**:
  - Invalid input → 400 with structured error
  - AI provider failure → 502 with controlled message (no raw provider response)
  - Malformed/invalid AI output → 500 with structured error
  - No raw provider output is ever forwarded to the frontend
- **New API route**: `src/app/api/campaign/generate/route.ts`
- **Dependencies**: `zod` for schema validation (already in project); OpenAI SDK only if OpenAI provider is included
- **No database changes**: no migrations, no new tables, no image/file handling
- **No visual frontend changes**: no new screens, no preview UI, no campaign display. Optional manual validation may use curl or a temporary/dev-only API test payload. Do not create preview UI.
