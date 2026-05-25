## 1. Schema Setup

- [ ] 1.1 Create `src/lib/campaign-intelligence/` directory structure
- [ ] 1.2 Implement `CampaignGenerationInputSchema` in `src/lib/campaign-intelligence/schema.ts` with all fields (productName, originalPriceCents, discountedPriceCents, description, badge, storeName, storeSegment, brandColor, city optional, state optional)
- [ ] 1.3 Export `type CampaignGenerationInput = z.infer<typeof CampaignGenerationInputSchema>`
- [ ] 1.4 Implement `CampaignSpecSchema` in `src/lib/campaign-intelligence/schema.ts` with commercial_copy, offer, visual_parameters, and generation_metadata sections
- [ ] 1.5 Export `type CampaignSpec = z.infer<typeof CampaignSpecSchema>`
- [ ] 1.6 Implement `ErrorResponseSchema` for structured error responses
- [ ] 1.7 Run `npx tsc --noEmit` to verify zero type errors

## 2. Provider Interface + Mock

- [ ] 2.1 Implement `AIProvider` interface in `providers/types.ts` with `name` and `generate(input): Promise<ProviderRawResponse>`
- [ ] 2.2 Implement `ProviderRawResponse` type in `providers/types.ts`
- [ ] 2.3 Implement `MockProvider` in `providers/mock.ts` with deterministic store-specific output
- [ ] 2.4 Ensure `MockProvider.name` returns `"mock"` and `generation_metadata.provider` reflects `"mock"`
- [ ] 2.5 Run `npx tsc --noEmit` to verify zero type errors

## 3. Service Layer

- [ ] 3.1 Implement `CampaignIntelligenceService` in `service.ts` with provider injection via constructor
- [ ] 3.2 Implement `generate(input)` method: validate input → provider.generate() → validate output
- [ ] 3.3 Return `{ success: true, data: CampaignSpec }` on success
- [ ] 3.4 Return `{ success: false, code: "validation_error" }` on invalid input (provider not called)
- [ ] 3.5 Return `{ success: false, code: "provider_failure" }` on provider exception (no raw error leaked)
- [ ] 3.6 Return `{ success: false, code: "invalid_output" }` on malformed provider response (no raw output leaked)
- [ ] 3.7 Implement provider selection: use `MockProvider` when `OPENAI_API_KEY` absent; optionally use `OpenAIProvider` when key present
- [ ] 3.8 Run `npx tsc --noEmit` to verify zero type errors

## 4. API Route

- [ ] 4.1 Create `src/app/api/campaign/generate/route.ts` with POST handler
- [ ] 4.2 Parse and validate request body with `CampaignGenerationInputSchema.safeParse()` → return 400 on failure
- [ ] 4.3 Instantiate `CampaignIntelligenceService` with selected provider
- [ ] 4.4 Call `service.generate()` and return 200 with `CampaignSpec` JSON on success
- [ ] 4.5 Return 502 on `provider_failure` and 500 on `invalid_output` — never leak raw provider output
- [ ] 4.6 Run `npx tsc --noEmit` to verify zero type errors

## 5. OpenAI Provider (Optional / Non-blocking)

- [ ] 5.1 Implement `OpenAIProvider` in `providers/openai.ts` with `name: "openai"`
- [ ] 5.2 Add basic prompt that produces JSON matching `CampaignSpecSchema` structure
- [ ] 5.3 Default to `gpt-4o-mini` model
- [ ] 5.4 Read `OPENAI_API_KEY` from environment; skip instantiation when absent
- [ ] 5.5 Run `npx tsc --noEmit` to verify zero type errors

## 6. Verification

- [ ] 6.1 Run `npm run build` (or equivalent) to verify full build passes
- [ ] 6.2 Start dev server and test POST `/api/campaign/generate` with curl or dev payload
- [ ] 6.3 Confirm 200 response with valid `CampaignSpec` JSON
- [ ] 6.4 Confirm 400 response with invalid/missing fields
- [ ] 6.5 Confirm `generation_metadata.provider` is `"mock"` when no API key is set
- [ ] 6.6 Confirm no raw provider data appears in any error response
- [ ] 6.7 Run lint command and confirm zero errors/warnings
- [ ] 6.8 Verify service handles provider exception as provider_failure without leaking raw error
- [ ] 6.9 Verify service handles malformed provider output as invalid_output without leaking raw output
