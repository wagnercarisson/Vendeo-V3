## ADDED Requirements

### Requirement: Global timeout aborts generation

The system SHALL implement a global timeout that limits the total duration of image generation including all phases and retries. The timeout SHALL be configurable via `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` environment variable with a default of 300000ms (5 minutes).

The global timeout SHALL be implemented via `AbortController`. When the timeout fires, all in-flight provider calls SHALL be aborted and the stream SHALL emit a terminal `global_timeout` error.

#### Scenario: Global timeout fires and aborts generation

- **WHEN** generation exceeds `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS`
- **THEN** the `AbortController` SHALL abort all in-flight provider calls
- **AND** the stream SHALL emit `{"type":"error","code":"global_timeout","httpStatus":504}`
- **AND** no further retries SHALL be attempted

#### Scenario: Generation completes within global timeout

- **WHEN** generation completes before `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` expires
- **THEN** the `AbortController` SHALL NOT fire
- **AND** the result SHALL be returned normally

### Requirement: provider_timeout is distinct from phase window monitoring

`provider_timeout` SHALL represent a real transport-level timeout from the network/SDK layer (e.g., TCP timeout, connection reset, request duration exceeding the default SDK timeout). It is NOT triggered by the recommended phase windows below.

#### Scenario: Network timeout emits provider_timeout

- **WHEN** the OpenAI SDK throws a timeout error during the provider call
- **THEN** the service SHALL emit an error with `code: "provider_timeout"`
- **AND** SHALL attempt retry/fallback per the retry policy

#### Scenario: SDK timeout is not confused with phase window

- **WHEN** the `image_generation` phase exceeds 120s but the provider call is still in progress
- **THEN** the service SHALL NOT emit `provider_timeout`
- **AND** SHALL continue waiting for the provider response

### Requirement: Per-phase timeout monitoring (non-binding, diagnostic only)

The system SHALL monitor per-phase duration for diagnostic and budget purposes only. These windows SHALL NOT abort phases or emit errors:

- `input_validation`: 30s
- `prompt_assembly`: 10s
- `image_generation`: 120s per attempt
- `quality_review`: 45s

These timeouts SHALL NOT abort the phase on their own. If a phase exceeds its recommended window while global timeout remains, the phase continues. If a phase's duration plus estimated remaining phases exceeds the global timeout, the current phase SHALL be allowed to complete but no retry SHALL be attempted.

#### Scenario: Phase exceeds recommended window but continues

- **WHEN** `image_generation` exceeds 120s
- **AND** `remainingTime` is still positive
- **THEN** the service SHALL NOT abort the phase
- **AND** a warning SHALL be logged to diagnostics

#### Scenario: No retry after phase exceeds budget

- **WHEN** `quality_review` completes after 50s (over 45s recommended)
- **AND** `remainingTime` is insufficient for another full `image_generation` attempt
- **AND** the review fails with a retryable error
- **THEN** the service SHALL skip retry
- **AND** emit the review failure as terminal

### Requirement: AbortSignal passed to provider calls

The `ImageProviderInput` interface SHALL include an optional `signal` field of type `AbortSignal`. When provided, the provider SHALL pass it to the underlying API client to enable cancellation on timeout or user abort.

#### Scenario: AbortSignal cancels in-flight provider request

- **WHEN** the global `AbortController` fires during a provider call
- **THEN** the provider SHALL cancel the in-flight HTTP request
- **AND** the provider SHALL throw or reject with an abort error
- **AND** the service SHALL catch the abort and emit `global_timeout`

#### Scenario: Provider call completes before signal fires

- **WHEN** the provider call completes before the `AbortSignal` fires
- **THEN** the result SHALL be returned normally
- **AND** no cancellation SHALL occur

### Requirement: Global timeout is configurable

The system SHALL read `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` from environment configuration in `src/lib/image-generation/config.ts`. If unset, the default of 300000 SHALL be used. Per-phase recommended windows SHALL also be configurable but with no explicit environment variable — they SHALL be calculated as fractions of the global timeout.

#### Scenario: Custom timeout is respected

- **WHEN** `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` is set to `600000`
- **THEN** the global timeout SHALL be 600s (10 minutes)
- **AND** no generation SHALL be aborted before 600s elapses

#### Scenario: Default timeout is used when unset

- **WHEN** `IMAGE_GENERATION_GLOBAL_TIMEOUT_MS` is NOT set
- **THEN** the default timeout of 300000ms (5 minutes) SHALL be used
