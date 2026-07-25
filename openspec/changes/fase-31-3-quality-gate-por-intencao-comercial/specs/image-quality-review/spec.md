## MODIFIED Requirements

### Requirement: ImageReviewService reviews generated images

The system SHALL provide an `ImageReviewService` that inspects every generated campaign image before it is shown to the user. The review runs **after** image generation, as part of the correction lifecycle.

The service SHALL use a configured OpenAI vision-capable text model (initial default may be GPT-4o or equivalent) because it needs to analyze the visual content of the generated image.

The service SHALL return a structured review result with:
- `passed` — boolean
- `failureType` — `string | null` (NOT optional/undefined) — when `passed` is `false`, SHALL be one of: `"empty_review"`, `"insufficient_image"`, `"review_low_confidence"`, `"generated_product_mismatch"`. When `passed` is `true` or failure is from a critical issue that triggers correction (e.g., `wrong_price`, `commercial_tone_mismatch` critical), SHALL be **explicitly `null`**, not `undefined`.
- `issues` — array of detected issues, each with:
  - `type` — the category of issue, including `"commercial_tone_mismatch"`
  - `severity` — `"critical" | "minor"`
  - `description` — human-readable explanation

**Decisão de schema:** migrar `failureType?:` (optional/undefined) para `failureType: ... | null` (explicit null). Isso padroniza o contrato: `undefined` significa "campo ausente/não definido", `null` significa "avaliado e determinado como não aplicável". Todas as saídas do `ImageReviewResult` SHALL ter `failureType` presente — seja um valor literal ou `null`.

The service SHALL NOT return a generic `review_failed` indicator. Every failure SHALL be classified into a specific `failureType`.

The `ImageReviewInput` SHALL include `campaignIntent?: CampaignIntent` (default `"offer"`), `preserveImageContext?: boolean`, and SHALL make `badgeText`, `discountedPrice`, `originalPrice` optional.

The review SHALL adapt its expectations based on `campaignIntent` using contextual variables (`expectedPriceBehavior`, `expectedBadgeBehavior`, `expectedImageTreatment`, `expectedCommercialTone`, `campaignIntentLabel`) that are fully interpolated by the service before being passed to the prompt.

#### Scenario: Generated image passes all checks

- **WHEN** a generated image contains the correct price (for offer) or no price (for exclusive), correct product name, correct store name, legible text, no invented information, acceptable visual quality, and tone coherent with intent
- **THEN** the review SHALL return `passed: true`
- **AND** `failureType` SHALL be `null`
- **AND** the issues array SHALL be empty or contain only minor issues

#### Scenario: Wrong price in offer is critical

- **WHEN** `campaignIntent` is `"offer"`
- **AND** the generated image displays a price different from what was provided in the campaign input
- **THEN** the review SHALL return an issue with type `wrong_price`
- **AND** severity SHALL be `critical`
- **AND** `passed` SHALL be `false`
- **AND** `failureType` SHALL be `null` (critical-issue-only failures trigger correction)

#### Scenario: Price in exclusive generates critical issue

- **WHEN** `campaignIntent` is `"exclusive"`
- **AND** the generated image displays any price
- **THEN** the review SHALL return an issue with type `wrong_price`
- **AND** severity SHALL be `critical`
- **AND** `passed` SHALL be `false`

#### Scenario: Promotional CTA in exclusive generates commercial_tone_mismatch

- **WHEN** `campaignIntent` is `"exclusive"`
- **AND** the generated image contains a promotional CTA like "Promoção relâmpago" that contradicts the exclusive intent
- **THEN** the review SHALL return an issue with type `commercial_tone_mismatch`
- **AND** severity SHALL be `critical` if it contradicts intent or invents commercial condition
- **AND** severity SHALL be `minor` if the piece remains publishable

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
| `null` (critical issues like `wrong_price`, `wrong_product_name`, `commercial_tone_mismatch` critical exist) | Yes | No |
| `generated_product_mismatch` | No | No |

Critical issues with retryable `failureType` trigger correction or regeneration. When `passed: false` and `failureType: null` but critical issues exist, correction SHALL also be attempted (same as retryable). `generated_product_mismatch` SHALL NOT retry — it SHALL emit a terminal error. `commercial_tone_mismatch` with `minor` severity SHALL NOT block or trigger correction.

#### Scenario: Retryable failure type triggers correction

- **WHEN** the review finds any retryable failure type (`empty_review`, `insufficient_image`, `review_low_confidence`)
- **AND** retries remain in the lifecycle
- **THEN** a correction or regeneration SHALL be attempted

#### Scenario: Null failureType with critical issues triggers correction

- **WHEN** the review returns `passed: false`, `failureType: null`
- **AND** the issues array contains critical issues (e.g., `wrong_price`, `commercial_tone_mismatch` critical)
- **AND** retries remain in the lifecycle
- **THEN** a correction or regeneration SHALL be attempted

#### Scenario: Generated product mismatch emits terminal error

- **WHEN** the review returns `failureType: "generated_product_mismatch"`
- **THEN** the lifecycle SHALL end
- **AND** a terminal error with `code: "generated_product_mismatch"` SHALL be emitted
- **AND** no retry SHALL be attempted

#### Scenario: Only minor issues pass through

- **WHEN** the review finds only minor issues (e.g., `commercial_tone_mismatch` minor, `weak_visual_quality` minor)
- **AND** no critical issues exist
- **AND** `failureType` is `null`
- **THEN** the image SHALL be considered passing
- **AND** minor issues MAY be logged for diagnostics

### Requirement: ImageReviewInput extended with campaignIntent and preserveImageContext

The `ImageReviewInput` interface SHALL be extended with:
- `campaignIntent?: CampaignIntent` — default `"offer"` for backward compatibility
- `preserveImageContext?: boolean` — indicates whether the reviewer should allow contextual background
- `badgeText?: string` — made optional (was required)
- `discountedPrice?: string` — made optional (was required)
- `originalPrice?: string` — remains optional

The `validationContext?: ValidationContext` field SHALL remain as previously defined.

#### Scenario: ImageReviewInput with campaignIntent exclusive

- **WHEN** `ImageReviewInput` is constructed with `{ campaignIntent: "exclusive" }`
- **THEN** `discountedPrice` MAY be omitted
- **AND** the review SHALL NOT expect a price on the image
- **AND** `badgeText` MAY be omitted
- **AND** the review SHALL NOT require a badge
