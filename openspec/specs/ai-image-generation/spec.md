# AI Image Generation

## Purpose

Core image generation pipeline: orchestrates prompt assembly, model invocation, quality review, and correction loops. Defines the service, provider interface, API endpoint, and client-side NDJSON streaming consumer.

## Requirements

### Requirement: ImageGenerationService orchestrates AI-native image generation

The system SHALL provide an `ImageGenerationService` that orchestrates the full image generation lifecycle: prompt assembly from store identity + campaign data, pre-generation validation, image model invocation, post-generation quality review, and finite correction loops.

The service SHALL NOT persist any generated images, prompts, or review results. All data exists only in request/session/client scope during this phase.

The service SHALL reuse existing store and campaign forms — no separate demo-only flow SHALL be created.

The service SHALL report progress through named phases via an optional `onPhaseChange` callback: `input_validation`, `prompt_assembly`, `image_generation`, `quality_review`, `done`. Each phase SHALL emit a `GenerationPhaseEvent` when starting, completing, or failing.

The service SHALL accept an optional `AbortSignal` to support global timeout cancellation. When the signal fires, the service SHALL abort any in-flight provider call and emit a terminal `global_timeout` error.

#### Scenario: Service generates campaign image from valid inputs

- **WHEN** `ImageGenerationService.generateImage()` receives valid store identity (name, segment, palette, tone), campaign data (product name, description, prices, badge), and a product image data URL
- **THEN** the service SHALL assemble a marketing-directed prompt using the `campaign-image-director.md` prompt file
- **AND** the service SHALL send the prompt + product image reference to the `ImageProvider`
- **AND** the service SHALL return a generated 1:1 square image as a base64 data URL
- **AND** the generated image SHALL be treated as flat, non-editable art (no layer-based editing)

#### Scenario: Service emits phase events via callback

- **WHEN** `onPhaseChange` callback is provided
- **THEN** the service SHALL emit `input_validation` → `prompt_assembly` → `image_generation` → `quality_review` → `done` in order
- **AND** each phase SHALL emit `status: "running"` when starting and `status: "complete"` when done

#### Scenario: Service aborts on signal

- **WHEN** the provided `AbortSignal` fires during image generation
- **THEN** the service SHALL abort the current provider call
- **AND** SHALL NOT attempt further retries
- **AND** SHALL emit a terminal error with `code: "global_timeout"`

### Requirement: ImageProvider interface

The system SHALL define an `ImageProvider` interface at `src/lib/image-generation/providers/types.ts` that abstracts the visual AI model invocation.

The interface SHALL define:
- `name` — `string` (readonly), provider identifier
- `generateImage(input: ImageProviderInput): Promise<ImageProviderOutput>` — method that takes a structured input and returns a generated image

`ImageProviderInput` SHALL contain:
- `prompt` — string, required
- `productImageDataUrl?` — string, optional data URL (e.g., `data:image/jpeg;base64,...`); the provider layer accepts it optionally for generality
- `size?` — `"1024x1024" | "2048x2048"`, optional
- `quality?` — `"low" | "medium" | "high" | "auto"`, optional
- `signal?` — `AbortSignal`, optional — when provided, the provider SHALL pass it to the underlying API client for cancellation support
- `attempt?` — `number`, optional — zero-indexed attempt counter (0 = primary, 1+ = retry/fallback)

`ImageProviderOutput` SHALL contain:
- `imageBase64` — string, base64-encoded image data
- `mimeType` — `"image/png" | "image/jpeg" | "image/webp"`
- `model` — string, the model identifier used for generation

#### Scenario: ImageProvider generates image from prompt

- **WHEN** `ImageProvider.generateImage()` is called with a valid prompt
- **THEN** it SHALL return an `ImageProviderOutput` with `imageBase64`, `mimeType`, and `model`
- **AND** the image SHALL be a 1:1 square format

#### Scenario: ImageProvider accepts AbortSignal

- **WHEN** `signal` is provided in `ImageProviderInput`
- **THEN** the provider SHALL pass the signal to the underlying API client
- **AND** if the signal fires, the provider SHALL cancel the request

#### Scenario: Provider name identifies implementation

- **WHEN** inspecting `provider.name`
- **THEN** it SHALL return a non-empty string identifying the provider type (e.g., `"openai"`)

### Requirement: POST /api/campaign/generate-image endpoint

The system SHALL expose a POST endpoint at `/api/campaign/generate-image`.

The endpoint SHALL:
1. Accept POST requests with `Content-Type: application/json`
2. Require `productImageDataUrl` — required in Phase 4.3 product+offer flow; return 400 (no stream) if absent
3. Accept optional `inputValidationOverride?: { productImageCheck?: "user_confirmed_continue" }` — when present, skip the pre-generation product name vs image validation for this request only
4. Run pre-generation input validation (product name vs product image), unless overridden by `inputValidationOverride`
5. Return a streaming NDJSON response (`Content-Type: application/x-ndjson`) with status 200 after validation passes
6. Stream phase events as newline-delimited JSON lines during generation
7. End the stream with a `type: "result"` event on success or a `type: "error"` event on terminal failure
8. Return 400 (no stream) if `productImageDataUrl` is missing
9. Return 413 (no stream) if the product image payload exceeds the configured size limit

Errors detected before streaming begins SHALL use standard HTTP error codes. Once the stream starts, the HTTP status SHALL remain 200 and all terminal errors SHALL be delivered as NDJSON events.

The endpoint SHALL NOT modify, replace, or deprecate the existing `POST /api/campaign/generate` endpoint.

#### Scenario: Valid request returns streaming NDJSON

- **WHEN** POST to `/api/campaign/generate-image` with valid store and campaign data
- **THEN** the response SHALL have status 200
- **AND** `Content-Type` SHALL be `application/x-ndjson`
- **AND** the body SHALL contain newline-delimited JSON phase events followed by a final `type: "result"` event with `imageDataUrl`

#### Scenario: Stream events have correct structure

- **WHEN** the stream delivers events
- **THEN** each event SHALL be a complete JSON object on its own line
- **AND** the line SHALL end with `\n`
- **AND** event type SHALL be `"phase"`, `"result"`, or `"error"`

#### Scenario: Validation error before stream returns 400

- **WHEN** `productImageDataUrl` is missing
- **THEN** the response SHALL have status 400
- **AND** the body SHALL contain JSON with `code: "invalid_data"` and a PT-BR message
- **AND** no NDJSON stream SHALL be opened

#### Scenario: Provider failure during stream delivers error event

- **WHEN** the image provider throws an error during generation (after stream started)
- **THEN** the stream SHALL deliver an error event with `code: "provider_error"` and `httpStatus: 502`
- **AND** the HTTP response status SHALL remain 200
- **AND** the raw provider error SHALL NOT appear in the event message

#### Scenario: Product name conflict returns 409 before stream

- **WHEN** pre-generation validation detects a conflict between the typed product name and the product image
- **AND** `inputValidationOverride.productImageCheck` is NOT set to `"user_confirmed_continue"`
- **THEN** the response SHALL have status 409
- **AND** the body SHALL contain `{ status: "needs_user_action", reason: "product_image_conflict" }`
- **AND** no NDJSON stream SHALL be opened

#### Scenario: Product name conflict after validation override streams generated_product_mismatch

- **WHEN** the user previously confirmed "continue anyway" via `inputValidationOverride`
- **AND** the quality review detects that the generated image displays the wrong product name
- **THEN** the stream SHALL deliver an error event with `code: "generated_product_mismatch"` and `requiresUserAction: false`
- **AND** the HTTP response status SHALL remain 200
- **AND** the user SHALL be asked to correct the product name or image (cannot "continue anyway")

### Requirement: Client consumes NDJSON stream with line buffering

The client-side consumer (in `useCampaignForm` or equivalent) SHALL read the NDJSON stream using the Fetch API's `response.body.getReader()`. The consumer SHALL implement a line buffer to handle chunk boundaries:

1. Accumulate incoming chunk bytes
2. Split the accumulated buffer by `\n`
3. Process complete lines as JSON events
4. Keep any partial trailing line in the buffer for the next chunk

Each event SHALL be type-dispatched:
- `type: "phase"` → update `GenerationProgress` state
- `type: "result"` → extract `imageDataUrl`, build `PreviewPayload`, navigate to preview
- `type: "error"` → set error state, display message, stop generation

#### Scenario: Client processes phase events in real-time

- **WHEN** a `type: "phase"` event is received from the stream
- **THEN** the client SHALL update the `GenerationProgress` component state
- **AND** the UI SHALL reflect the new phase status immediately

#### Scenario: Client handles result event

- **WHEN** a `type: "result"` event is received with `success: true` and `imageDataUrl`
- **THEN** the client SHALL build the `PreviewPayload` with the image data
- **AND** SHALL navigate to `/campaign/preview`

#### Scenario: Client handles error event

- **WHEN** a `type: "error"` event is received
- **THEN** the client SHALL stop the generation flow
- **AND** SHALL display the `message` field from the event
- **AND** if `requiresUserAction` is `true`, SHALL show the appropriate user prompt (e.g., confirm product name)

### Requirement: originalPrice is optional

The `originalPrice` field in the campaign input schema SHALL be `string | undefined`. When absent, the rendered campaign SHALL NOT display a "De: R$ X" line. The badge and discounted price SHALL still render normally.

#### Scenario: Campaign renders without original price

- **WHEN** a campaign is generated without `originalPrice`
- **THEN** the rendered image SHALL show the discounted price and badge
- **AND** SHALL NOT show a strikethrough original price or "De:" prefix

#### Scenario: Campaign renders with original price

- **WHEN** a campaign is generated with `originalPrice`
- **THEN** the rendered image SHALL show both the original (strikethrough) and discounted price

### Requirement: buildPromptVariables includes creative direction context

The `ImageGenerationService.buildPromptVariables()` method SHALL be extended to accept an optional `inferredCategory?: string` parameter and return the following new variables:

- `creativePersona` — segment-based persona string
- `inferredCategory` — product category (inferred or store segment fallback)
- `hasCategoryConflict` — `"sim"` or `"nao"` based on `isSameCategory()` comparison
- `categoryConflictDirective` — conditional directive string (empty when no conflict)
- `commercialRepertoire` — output of `buildCommercialRepertoire()`
- `inputValidationSummary` — output of `buildValidationSummary()`

All existing variables SHALL be preserved unchanged.

#### Scenario: New variables present in buildPromptVariables output

- **WHEN** `buildPromptVariables()` is called with `inferredCategory: "bebidas-energeticos"`
- **THEN** the returned record SHALL include `creativePersona`, `inferredCategory`, `hasCategoryConflict`, `categoryConflictDirective`, `commercialRepertoire`, and `inputValidationSummary`

### Requirement: buildCommercialRepertoire extracts actionable arguments

The system SHALL implement `ImageGenerationService.buildCommercialRepertoire(body: GenerateImageRequest): string` that analyzes the following fields for commercially actionable content:

- `additionalDetails` — free-form text
- `availabilityNotes` — availability information (e.g., "poucas unidades", "cores variadas")
- `validity` — promotion validity period
- `campaignDetails` — additional campaign context

The method SHALL return a single PT-BR string with extracted arguments formatted as visual repertoire. When no actionable content is found, the method SHALL return an empty string.

#### Scenario: Availability notes become commercial repertoire

- **WHEN** `availabilityNotes` is `"vários sabores disponíveis"`
- **THEN** the returned string SHALL contain `"Disponível em vários sabores"` or equivalent PT-BR text

### Requirement: buildValidationSummary generates sanitized summary

The system SHALL implement `ImageGenerationService.buildValidationSummary(body: GenerateImageRequest, effectiveProductName: string): string` that generates a sanitized summary of the input validation phase.

The summary SHALL include:
- Whether the product name was corrected (original → corrected, with reason)
- Whether the user confirmed an override for product-image conflict

The summary SHALL be in PT-BR and SHALL NOT expose raw model output, API keys, or internal error details.

#### Scenario: Validation summary includes correction info

- **WHEN** the product name was corrected from `"neskau"` to `"Nescau"` with reason `"O texto na imagem é 'Nescau'"`
- **THEN** the summary SHALL include `"Nome corrigido automaticamente de 'neskau' para 'Nescau'"`

### Requirement: assemblePrompt uses evolved prompt with new sections

The `ImageGenerationService.assemblePrompt()` method SHALL load the `campaign-image-director.md` prompt and interpolate all existing plus new creative direction variables. The evolved prompt SHALL include the new sections for creative persona, category context, commercial repertoire, and validation summary.

#### Scenario: Evolved prompt includes creative direction

- **WHEN** `assemblePrompt()` is called with variables that include creative direction context
- **THEN** the returned prompt string SHALL contain the interpolated creative direction sections

### Requirement: Pipeline emits sanitized technical detail events

The `ImageGenerationService` SHALL emit `detail` (sanitized technical info) in `GenerationPhaseEvent` at the following points:

| Phase | When | Detail content |
|-------|------|----------------|
| `input_validation` | After validation completes | `"classificação: {classification}, nome corrigido: '{from}' → '{to}'"` (if applicable) |
| `prompt_assembly` | After prompt assembly | `"briefing com persona de {segment}, categoria inferida: {category}"` |
| `image_generation` | At start of each attempt | `"tentativa {n}/{max}, modelo: {model}, tempo decorrido: {t}s"` |
| `quality_review` | After review completes | `"issues: {n} ({critical} críticas, {minor} menores), failureType: {type}"` |
| `done` | On completion | `"geração concluída em {t}s, {attempts} tentativas, {corrections} correções"` |

The pipeline SHALL emit `detail` strings that are safe-by-construction — containing only summarized technical metadata (phase name, classification, attempt count, model name, elapsed time). `GenerationProgress` SHALL continue applying `sanitizeDetail()` before display as a defense-in-depth measure.

#### Scenario: detail emitted for prompt_assembly phase

- **WHEN** the prompt assembly phase completes
- **THEN** the phase event SHALL include `detail` with the segment persona and inferred category
- **AND** the `detail` SHALL NOT contain raw model output or API keys

#### Scenario: detail emitted for each generation attempt

- **WHEN** a retry attempt begins during `image_generation`
- **THEN** the phase event SHALL include `detail` with the attempt number, model name, and elapsed time
- **AND** the `detail` SHALL NOT include estimated budget remaining unless the pipeline has reliable timeout tracking

### Requirement: validationContext passed to ImageReviewService

The `ImageGenerationService` SHALL construct a `ValidationContext` from the input validation results and pass it to `ImageReviewService` via the extended `ImageReviewInput`.

The `ValidationContext` SHALL include:
- `inputCorrection` — when the product name was corrected by validation
- `allowedConflicts` — when the user approved specific conflicts
- `overrides` — when the user confirmed "continue anyway"

#### Scenario: Validation context flows to review

- **WHEN** input validation corrected the product name
- **THEN** `validationContext.inputCorrection` SHALL be populated
- **AND** `ImageReviewInput.validationContext` SHALL contain the context
- **AND** the review SHALL use `effectiveProductName` as reference

### Requirement: applyValidationContextToReviewResult called after review

The `ImageGenerationService.generateImage()` method SHALL call `applyValidationContextToReviewResult()` immediately after `await this.imageReview.review(...)` returns, before evaluating `reviewResult.passed` and deciding the next state machine transition.

```typescript
reviewResult = await this.imageReview.review(imageDataUrl, reviewInput);
reviewResult = applyValidationContextToReviewResult(reviewResult, validationContext);
```

#### Scenario: Alignment applied before state machine decision

- **WHEN** the review completes with issues that include user-approved conflicts
- **THEN** `applyValidationContextToReviewResult()` SHALL remove only the approved conflict issues
- **AND** the state machine SHALL evaluate the filtered result
