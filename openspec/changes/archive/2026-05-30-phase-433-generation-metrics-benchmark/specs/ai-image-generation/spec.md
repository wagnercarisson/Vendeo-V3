## ADDED Requirements

### Requirement: ImageGenerationService emits metrics per run

The system SHALL emit structured metrics for every image generation execution. The `ImageGenerationService.generateImage()` method SHALL accept an optional `onMetricsEvent` callback in addition to the existing `onPhaseChange` callback.

The `onMetricsEvent` callback SHALL receive a `GenerationMetricsEvent` containing:
- `runId` — unique identifier for the execution
- `phase` — current phase identifier
- `provider` — provider name
- `model` — model identifier
- `elapsedMs` — elapsed time since generation start
- `attempt` — current attempt number
- `estimatedCostUsd` — approximate cost (when available)

The `onMetricsEvent` callback SHALL NOT be exposed to the UI. It SHALL be consumed only by the metrics recording system.

#### Scenario: Metrics event emitted during generation

- **WHEN** `ImageGenerationService.generateImage()` runs
- **AND** `onMetricsEvent` callback is provided
- **THEN** the service SHALL emit metrics events through the callback
- **AND** the events SHALL include `runId`, `phase`, `provider`, `model`, and `elapsedMs`
- **AND** the events SHALL NOT include prompts, payloads, API keys, or generated images

### Requirement: Image provider selectable via environment variable

The `POST /api/campaign/generate-image` route handler SHALL use `createImageProvider()` factory function instead of directly instantiating `OpenAIImageProvider`. The factory SHALL read the `IMAGE_PROVIDER` environment variable and return the appropriate `ImageProvider` implementation.

The existing `ImageProvider` interface SHALL remain unchanged.

#### Scenario: Route handler uses factory

- **WHEN** a request hits the generate-image endpoint
- **THEN** the route SHALL call `createImageProvider()` to obtain the configured provider
- **AND** SHALL NOT hardcode a specific provider class

### Requirement: Image model configurable via environment variable

The image generation model SHALL be configurable via `IMAGE_GENERATION_RESPONSES_MODEL` in `.env.local`. The existing default (`gpt-5.5`) SHALL be preserved.

The vision review model (`VISION_REVIEW_MODEL`) SHALL remain separately configurable via its existing env var. No provider abstraction is required for the vision model at this stage.

#### Scenario: Image model changed via env var

- **WHEN** `IMAGE_GENERATION_RESPONSES_MODEL=gpt-5.5-preview`
- **THEN** the image generation SHALL use the specified model
- **AND** the vision review SHALL continue using `VISION_REVIEW_MODEL`
