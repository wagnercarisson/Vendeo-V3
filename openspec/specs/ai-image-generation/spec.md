> **Purpose**: This spec defines the AI-native image generation service — the core capability that assembles store and campaign data into a marketing-directed prompt, sends the product image as visual reference to a visual AI model, and returns a flat 1:1 square campaign image ready for preview.

## Requirements

### Requirement: ImageGenerationService orchestrates AI-native image generation

The system SHALL provide an `ImageGenerationService` that orchestrates the full image generation lifecycle: prompt assembly from store identity + campaign data, pre-generation validation, image model invocation, post-generation quality review, and finite correction loops.

The service SHALL NOT persist any generated images, prompts, or review results. All data exists only in request/session/client scope during this phase.

The service SHALL reuse existing store and campaign forms — no separate demo-only flow SHALL be created.

#### Scenario: Service generates campaign image from valid inputs

- **WHEN** `ImageGenerationService.generateImage()` receives valid store identity (name, segment, palette, tone), campaign data (product name, description, prices, badge), and a product image data URL
- **THEN** the service SHALL assemble a marketing-directed prompt using the `campaign-image-director.md` prompt file
- **AND** the service SHALL send the prompt + product image reference to the `ImageProvider`
- **AND** the service SHALL return a generated 1:1 square image as a base64 data URL
- **AND** the generated image SHALL be treated as flat, non-editable art (no layer-based editing)

#### Scenario: Service includes store logo when available and accessible

- **WHEN** the store identity has a `logoUrl` available as a usable public URL or data URL
- **THEN** the assembled prompt SHALL include the logo as a brand signature reference
- **AND** the prompt SHALL NOT request generation of a new persistent store signature/logo

#### Scenario: Service skips logo if inaccessible

- **WHEN** the store identity has a `logoUrl` but it is a private URL, broken, or otherwise inaccessible to the provider
- **THEN** the service SHALL use the store name as brand signature fallback instead

#### Scenario: Service uses store name as fallback when no logo

- **WHEN** the store identity has no `logoUrl`
- **THEN** the assembled prompt SHALL use the store name as brand signature fallback

#### Scenario: Generated image uses provider native size

- **WHEN** the image model returns an image at a native size (e.g., 1024×1024 or 2048×2048)
- **THEN** the service SHALL accept the image at its native size
- **AND** the service SHALL NOT attempt to resize or normalize to 1080×1080 in this phase

#### Scenario: Service rejects product images exceeding size limit

- **WHEN** the incoming `productImageDataUrl` exceeds the configured payload size limit (~4MB base64)
- **THEN** the service SHALL return a controlled error with a clear message
- **AND** the image model SHALL NOT be called

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

`ImageProviderOutput` SHALL contain:
- `imageBase64` — string, base64-encoded image data
- `mimeType` — `"image/png" | "image/jpeg" | "image/webp"`
- `model` — string, the model identifier used for generation

#### Scenario: ImageProvider generates image from prompt

- **WHEN** `ImageProvider.generateImage()` is called with a valid prompt
- **THEN** it SHALL return an `ImageProviderOutput` with `imageBase64`, `mimeType`, and `model`
- **AND** the image SHALL be a 1:1 square format

#### Scenario: ImageProvider accepts optional product image reference

- **WHEN** `productImageDataUrl` is provided in the input
- **THEN** the provider SHALL pass the image as a visual reference to the image model

#### Scenario: Provider name identifies implementation

- **WHEN** inspecting `provider.name`
- **THEN** it SHALL return a non-empty string identifying the provider type (e.g., `"openai"`)

### Requirement: OpenAIImageProvider implementation

The system SHALL implement an `OpenAIImageProvider` class at `src/lib/image-generation/providers/openai.ts` that implements `ImageProvider`.

`OpenAIImageProvider` SHALL:
- Have `name: "openai"`
- Use GPT Image models (e.g., `gpt-image-2`) via the existing OpenAI client
- Use the Responses API with the `image_generation` tool as the primary path when it supports the requested prompt + image reference flow
- Use Image API edits only when the Responses API path is unavailable, insufficient, or fails for the specific reference/edit use case
- Accept `OPENAI_API_KEY` from environment (reuses existing setup)

#### Scenario: OpenAIImageProvider returns generated image

- **WHEN** `OpenAIImageProvider.generateImage()` succeeds
- **THEN** the returned `ImageProviderOutput` SHALL contain a valid base64 image
- **AND** `model` SHALL reflect the actual GPT Image model used

#### Scenario: OpenAIImageProvider uses Responses API

- **WHEN** generating an image from prompt + optional reference
- **THEN** the provider SHALL prefer the Responses API with `image_generation` tool

#### Scenario: OpenAIImageProvider uses Image API when Responses API unavailable

- **WHEN** the Responses API with `image_generation` tool is unavailable, insufficient, or fails for the specific prompt + image reference flow
- **THEN** the provider SHALL attempt the Image API edits endpoint as fallback

### Requirement: POST /api/campaign/generate-image endpoint

The system SHALL expose a POST endpoint at `/api/campaign/generate-image`.

The endpoint SHALL:
1. Accept POST requests with `Content-Type: application/json`
2. Require `productImageDataUrl` — required in Phase 4.3 product+offer flow; return 400 if absent
3. Accept optional `inputValidationOverride?: { productImageCheck?: "user_confirmed_continue" }` — when present, skip the pre-generation product name vs image validation for this request only
4. Run pre-generation input validation (product name vs product image), unless overridden by `inputValidationOverride`
5. Return 200 with the generated image as a data URL on success
    - May include `inputCorrections` when auto-fix was applied:
      ```json
      {
        "imageDataUrl": "data:image/png;base64,...",
        "inputCorrections": {
          "productName": { "from": "neskau", "to": "Nescau", "reason": "auto_fix" }
        }
      }
      ```
6. Return 400 if `productImageDataUrl` is missing
7. Return 409 with structured response when pre-generation validation blocks generation:
    - Reason `product_image_conflict`: the typed product clearly does not match the image
    - Reason `product_image_low_confidence`: the system could not confidently determine a match
    ```json
    {
      "status": "needs_user_action",
      "reason": "product_image_conflict",
      "message": "O nome do produto digitado não corresponde à imagem enviada.",
      "suggestedProductName": "Coca-Cola"
    }
    ```
8. Return 413 if the product image payload exceeds the configured size limit
9. Return 502 with controlled error on provider failure
10. Return 500 with controlled error on invalid output

The endpoint SHALL NOT modify, replace, or deprecate the existing `POST /api/campaign/generate` endpoint.

The client (campaign form hook) SHALL map the successful response's `imageDataUrl` into `PreviewPayload.generatedImageDataUrl` before navigating to `/campaign/preview`. This bridges the endpoint response field name to the preview payload field expected by the preview page.

#### Scenario: Valid request returns generated image

- **WHEN** POST to `/api/campaign/generate-image` with valid store and campaign data
- **THEN** the response SHALL have status 200
- **AND** the body SHALL contain a base64 data URL of the generated campaign image
- **AND** the image SHALL be 1:1 square

#### Scenario: Oversized product image returns 413

- **WHEN** `productImageDataUrl` exceeds the configured size limit
- **THEN** the response SHALL have status 413
- **AND** the body SHALL contain a clear message about the size limit

#### Scenario: Provider failure returns 502

- **WHEN** the image provider throws an error during generation
- **THEN** the response SHALL have status 502
- **AND** the body SHALL contain a controlled error message
- **AND** the body SHALL NOT contain the raw provider error

#### Scenario: Missing product image returns 400

- **WHEN** POST to `/api/campaign/generate-image` without `productImageDataUrl`
- **THEN** the response SHALL have status 400
- **AND** the body SHALL contain a message indicating the product image is required for Phase 4.3 product+offer flow

#### Scenario: Product name conflict returns 409

- **WHEN** pre-generation validation detects a conflict between the typed product name and the product image
- **AND** `inputValidationOverride.productImageCheck` is NOT set to `"user_confirmed_continue"`
- **THEN** the response SHALL have status 409
- **AND** the body SHALL contain `{ status: "needs_user_action", reason: "product_image_conflict" }`
- **AND** the body MAY include `suggestedProductName` inferred from the image
- **AND** the image model SHALL NOT be called

#### Scenario: Low confidence returns 409 with distinct reason

- **WHEN** pre-generation validation cannot confidently determine whether the typed product name matches the product image
- **AND** `inputValidationOverride.productImageCheck` is NOT set to `"user_confirmed_continue"`
- **THEN** the response SHALL have status 409
- **AND** the body SHALL contain `{ status: "needs_user_action", reason: "product_image_low_confidence" }`
- **AND** the image model SHALL NOT be called

#### Scenario: User override bypasses validation

- **WHEN** the user previously received a 409 conflict or low-confidence
- **AND** the user chose "continue anyway"
- **AND** the form resubmits with `inputValidationOverride: { productImageCheck: "user_confirmed_continue" }`
- **THEN** `InputValidationService` SHALL skip the conflict check for this request
- **AND** generation SHALL proceed normally

#### Scenario: Auto-fix returns 200 with inputCorrections

- **WHEN** pre-generation validation auto-corrects the product name (e.g., "neskau" → "Nescau")
- **THEN** the response SHALL have status 200
- **AND** the body SHALL contain the generated `imageDataUrl`
- **AND** the body SHALL contain `inputCorrections.productName` with `from`, `to`, and `reason` fields

#### Scenario: Existing /api/campaign/generate remains operational

- **WHEN** POST to `/api/campaign/generate` (existing endpoint)
- **THEN** it SHALL continue to work exactly as before, unaffected by this phase

### Requirement: Correction lifecycle as a state machine

The image generation pipeline SHALL implement a finite state machine inside `ImageGenerationService`:

```
[INITIAL] → generate → [REVIEW]
  ↓ pass                     ↓ fail + retries left
[COMPLETE]          [CORRECT] → generate (correction prompt, preserve composition)
                        ↓ review passes → [COMPLETE]
                        ↓ review fails + retries left
                      [REGENERATE] → generate (full regeneration)
                        ↓ review passes → [COMPLETE]
                        ↓ review fails → [ERROR]
```

The correction lifecycle SHALL be bounded: max 3 image-generation calls per user request (1 initial + 1 correction + 1 regeneration). Pre-check and review calls are separate and also bounded by the same lifecycle. After the limit, return a controlled error with the review explanation.

#### Scenario: Initial generation passes review

- **WHEN** the initial generated image passes all review checks
- **THEN** the lifecycle SHALL end at `[COMPLETE]`
- **AND** the image SHALL be returned to the client

#### Scenario: Correction fixes review issues

- **WHEN** the initial generation fails review
- **AND** a correction attempt succeeds
- **THEN** the corrected image SHALL be returned to the client

#### Scenario: All attempts exhausted returns error

- **WHEN** initial generation + correction + regeneration all fail review
- **THEN** a controlled error SHALL be returned
- **AND** the error SHALL include the review explanation

### Requirement: Pre-generation input validation

Before calling the image model, the system SHALL run an input validation check using `InputValidationService`, unless the request contains `inputValidationOverride: { productImageCheck: "user_confirmed_continue" }`. This service SHALL use a configured OpenAI vision-capable text model (initial default may be GPT-4o or equivalent) to compare the typed product name against the uploaded product image.

Returns one of:
- `match` — proceed with generation
- `auto-fix` — correct the product name automatically and proceed
- `conflict` — prompt the user to resolve before proceeding (unless overridden)
- `low-confidence` — ask the user before proceeding (unless overridden)

#### Scenario: Matching product name and image proceeds

- **WHEN** the typed product name matches the product image content
- **THEN** the service SHALL return `match`
- **AND** generation SHALL proceed

#### Scenario: Minor spelling error auto-corrects

- **WHEN** the user types "neskau" and the image clearly shows "Nescau"
- **THEN** the service SHALL return `auto-fix` with the corrected name
- **AND** generation SHALL proceed with the corrected name

#### Scenario: Real conflict prompts user

- **WHEN** the typed product is "Pepsi" and the image clearly shows "Coca-Cola"
- **THEN** the service SHALL return `conflict`
- **AND** the user SHALL be asked whether to correct the name, swap the image, or continue anyway

#### Scenario: Low confidence asks user

- **WHEN** the comparison confidence is below the configured threshold
- **THEN** the service SHALL return `low-confidence`
- **AND** the user SHALL be asked before proceeding
