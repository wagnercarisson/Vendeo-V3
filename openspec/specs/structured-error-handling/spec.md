# Structured Error Handling

## Purpose

Defines the discriminated error type system, structured error interface, and the pre-stream vs in-stream error delivery protocol for the image generation pipeline.

## Requirements

### Requirement: Generation errors use discriminated union type per failure mode

The system SHALL define a `GenerationErrorCode` discriminated union with the following error types, each representing a distinct failure mode:

| Code | Meaning | Retryable | Requires User Action |
|------|---------|-----------|---------------------|
| `no_image_in_response` | API returned 200 without an image | Yes | No |
| `empty_review` | Vision review returned no content | Yes | No |
| `insufficient_image` | Generated image is low quality, cropped, or unusable | Yes | No |
| `input_low_confidence` | Pre-validation could not determine product name match | No | Yes |
| `review_low_confidence` | Post-generation review confidence too low | Yes | No |
| `product_image_conflict` | Pre-validation: product name conflicts with image | No | Yes |
| `generated_product_mismatch` | Post-review: generated image has wrong product name | No | No |
| `provider_error` | Provider transient failure (429, 503, network) | Yes | No |
| `provider_auth_error` | Provider authentication or quota failure | No | No |
| `provider_timeout` | Provider call timed out at network/SDK level | Yes | No |
| `invalid_data` | Invalid or missing required input fields | No | No |
| `global_timeout` | Total generation time exceeded global budget | No | No |

#### Scenario: Error code is set correctly per failure mode

- **WHEN** a generation failure occurs
- **THEN** the error SHALL use the corresponding `GenerationErrorCode` from the union
- **AND** SHALL NOT use generic codes like `provider_failure` or `review_failed`

### Requirement: GenerationError interface carries structured metadata

The system SHALL define a `GenerationError` interface with:

```typescript
interface GenerationError {
  phase: string;
  code: GenerationErrorCode;
  message: string;
  detail?: string;
  httpStatus: number;
  retryable: boolean;
  requiresUserAction?: boolean;
}
```

- `message` SHALL be a human-readable string in PT-BR suitable for display to the lojista
- `detail` SHALL be an optional developer-oriented diagnostic (sanitized, no secrets)
- `httpStatus` SHALL indicate the equivalent HTTP status code (400, 409, 502, 504) for reference
- `retryable` SHALL be `true` only for errors where automatic retry is appropriate
- `requiresUserAction` SHALL be `true` only when the user must make a choice (e.g., confirm product name)

#### Scenario: Error message is user-friendly Portuguese

- **WHEN** an error occurs during generation
- **THEN** `message` SHALL be a complete sentence in PT-BR that explains what happened
- **AND** SHALL NOT contain English error codes, JSON, or stack traces

#### Scenario: Detail field is sanitized

- **WHEN** `detail` is populated
- **THEN** it SHALL NOT contain API keys, full image data URLs, or environment variables
- **AND** it SHALL contain the error code, phase name, and optionally a sanitized provider message

### Requirement: Pre-stream errors use HTTP status codes

Errors detected synchronously before any NDJSON stream has started SHALL use standard HTTP status codes:
- `invalid_data` → 400 Bad Request
- Payload too large → 413 Payload Too Large
- Missing required fields → 400 Bad Request
- `product_image_conflict` or `input_low_confidence` → 409 Conflict (pre-validation conflict, no stream)

These errors SHALL NOT open an NDJSON stream.

#### Scenario: Invalid input returns 400 before stream

- **WHEN** a request is missing a required field
- **THEN** the endpoint SHALL return HTTP 400
- **AND** the response body SHALL contain a JSON error with `code: "invalid_data"` and a `message` in PT-BR
- **AND** no NDJSON stream SHALL be opened

### Requirement: In-stream errors arrive as NDJSON events

Once the NDJSON stream has started (`Content-Type: application/x-ndjson` already sent), the HTTP status SHALL be 200. Terminal errors SHALL be delivered as NDJSON events:

```json
{"type":"error","phase":"quality_review","code":"generated_product_mismatch","message":"A imagem gerada exibiu um nome de produto diferente do informado.","httpStatus":409,"retryable":false,"requiresUserAction":false}
{"type":"error","phase":"input_validation","code":"product_image_conflict","message":"O nome do produto digitado não corresponde à imagem enviada.","httpStatus":409,"retryable":false,"requiresUserAction":true}
```

The client SHALL parse this event from the stream and handle the error directly, ignoring the HTTP status code.

#### Scenario: Stream error event has correct structure

- **WHEN** a terminal error occurs during streaming
- **THEN** an NDJSON event with `type: "error"` SHALL be sent
- **AND** the event SHALL contain `phase`, `code`, `message`, `httpStatus`, `retryable`
- **AND** if user action is needed, `requiresUserAction` SHALL be `true`
- **AND** the HTTP response status SHALL remain 200

#### Scenario: Client ignores HTTP status for stream errors

- **WHEN** the NDJSON stream delivers an error event with `httpStatus: 409` and `code: "generated_product_mismatch"`
- **THEN** the client SHALL read the error from the stream event, NOT from the HTTP response status
- **AND** the client SHALL display the error message from the event
- **AND** the client SHALL NOT offer a "continue anyway" option (different from pre-stream 409)

### Requirement: Client parses NDJSON stream safely with chunk buffering

The client-side stream consumer SHALL implement a line buffer that accumulates partial chunks, splits complete lines by `\n`, and parses only complete JSON lines. Partial lines at the end of a chunk SHALL be held in the buffer and prepended to the next chunk.

#### Scenario: Partial chunk is handled correctly

- **WHEN** a chunk arrives with a partial line at the end (e.g., `{"type":"phase",`)
- **THEN** the consumer SHALL NOT attempt to parse the partial line
- **AND** SHALL prepend it to the next chunk for completion
- **AND** the complete line SHALL be parsed when the next chunk arrives

#### Scenario: Multiple events in one chunk are all parsed

- **WHEN** a single chunk contains multiple complete lines separated by `\n`
- **THEN** each complete line SHALL be parsed and processed in order
- **AND** no events SHALL be dropped
