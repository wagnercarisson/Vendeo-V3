# Provider / Model Switch

## Purpose

Environment-based configuration of the image generation provider and model via the `IMAGE_PROVIDER` environment variable. Simple factory pattern that returns a provider interface implementation without complex plugin/registry architecture.

## Requirements

### Requirement: Provider selected by IMAGE_PROVIDER env var

The image generation provider SHALL be selectable at runtime via the `IMAGE_PROVIDER` environment variable.

Supported values:
- `"openai"` — uses OpenAI API
- `"anthropic"` — uses Anthropic API

When `IMAGE_PROVIDER` is not set or is empty, the system SHALL default to `"openai"`.

#### Scenario: Provider selected by environment variable

- **WHEN** `IMAGE_PROVIDER=anthropic` is set
- **THEN** `createImageProvider("anthropic")` SHALL return an Anthropic provider instance
- **AND** `createImageProvider("openai")` SHALL return an OpenAI provider instance

#### Scenario: Default provider when env var is empty

- **WHEN** `IMAGE_PROVIDER` is not set
- **THEN** `createImageProvider()` SHALL return the OpenAI provider instance

### Requirement: Provider factory exists

The system SHALL provide a factory function `createImageProvider()` in `src/lib/image-generation/providers/factory.ts`.

The factory SHALL:
- Accept an optional `providerName` string parameter
- Return a provider instance conforming to a `ProviderInterface`
- Default to `"openai"` when `providerName` is not provided or empty
- Throw a clear `Error` for unsupported provider names (e.g., `Error("Unsupported provider: unsupported_provider_name")`)

The factory SHALL use a simple switch/case pattern — NOT a dynamic registry, class-based plugin system, or dependency injection container. This avoids circular import issues.

#### Scenario: Factory returns correct provider

- **WHEN** `createImageProvider("openai")` is called
- **THEN** it SHALL return an `OpenAIProvider` instance
- **AND** `createImageProvider("anthropic")` SHALL return an `AnthropicProvider` instance

#### Scenario: Factory throws for unsupported provider

- **WHEN** `createImageProvider("unsupported_provider_name")` is called
- **THEN** an error SHALL be thrown with message `"Unsupported provider: unsupported_provider_name"`

### Requirement: Provider interface exists

The system SHALL define a common `ProviderInterface` (or abstract class) across all provider implementations. At minimum, the provider SHALL expose:

- `generateImage(params: PromptVariables, signal?: AbortSignal): Promise<GenerationResult>` — the main generation method, accepting prompt variables and an optional AbortSignal for cancellation
- `getModel(): string` — returns the model identifier currently in use
- `getProviderName(): string` — returns the provider identifier (e.g., `"openai"`, `"anthropic"`)

#### Scenario: Provider interface implemented by all providers

- **WHEN** any provider is created
- **THEN** it SHALL implement `generateImage()`, `getModel()`, and `getProviderName()`

### Requirement: Model configurable per provider

Each provider SHALL expose its default model. The model MAY be overridden at the provider level through provider-specific configuration.

The route handler (`src/app/api/campaign/generate-image/route.ts`) SHALL NOT need to know the model name. The provider SHALL encapsulate model selection.

#### Scenario: Provider returns its model

- **WHEN** `provider.getModel()` is called
- **THEN** it SHALL return the model identifier string
- **AND** the route handler SHALL NOT reference the model string directly
