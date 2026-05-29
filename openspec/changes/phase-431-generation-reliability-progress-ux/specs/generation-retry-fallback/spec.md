## ADDED Requirements

### Requirement: Retry follows defined policy per error type

The system SHALL implement automatic retry for recoverable errors using the following policy:

| Error Code | Max Retries | Backoff | Strategy |
|------------|-------------|---------|----------|
| `provider_error` (429, 503, network) | 2 | 1s, 3s | Retry same provider path |
| `provider_timeout` | 1 | Immediate | Try fallback provider path |
| `no_image_in_response` | 1 | Immediate | Try fallback model/config |
| `empty_review` | 1 | Immediate | Regenerate and re-review |
| `insufficient_image` | 2 | Immediate | Regenerate with specific correction instruction |
| `review_low_confidence` | 1 | Immediate | Regenerate with quality improvement instruction |

Non-retryable errors (`provider_auth_error`, `generated_product_mismatch`, `product_image_conflict`, `input_low_confidence`, `invalid_data`, `global_timeout`) SHALL be emitted directly without retry attempt.

#### Scenario: Rate limit triggers retry

- **WHEN** the provider returns a 429 rate limit error
- **AND** retries remain for `provider_error` (max 2)
- **THEN** the service SHALL wait 1s before the first retry, 3s before the second
- **AND** SHALL call the provider again with the same prompt and configuration

#### Scenario: All retries exhausted emits terminal error

- **WHEN** all retry attempts for a recoverable error have been exhausted
- **AND** the error persists
- **THEN** the service SHALL return a `GenerationError` with `retryable: false`
- **AND** the API route SHALL convert it to an NDJSON `type: "error"` event

#### Scenario: Non-retryable error skips retry

- **WHEN** a non-retryable error occurs (e.g., `generated_product_mismatch`, `provider_auth_error`)
- **THEN** the service SHALL NOT attempt any retry
- **AND** SHALL return the error as terminal immediately

### Requirement: Retry is budget-aware — only retries if time remains

Before each retry attempt, the system SHALL check whether the estimated retry time fits within the remaining global timeout budget:

```
remainingTime = globalTimeout - elapsedTime
if (estimatedRetryDuration > remainingTime) → skip retry, emit terminal error
```

If the budget is exhausted, the error SHALL be emitted as `global_timeout` regardless of the original error code.

#### Scenario: Retry skipped when budget insufficient

- **WHEN** a `provider_error` occurs
- **AND** `remainingTime` is less than the estimated retry duration (e.g., 30s)
- **THEN** the service SHALL NOT attempt retry
- **AND** SHALL emit the error as terminal

#### Scenario: Retry proceeds when budget is sufficient

- **WHEN** a `provider_error` occurs
- **AND** `remainingTime` is greater than the estimated retry duration
- **THEN** the service SHALL proceed with retry
- **AND** the client SHALL receive a phase event with message "Tentando novamente..."

### Requirement: Fallback between provider paths

When the primary provider path fails with a recoverable error, the system SHALL attempt a fallback path if available. The fallback is configured in the provider implementation and SHALL use a different model or API method (e.g., Image API edit when Responses API fails).

The fallback path SHALL count as one of the retry attempts for `provider_timeout` errors.

#### Scenario: Primary path failure triggers fallback

- **WHEN** the primary provider path (Responses API) fails with a recoverable error
- **AND** a fallback path is available (Image API edit)
- **THEN** the service SHALL attempt the fallback path
- **AND** if the fallback succeeds, the result SHALL be returned normally

#### Scenario: Fallback failure emits terminal error

- **WHEN** both primary and fallback paths fail
- **THEN** the service SHALL emit a terminal error
- **AND** the error code SHALL reflect the original failure type (e.g., `provider_error`)
