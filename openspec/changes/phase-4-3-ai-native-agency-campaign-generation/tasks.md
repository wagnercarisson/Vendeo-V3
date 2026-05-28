## 1. Prompt Files

- [ ] 1.1 Create `prompts/` directory at project root
- [ ] 1.2 Write `prompts/campaign-image-director.md` — marketing director / art director persona prompt with `{{variable}}` placeholders for store identity (name, segment, tone, color) and campaign data (product, price, objective, details, channel, format, validity, availability, sensitive constraints)
- [ ] 1.3 Write `prompts/campaign-image-reviewer.md` — review criteria prompt that detects wrong price, wrong product name, wrong store name, illegible text, invented commercial conditions (critical vs minor), deformed product, and weak visual quality (critical vs minor); include strict instruction to respond only in valid JSON with `passed` + `issues[]` schema
- [ ] 1.4 Write `prompts/campaign-input-visual-check.md` — pre-generation conflict detection prompt that classifies as match / auto-fix / conflict / low-confidence between typed product name and product image; include strict instruction to respond only in valid JSON with `classification`, `confidence`, `correctedProductName`, `suggestedProductName`, `reason` schema

## 2. ImageProvider Interface & Implementation

- [ ] 2.1 Define `ImageProviderInput` interface in `src/lib/image-generation/providers/types.ts` with `prompt`, `productImageDataUrl?`, `size?`, `quality?` fields
- [ ] 2.2 Define `ImageProviderOutput` interface with `imageBase64`, `mimeType`, `model` fields
- [ ] 2.3 Define `ImageProvider` interface with `readonly name: string` and `generateImage(input: ImageProviderInput): Promise<ImageProviderOutput>`
- [ ] 2.4 Implement `OpenAIImageProvider` in `src/lib/image-generation/providers/openai.ts` using GPT Image models via the existing OpenAI client — prefer Responses API with `image_generation` tool, fall back to Image API edits when Responses API unavailable
- [ ] 2.5 Provider should assume validated input; oversized payloads are rejected by the endpoint before the provider is called

## 3. Prompt Loader

- [ ] 3.1 Implement `PromptLoader` in `src/lib/image-generation/prompt-loader.ts` with `fs.readFileSync` to read prompt files from `prompts/`
- [ ] 3.2 Implement in-memory caching so prompt files are read once per server instance lifetime
- [ ] 3.3 Implement `{{variable}}` interpolation using simple string replace — no template engine
- [ ] 3.4 Support all defined variables: productName, storeName, storeSegment, storeTone, brandColor, originalPrice, discountedPrice, badgeText, hook, cta, objective, campaignDetails, additionalDetails, targetChannel, format, validity, availabilityNotes, sensitiveConstraints

## 4. Schemas & Types

- [ ] 4.1 Create `src/lib/image-generation/schema.ts` with Zod schemas for `GenerateImageRequest` (with required `productImageDataUrl`, optional `inputValidationOverride?: { productImageCheck?: "user_confirmed_continue" }`), `GenerateImageSuccessResponse` (with `imageDataUrl`, optional `inputCorrections`), `GenerateImageNeedsUserActionResponse`
- [ ] 4.2 Define `InputValidationResult` union type: `match | auto-fix | conflict | low-confidence`
- [ ] 4.3 Define `ImageReviewResult` type with `passed: boolean` and `issues: ReviewIssue[]`
- [ ] 4.4 Define `ReviewIssue` type with `type`, `severity` ("critical" | "minor"), `description` fields
- [ ] 4.5 Define typed error classes or error response types for oversized image, provider failure, invalid output, review failure
- [ ] 4.6 Define model configuration constants in a small config file (e.g., `src/lib/image-generation/config.ts`): image generation model name, vision review model name, quality defaults, size limit — do not hardcode model names inside services

## 5. Pre-Generation Input Validation Service

- [ ] 5.1 Implement `InputValidationService` in `src/lib/image-generation/services/input-validation-service.ts`
- [ ] 5.2 Use a configured OpenAI vision-capable text model to compare typed product name against uploaded product image
- [ ] 5.3 Accept `inputValidationOverride?: { productImageCheck?: "user_confirmed_continue" }` — skip validation when present
- [ ] 5.4 Return classification: `match` (proceed), `auto-fix` (corrected name + proceed), `conflict` (prompt user), `low-confidence` (ask user)
- [ ] 5.5 Load `campaign-input-visual-check.md` prompt via `PromptLoader` for the classification task

## 6. Post-Generation Quality Review Service

- [ ] 6.1 Implement `ImageReviewService` in `src/lib/image-generation/services/image-review-service.ts`
- [ ] 6.2 Use a configured OpenAI vision-capable text model to inspect generated images
- [ ] 6.3 Return structured result: `passed: boolean` + `issues[]` with `type`, `severity` ("critical" | "minor"), `description`
- [ ] 6.4 Detect: wrong_price (critical), wrong_product_name (critical), wrong_store_name (critical), illegible_text (critical), invented_information (critical for specific commercial conditions, minor for generic disclaimers), deformed_product (critical), weak_visual_quality (critical below publishable, minor for small aesthetic issues)
- [ ] 6.5 Load `campaign-image-reviewer.md` prompt via `PromptLoader` for the review task

## 7. Image Generation Service (Orchestrator)

- [ ] 7.1 Implement `ImageGenerationService` in `src/lib/image-generation/services/image-generation-service.ts`
- [ ] 7.2 Implement prompt assembly: load `campaign-image-director.md`, interpolate all variables from store identity + campaign data
- [ ] 7.3 Include store logo only when available as a usable public URL or data URL; fall back to store name otherwise
- [ ] 7.4 Run `InputValidationService` internally before image generation (pass through any `inputValidationOverride` from the request)
- [ ] 7.5 Implement correction state machine: INITIAL → generate → REVIEW → CORRECT/REGENERATE → COMPLETE/ERROR
- [ ] 7.6 Bound lifecycle: max 3 image-generation calls (1 initial + 1 correction + 1 full regeneration)
- [ ] 7.7 Pass pre-generation validation result (auto-fix corrections) down through the pipeline so corrected values are used
- [ ] 7.8 Accept generated images at provider native size (1024×1024, 2048×2048) — no resize to 1080×1080 in this phase
- [ ] 7.9 Return controlled error with review explanation when all attempts exhausted

## 8. API Endpoint

- [ ] 8.1 Create `src/app/api/campaign/generate-image/route.ts` with POST handler
- [ ] 8.2 Accept JSON body with store identity fields, campaign data fields, required `productImageDataUrl`, and optional `inputValidationOverride`
- [ ] 8.3 Return 400 if `productImageDataUrl` is missing (required for Phase 4.3 product+offer flow)
- [ ] 8.4 Validate `productImageDataUrl` size against configured limit (~4MB base64) before calling any service; return 413 if exceeded
- [ ] 8.5 Call `ImageGenerationService.generateImage()`, which internally runs `InputValidationService` (respecting `inputValidationOverride`)
- [ ] 8.6 Return 409 with `reason: "product_image_conflict"` for clear name/image mismatch (unless overridden)
- [ ] 8.7 Return 409 with `reason: "product_image_low_confidence"` for uncertain match (unless overridden)
- [ ] 8.8 On auto-fix, map to 200 with `imageDataUrl` + `inputCorrections.productName { from, to, reason }`
- [ ] 8.9 On success, return 200 with `imageDataUrl` containing the generated campaign image
- [ ] 8.10 Return 502 for provider failures (controlled error, no raw data leaked)
- [ ] 8.11 Return 500 for invalid output (controlled error)
- [ ] 8.12 Verify existing `POST /api/campaign/generate` is untouched and still operational

## 9. Preview Page Adaptation

- [ ] 9.1 Add `generatedImageDataUrl?: string` to `PreviewPayload` type in `src/components/campaign/types.ts`
- [ ] 9.2 Modify preview page (`src/app/campaign/preview/page.tsx`) to detect `generatedImageDataUrl` and display AI-generated image as primary art
- [ ] 9.3 When generated image is displayed, hide or reduce the adjustments panel (image is flat, non-editable)
- [ ] 9.4 Add a toggle to switch back to legacy CSS renderer view
- [ ] 9.5 Fall back to CSS `CampaignRenderer` when no `generatedImageDataUrl` is present (backward compatible)
- [ ] 9.6 Handle sessionStorage quota gracefully if large base64 exceeds limits

## 10. Campaign Form Adaptation

- [ ] 10.1 In `useCampaignForm` (`src/components/flow/use-campaign-form.ts`), add a new submit path that calls `POST /api/campaign/generate-image`
- [ ] 10.2 Require `productImageDataUrl` to be present before submitting; block submit if no image is uploaded
- [ ] 10.3 Map successful response: set `PreviewPayload.generatedImageDataUrl = response.imageDataUrl`
- [ ] 10.4 Apply `inputCorrections.productName` from auto-fix response to the local form state before navigation
- [ ] 10.5 Handle 409 conflict: display user prompt asking whether to correct the name, swap the image, or continue anyway
- [ ] 10.6 On "continue anyway", resubmit with `inputValidationOverride: { productImageCheck: "user_confirmed_continue" }`
- [ ] 10.7 Handle 409 low-confidence: display user prompt asking to confirm or cancel
- [ ] 10.8 On confirm, resubmit with `inputValidationOverride: { productImageCheck: "user_confirmed_continue" }`
- [ ] 10.9 Add client-side product image downscale/compression before sending (target ≤1MB file)

## 11. Validation Gates

- [ ] 11.1 Run `npm run typecheck` — no type errors
- [ ] 11.2 Run `npm run lint` — no lint errors
- [ ] 11.3 Run `npm run build` — build succeeds
- [ ] 11.4 Manual test: valid product image generates AI image and navigates to preview
- [ ] 11.5 Manual test: auto-fix product name maps correction into preview payload
- [ ] 11.6 Manual test: product/image conflict returns 409 and shows user prompt
- [ ] 11.7 Manual test: low-confidence returns 409 and asks confirmation
- [ ] 11.8 Manual test: user chooses "continue anyway" after 409 conflict, override bypasses validation on retry
- [ ] 11.9 Manual test: request without productImageDataUrl returns 400
- [ ] 11.10 Manual test: oversized product image returns controlled 413
- [ ] 11.11 Manual test: existing `POST /api/campaign/generate` still works
- [ ] 11.12 Manual test: preview fallback still renders `CampaignRenderer` when `generatedImageDataUrl` is absent
