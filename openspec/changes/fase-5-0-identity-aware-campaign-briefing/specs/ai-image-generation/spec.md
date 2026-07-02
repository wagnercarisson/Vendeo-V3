## MODIFIED Requirements

### Requirement: ImageGenerationService orchestrates AI-native image generation

The system SHALL provide an `ImageGenerationService` that orchestrates the full image generation lifecycle: prompt assembly from a `CampaignBrief`, pre-generation validation, image model invocation, post-generation quality review, and finite correction loops.

The service SHALL NOT persist any generated images, prompts, or review results. All data exists only in request/session/client scope during this phase.

The service SHALL reuse existing store and campaign forms — no separate demo-only flow SHALL be created.

The service SHALL report progress through named phases via an optional `onPhaseChange` callback: `input_validation`, `prompt_assembly`, `image_generation`, `quality_review`, `done`. Each phase SHALL emit a `GenerationPhaseEvent` when starting, completing, or failing.

The service SHALL accept an optional `AbortSignal` to support global timeout cancellation. When the signal fires, the service SHALL abort any in-flight provider call and emit a terminal `global_timeout` error.

From the `CampaignBrief`, the service SHALL:
- Use `campaignInput` for all campaign/product fields (unchanged pass-through)
- Use `store` fields for store identity variables
- Use `identity.directive` to inject into prompt variables as `identityDirective`
- Use `identity.imageUrl` to pass to the `ImageProvider` as the identity image reference
- Use `brandProfile` for brand creative direction

All existing prompt variables, assembly rules, and creative behavior SHALL be preserved unchanged. `buildPromptVariables()` SHALL NOT gain `identityImageUrl` — the identity image reference goes only to the provider, not to the prompt template.

#### Scenario: Service generates campaign image from CampaignBrief

- **WHEN** `ImageGenerationService.generateImage()` receives a valid `CampaignBrief`
- **THEN** the service SHALL assemble a marketing-directed prompt using the `campaign-image-director.md` prompt file
- **AND** the service SHALL send the prompt + product image + identity image reference to the `ImageProvider`
- **AND** the service SHALL return a generated 1:1 square image as a base64 data URL
- **AND** the generated image SHALL be treated as flat, non-editable art (no layer-based editing)
- **AND** all existing prompt variables and rules SHALL remain unchanged

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

`ImageProviderInput` SHALL contain (updated):
- `prompt` — string, required
- `productImageDataUrl?` — string, optional data URL (e.g., `data:image/jpeg;base64,...`)
- `identityImageUrl?` — string, optional, replaces `logoImageUrl`. Carries the logo or visual signature URL resolved by identity state. When absent, no identity image SHALL be sent.
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

#### Scenario: identityImageUrl sent as input_image

- **WHEN** `identityImageUrl` is provided in `ImageProviderInput`
- **THEN** `OpenAIImageProvider` SHALL include it as an `input_image` reference
- **AND** the `detail` SHALL be set to `"low"`

#### Scenario: No identityImageUrl sends no extra image

- **WHEN** `identityImageUrl` is `undefined`
- **THEN** `OpenAIImageProvider` SHALL NOT send any identity image
- **AND** SHALL only send `input_text` and `productImageDataUrl` (if present)

### Requirement: POST /api/campaign/generate-image endpoint

The system SHALL expose a POST endpoint at `/api/campaign/generate-image`.

The endpoint SHALL:
1. Accept POST requests with `Content-Type: application/json`
2. Require `storeId` (UUID) and `productImageDataUrl` — return 400 (no stream) if absent
3. Accept all existing campaign/product fields (`productName`, `originalPriceCents`, `discountedPriceCents`, `badgeText`, `description`, `hook`, `cta`, `objective`, `campaignDetails`, `additionalDetails`, `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints`) and `inputValidationOverride`
4. **NOT accept** `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl`, or `brandProfile` — if present, return 400
5. Call `resolveStoreIdentity(storeId)` → `validateIdentityReference()` → `buildCampaignBrief()` → `ImageGenerationService.generateImage(CampaignBrief)`
6. Run pre-generation input validation (product name vs product image), unless overridden by `inputValidationOverride`
7. Return a streaming NDJSON response (`Content-Type: application/x-ndjson`) with status 200 after validation passes
8. Stream phase events as newline-delimited JSON lines during generation
9. End the stream with a `type: "result"` event on success or a `type: "error"` event on terminal failure
10. Return 400 (no stream) if `productImageDataUrl` is missing
11. Return 413 (no stream) if the product image payload exceeds the configured size limit

Errors detected before streaming begins SHALL use standard HTTP error codes. Once the stream starts, the HTTP status SHALL remain 200 and all terminal errors SHALL be delivered as NDJSON events.

The endpoint SHALL NOT modify, replace, or deprecate the existing `POST /api/campaign/generate` endpoint.

The `type: "result"` event SHALL include the `storeIdentity` snapshot used during generation:
```json
{ "type": "result", "success": true, "imageDataUrl": "...", "storeIdentity": { ... } }
```

#### Scenario: Valid request returns streaming NDJSON

- **WHEN** POST to `/api/campaign/generate-image` with `storeId` and valid campaign data
- **THEN** the response SHALL have status 200
- **AND** `Content-Type` SHALL be `application/x-ndjson`
- **AND** the body SHALL contain newline-delimited JSON phase events followed by a final `type: "result"` event with `imageDataUrl` and `storeIdentity`

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

#### Scenario: Old identity fields in request return 400

- **WHEN** a POST request includes `storeName`, `storeLogoUrl`, or `brandProfile`
- **THEN** the endpoint SHALL return HTTP 400

### Requirement: buildPromptVariables includes creative direction context

The `ImageGenerationService.buildPromptVariables()` method SHALL be extended to accept a `CampaignBrief` and return the following new variable:

- `identityDirective` — string, derived from `CampaignBrief.identity.directive`

All existing variables SHALL be preserved unchanged. The following existing variables remain:
- `creativePersona` — segment-based persona string
- `inferredCategory` — product category (inferred or store segment fallback)
- `hasCategoryConflict` — `"sim"` or `"nao"` based on `isSameCategory()` comparison
- `categoryConflictDirective` — conditional directive string (empty when no conflict)
- `commercialRepertoire` — output of `buildCommercialRepertoire()`
- `inputValidationSummary` — output of `buildValidationSummary()`
- `creativeContextGuidance` — output of `buildCreativeContextGuidance()`

`buildPromptVariables()` SHALL NOT receive or return `identityImageUrl`. The identity image reference is passed directly to the `ImageProvider`, not interpolated into the prompt text.

#### Scenario: identityDirective present in buildPromptVariables output

- **WHEN** `buildPromptVariables()` is called with a `CampaignBrief`
- **THEN** the returned record SHALL include `identityDirective` with the directive string
- **AND** SHALL NOT include `identityImageUrl`

#### Scenario: New variables present alongside existing ones

- **WHEN** `buildPromptVariables()` is called
- **THEN** the returned record SHALL include all existing variables
- **AND** SHALL include `identityDirective`

### Requirement: Client consumes NDJSON stream with line buffering

The client-side consumer (in `useCampaignForm` or equivalent) SHALL read the NDJSON stream using the Fetch API's `response.body.getReader()`. The consumer SHALL implement a line buffer to handle chunk boundaries:

1. Accumulate incoming chunk bytes
2. Split the accumulated buffer by `\n`
3. Process complete lines as JSON events
4. Keep any partial trailing line in the buffer for the next chunk

Each event SHALL be type-dispatched:
- `type: "phase"` → update `GenerationProgress` state
- `type: "result"` → extract `imageDataUrl` and `storeIdentity`, build `PreviewPayload`, navigate to preview
- `type: "error"` → set error state, display message, stop generation

The POST body SHALL include `storeId` + campaign product fields — no identity fields. All identity data is resolved server-side.

#### Scenario: Client processes phase events in real-time

- **WHEN** a `type: "phase"` event is received from the stream
- **THEN** the client SHALL update the `GenerationProgress` component state
- **AND** the UI SHALL reflect the new phase status immediately

#### Scenario: Client handles result event with storeIdentity

- **WHEN** a `type: "result"` event is received with `success: true`, `imageDataUrl`, and `storeIdentity`
- **THEN** the client SHALL build the `PreviewPayload` using the returned `storeIdentity`
- **AND** SHALL navigate to `/campaign/preview`

#### Scenario: Client handles error event

- **WHEN** a `type: "error"` event is received
- **THEN** the client SHALL stop the generation flow
- **AND** SHALL display the `message` field from the event
- **AND** if `requiresUserAction` is `true`, SHALL show the appropriate user prompt (e.g., confirm product name)

#### Scenario: Client POST body uses storeId

- **WHEN** the consumer builds the request body
- **THEN** the body SHALL contain `storeId`
- **AND** SHALL NOT contain `storeName`, `storeSegment`, `storeTone`, `brandColor`, `storeLogoUrl`, or `brandProfile`

## ADDED Requirements

### Requirement: Preservação comportamental — nenhuma variável criativa alterada

`buildPromptVariables()` SHALL preserve all existing variables and their rules. The following SHALL remain unchanged:
- `creativePersona`, `inferredCategory`, `hasCategoryConflict`, `categoryConflictDirective`
- `commercialRepertoire`, `inputValidationSummary`, `creativeContextGuidance`
- `campaignDetails`, `additionalDetails`, `hook`, `cta`, `objective`
- `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints`

No new creative rules, composition directives, or mandatory requirements SHALL be added to the prompt. Subsegment, positioning, shortDescription, and slogan SHALL NOT be injected into prompt variables in this phase. The only prompt change is `{{identityDirective}}` replacing the fixed logo instruction.

#### Scenario: Regression parity for logo store

- **WHEN** the same store (`identity_state = 'logo'`) and campaign input are processed before and after this change
- **THEN** the generated prompt SHALL be equivalent in all fields, rules, and creative context
- **AND** the only differences SHALL be: `{{identityDirective}}` replaces the fixed logo instruction, and the `logoVariantUrl` line SHALL be removed from the `brandProfileSection`

#### Scenario: Regression parity for text_only store

- **WHEN** the same store (`identity_state = 'text_only'`) and campaign input are processed before and after this change
- **THEN** the generated prompt SHALL be equivalent in all fields, rules, and creative context
- **AND** the only difference SHALL be `{{identityDirective}}` replacing the fixed logo instruction
- **AND** no identity image URL SHALL be sent to the provider

#### Scenario: Regression parity for VS store

- **WHEN** the same store (`identity_state = 'visual_signature'`) and campaign input are processed before and after this change
- **THEN** the generated prompt SHALL be equivalent in all fields, rules, and creative context
- **AND** the only differences SHALL be: `{{identityDirective}}` replaces the fixed logo instruction, and the VS URL SHALL be sent as the identity image reference (was not sent before)
