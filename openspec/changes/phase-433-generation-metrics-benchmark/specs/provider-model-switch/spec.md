## ADDED Requirements

### Requirement: Image provider selectable via environment variable

The system SHALL allow selection of the image generation provider via the `IMAGE_PROVIDER` environment variable in `.env.local`.

Supported values:
- `"openai"` (default) — uses `OpenAIImageProvider`

The system SHALL implement a factory function `createImageProvider()` in `config.ts` or a dedicated module that reads `IMAGE_PROVIDER` and returns the appropriate `ImageProvider` implementation.

When `IMAGE_PROVIDER` is not set, the system SHALL default to `"openai"` without error.

When `IMAGE_PROVIDER` is set to an unrecognized value at runtime (app), the system SHALL log a warning and fall back to OpenAI for stability.

When `--provider` is passed with an unrecognized value in benchmark mode, the system SHALL fail fast with a clear error message — no silent fallback.

#### Scenario: Default provider is OpenAI

- **WHEN** `IMAGE_PROVIDER` is not set
- **THEN** `createImageProvider()` SHALL return an `OpenAIImageProvider` instance
- **AND** no error SHALL be raised

#### Scenario: OpenAI provider selected explicitly

- **WHEN** `IMAGE_PROVIDER=openai`
- **THEN** `createImageProvider()` SHALL return an `OpenAIImageProvider` instance

#### Scenario: Unrecognized provider at runtime logs warning and falls back

- **WHEN** `IMAGE_PROVIDER=unknown` (runtime, not benchmark)
- **THEN** `createImageProvider()` SHALL log a warning
- **AND** SHALL return an `OpenAIImageProvider` instance

#### Scenario: Unrecognized provider in benchmark fails fast

- **WHEN** `npx tsx scripts/benchmark.ts --provider gemni` (typo in benchmark)
- **THEN** the benchmark script SHALL print a clear error message
- **AND** SHALL exit with non-zero code
- **AND** SHALL NOT fall back to OpenAI

### Requirement: Image model configurable per environment variable

The system SHALL allow the image generation model to be configured via `IMAGE_GENERATION_RESPONSES_MODEL` in `.env.local`.

Existing model env vars (`GPT_IMAGE_MODEL`, `IMAGE_EDIT_FALLBACK_MODEL`, `VISION_REVIEW_MODEL`) SHALL continue to work unchanged.

#### Scenario: Custom model from env var

- **WHEN** `IMAGE_GENERATION_RESPONSES_MODEL=gpt-5.5-preview`
- **THEN** the image generation SHALL use `"gpt-5.5-preview"` for the primary generation call

### Requirement: Vision review model configurable via environment variable

The system SHALL continue to support `VISION_REVIEW_MODEL` for configuring the model used by input validation and quality review.

This is an existing capability extended only with documentation and guardrails. No code changes required unless a different provider is needed for the vision model.

#### Scenario: Vision model configured separately

- **WHEN** `VISION_REVIEW_MODEL=gpt-4o`
- **THEN** the input validation and quality review SHALL use `"gpt-4o"`
- **AND** this SHALL NOT affect the image generation model

### Requirement: Factory pattern reuses existing ImageProvider interface

The `createImageProvider()` factory SHALL reuse the existing `ImageProvider` interface from `src/lib/image-generation/providers/types.ts`. No changes to the interface contract are required.

The factory SHALL be a simple switch/if-else — NOT a plugin system, registry, or dynamic discovery. Additional providers can be added by extending the factory with a new case.

#### Scenario: New provider added via factory extension

- **WHEN** a new `GeminiImageProvider` implementing `ImageProvider` is added
- **THEN** the factory SHALL be extended with `case "gemini": return new GeminiImageProvider(config)`
- **AND** no other architectural changes SHALL be required

### Requirement: API route uses factory instead of hardcoded provider

The `POST /api/campaign/generate-image` route handler SHALL use `createImageProvider()` instead of directly instantiating `OpenAIImageProvider`.

#### Scenario: Route handler respects IMAGE_PROVIDER

- **WHEN** a request hits the generate-image endpoint
- **THEN** the route SHALL call `createImageProvider()` to obtain the configured provider
- **AND** SHALL NOT hardcode a specific provider class

### Requirement: Future Gemini support provisioned (no implementation)

The system SHALL document in `.env.example` and relevant comments that Gemini support is intended for future implementation. The metrics format, benchmark scenarios, and factory pattern SHALL be designed to accommodate Gemini without structural changes.

#### Scenario: Gemini placeholder documented

- **WHEN** inspecting `.env.example`
- **THEN** `IMAGE_PROVIDER=gemini` SHALL be listed as a future option (commented out)
