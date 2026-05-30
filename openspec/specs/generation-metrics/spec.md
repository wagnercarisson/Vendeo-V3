# Generation Metrics

## Purpose

Automatic JSONL metrics recording per image generation run. Records provider, model, duration, estimated cost, retries, validation/review outcomes, and sanitized input summary. Best-effort only — never blocks generation.

## Requirements

### Requirement: System records automatic generation metrics per run

The system SHALL record structured metrics for every image generation execution. Metrics SHALL be written to a JSONL file in a local `metrics/` directory.

Metrics recording SHALL be active only in local/dev/benchmark environments. In production, metrics SHALL be disabled by default; when enabled, they SHALL be written to stdout only (no filesystem persistence assumed).

**Best-effort:** Failure to record metrics SHALL NEVER interrupt or fail the generation pipeline. If the metrics directory cannot be created, the JSONL file cannot be written, or the environment has no writable filesystem, the pipeline SHALL log the technical error and continue generation normally.

**Sanitization—what MUST NOT be recorded:**
- Product image or generated image (no base64 data)
- Full prompt text sent to the provider
- API keys, tokens, or authentication secrets
- Raw request payload
- HTTP headers
- Raw provider response
- Any other sensitive or personally identifiable data

**Sanitization—what MAY be recorded (safe summary only):**
- Product name (sanitized, truncated if necessary)
- Store name
- Store segment
- Campaign objective
- Campaign format/type
- Inferred product category
- Important flags (override occurred, conflicts detected, review result)

Each metrics record SHALL contain the following fields when available:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `runId` | `string` | always | unique identifier (crypto.randomUUID) |
| `timestamp` | `string` | always | ISO 8601 |
| `environment` | `string` | always | `"development" \| "production" \| "benchmark"` |
| `provider` | `string` | always | provider name (e.g., `"openai"`) |
| `model` | `string` | always | model identifier used for generation |
| `totalDurationMs` | `number` | always | wall-clock time |
| `phaseDurationsMs` | `Record<string, number>` | when available | per-phase duration |
| `estimatedCostUsd` | `number` | when available | approximate cost in USD; absent when cost cannot be estimated |
| `costEstimationSource` | `string` | when available | `"static_table" \| "provider_usage" \| "unavailable"` |
| `retryCount` | `number` | always | total retry/regeneration attempts |
| `validationResult` | `string` | when available | absent if failure occurred before validation phase |
| `inferredCategory` | `string` | when available | product category from image analysis |
| `conflictsDetected` | `string[]` | always | empty array when none |
| `hadOverride` | `boolean` | always | whether user confirmed an override |
| `reviewPassed` | `boolean` | when available | absent if failure occurred before review phase |
| `reviewFailureType` | `string \| null` | when available | null when review passed |
| `rejectionReason` | `string` | when available | user-facing error message on failure |
| `technicalError` | `string` | when available | sanitized error code on technical failure |
| `imageIdentifier` | `string` | when available | hash or reference to generated image; absent on failure |
| `sanitizedInputs` | `object` | always | `{ productName, storeName, storeSegment }` |

#### Scenario: Metrics recorded on successful generation

- **WHEN** `ImageGenerationService.generateImage()` completes with `success: true`
- **THEN** a metrics record SHALL be written with all automatic fields populated
- **AND** `reviewPassed` SHALL be `true`
- **AND** `technicalError` SHALL be absent

#### Scenario: Metrics recorded on failed generation

- **WHEN** `ImageGenerationService.generateImage()` completes with `success: false`
- **THEN** a metrics record SHALL be written
- **AND** `reviewPassed` SHALL be `false` (if review ran) or absent (if failure occurred before review)
- **AND** `rejectionReason` SHALL contain the user-facing error message
- **AND** `technicalError` SHALL contain the error code

#### Scenario: Metrics NOT recorded in production unless explicitly enabled

- **WHEN** `NODE_ENV === "production"`
- **AND** no explicit metrics env flag is set
- **THEN** metrics SHALL NOT be written to filesystem
- **AND** if metrics are enabled in production, they SHALL be written to stdout as structured JSON

#### Scenario: Metrics failure does not block generation

- **WHEN** the metrics writer fails (permission error, disk full, missing directory)
- **THEN** the error SHALL be logged
- **AND** the generation pipeline SHALL continue normally
- **AND** the generation result SHALL be returned to the client

### Requirement: Automatic vs manual metrics separation

The system SHALL distinguish between:
- **Automatic metrics** — collected by the pipeline without user intervention: provider, model, duration, estimated cost, retries, validation result, review result, category, conflicts, errors
- **Manual evaluation metrics** — optional, user-provided: visual quality rating, legibility rating, product fidelity rating, commercial strength rating, "publicável" (yes/no), and free-text observations

Manual evaluation metrics SHALL NOT be collected during normal generation. They SHALL be collected only during benchmark mode or via an explicit future mechanism.

#### Scenario: Manual evaluation fields are absent in normal runs

- **WHEN** a generation runs outside benchmark mode
- **THEN** the metrics record SHALL NOT include manual evaluation fields
