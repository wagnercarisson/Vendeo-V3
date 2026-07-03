## MODIFIED Requirements

### Requirement: Fallback between provider paths

When the primary provider path fails with a recoverable error, the system SHALL attempt a fallback path if available. The fallback is configured in the provider implementation and SHALL use a different model or API method (e.g., Image API edit when Responses API fails).

The fallback path SHALL count as one of the retry attempts for `provider_error` and `provider_timeout` errors.

The fallback SHALL send `identityImageUrl` alongside `productImageDataUrl` as `[productFile, identityFile]` in `images.edit`. The identity URL SHALL already have been validated by `validateIdentityReference()` before the brief was built. If fetching the identity URL fails during the fallback, the system SHALL treat this as a **controlled error** — return error to the client with a PT-BR message. Silent degradation (continuing without identity) SHALL NOT occur.

#### Scenario: Primary path failure triggers fallback

- **WHEN** the primary provider path (Responses API) fails with a recoverable error
- **AND** a fallback path is available (Image API edit)
- **THEN** the service SHALL attempt the fallback path
- **AND** the fallback SHALL send `[productFile, identityFile]` in `images.edit`
- **AND** if the fallback succeeds, the result SHALL be returned normally

#### Scenario: Fallback failure emits terminal error

- **WHEN** both primary and fallback paths fail
- **THEN** the service SHALL emit a terminal error
- **AND** the error code SHALL reflect the original failure type (e.g., `provider_error`)

#### Scenario: Identity fetch failure in fallback returns controlled error

- **WHEN** the fallback attempts to fetch the identity URL
- **AND** the fetch fails
- **THEN** the service SHALL return a terminal error
- **AND** SHALL NOT degrade silently

## ADDED Requirements

### Requirement: Identity asset preserved across retry and fallback paths

The `identityImageUrl` SHALL be preserved in all retry and fallback paths of `OpenAIImageProvider`. The current behavior where `attempt >= 1` skips directly to the Image API fallback and loses the identity asset SHALL be corrected.

The identity asset reference SHALL be available in:
- `attempt = 0` (Responses API, primary path): sent as `input_image`
- `attempt >= 1` (Image API edit, fallback path): fetched and sent as `identityFile`

#### Scenario: identityImageUrl sent on primary path

- **WHEN** `generateImage()` is called with `attempt = 0`
- **THEN** `identityImageUrl` SHALL be sent as `input_image` in the Responses API call

#### Scenario: identityImageUrl sent on fallback path

- **WHEN** `generateImage()` is called with `attempt >= 1`
- **THEN** `identityImageUrl` SHALL be fetched and sent as `identityFile` in the Image API edit call
