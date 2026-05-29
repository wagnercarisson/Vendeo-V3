# Image Quality Review

## Purpose

Defines the post-generation vision-based quality review service, its structured result types including `failureType` classification, and how the review drives the correction lifecycle in `ImageGenerationService`.

## Requirements

### Requirement: ImageReviewService reviews generated images

The system SHALL provide an `ImageReviewService` that inspects every generated campaign image before it is shown to the user. The review runs **after** image generation, as part of the correction lifecycle.

The service SHALL use a configured OpenAI vision-capable text model (initial default may be GPT-4o or equivalent) because it needs to analyze the visual content of the generated image.

The service SHALL return a structured review result with:
- `passed` — boolean
- `failureType` — `string | null` — when `passed` is `false`, SHALL be one of: `"empty_review"`, `"insufficient_image"`, `"review_low_confidence"`, `"generated_product_mismatch"`. When `passed` is `true` or failure is from a critical issue that triggers correction (e.g., `wrong_price`), SHALL be `null`.
- `issues` — array of detected issues, each with:
  - `type` — the category of issue
  - `severity` — `"critical" | "minor"`
  - `description` — human-readable explanation

The service SHALL NOT return a generic `review_failed` indicator. Every failure SHALL be classified into a specific `failureType`.

#### Scenario: Generated image passes all checks

- **WHEN** a generated image contains the correct price, correct product name, correct store name, legible text, no invented information, and acceptable visual quality
- **THEN** the review SHALL return `passed: true`
- **AND** `failureType` SHALL be `null`
- **AND** the issues array SHALL be empty

#### Scenario: Wrong price detected

- **WHEN** the generated image displays a price different from what was provided in the campaign input
- **THEN** the review SHALL return an issue with type `wrong_price`
- **AND** severity SHALL be `critical`
- **AND** `passed` SHALL be `false`
- **AND** `failureType` SHALL be `null` (critical-issue-only failures trigger correction via the existing lifecycle, not terminal failure)

#### Scenario: Vision model returns empty content

- **WHEN** the vision model returns no content or an empty review
- **THEN** the review SHALL return `passed: false`
- **AND** `failureType` SHALL be `"empty_review"`
- **AND** the issues array SHALL contain a single issue: `{ type: "empty_review", severity: "critical", description: "O modelo de revisão não retornou conteúdo." }`

#### Scenario: Generated image is insufficient quality

- **WHEN** the generated image is blurry, cropped, distorted, or otherwise insufficient for use
- **THEN** the review SHALL return `passed: false`
- **AND** `failureType` SHALL be `"insufficient_image"`

#### Scenario: Low confidence in match (review)

- **WHEN** the review cannot confidently determine whether the image matches the campaign input
- **THEN** the review SHALL return `passed: false`
- **AND** `failureType` SHALL be `"review_low_confidence"`

#### Scenario: Generated product name mismatch detected

- **WHEN** the generated image displays a product name that does not match the campaign input
- **THEN** the review SHALL return `passed: false`
- **AND** `failureType` SHALL be `"generated_product_mismatch"`
- **AND** severity SHALL be `critical`

### Requirement: Review drives correction lifecycle

The review result SHALL drive the correction state machine in `ImageGenerationService`. The `failureType` SHALL determine whether the error is retryable or requires user action:

| `failureType` / condition | Retryable | User Action Needed |
|---------------------------|-----------|-------------------|
| `empty_review` | Yes | No |
| `insufficient_image` | Yes | No |
| `review_low_confidence` | Yes | No |
| `null` (critical issues like `wrong_price`, `wrong_product_name` exist) | Yes | No |
| `generated_product_mismatch` | No | No |

Critical issues with retryable `failureType` trigger correction or regeneration. When `passed: false` and `failureType: null` but critical issues exist, correction SHALL also be attempted (same as retryable). `generated_product_mismatch` SHALL NOT retry — it SHALL emit a terminal error.

#### Scenario: Retryable failure type triggers correction

- **WHEN** the review finds any retryable failure type (`empty_review`, `insufficient_image`, `review_low_confidence`)
- **AND** retries remain in the lifecycle
- **THEN** a correction or regeneration SHALL be attempted

#### Scenario: Null failureType with critical issues triggers correction

- **WHEN** the review returns `passed: false`, `failureType: null`
- **AND** the issues array contains critical issues (e.g., `wrong_price`)
- **AND** retries remain in the lifecycle
- **THEN** a correction or regeneration SHALL be attempted

#### Scenario: Generated product mismatch emits terminal error

- **WHEN** the review returns `failureType: "generated_product_mismatch"`
- **THEN** the lifecycle SHALL end
- **AND** a terminal error with `code: "generated_product_mismatch"` SHALL be emitted
- **AND** no retry SHALL be attempted

#### Scenario: Only minor issues pass through

- **WHEN** the review finds only minor issues (e.g., weak visual quality)
- **AND** no critical issues exist
- **AND** `failureType` is `null`
- **THEN** the image SHALL be considered passing
- **AND** minor issues MAY be logged for diagnostics
