> **Purpose**: This spec defines the automatic AI-based quality review of generated campaign images after generation. The review detects errors in price, product name, store name, legibility, visual quality, and invented information before the image reaches the user preview.

## Requirements

### Requirement: ImageReviewService reviews generated images

The system SHALL provide an `ImageReviewService` that inspects every generated campaign image before it is shown to the user. The review runs **after** image generation, as part of the correction lifecycle.

The service SHALL use a configured OpenAI vision-capable text model (initial default may be GPT-4o or equivalent) because it needs to analyze the visual content of the generated image.

The service SHALL return a structured review result with:
- `passed` — boolean
- `issues` — array of detected issues, each with:
  - `type` — the category of issue
  - `severity` — `"critical" | "minor"`
  - `description` — human-readable explanation

#### Scenario: Generated image passes all checks

- **WHEN** a generated image contains the correct price, correct product name, correct store name, legible text, no invented information, and acceptable visual quality
- **THEN** the review SHALL return `passed: true`
- **AND** the issues array SHALL be empty

#### Scenario: Wrong price detected

- **WHEN** the generated image displays a price different from what was provided in the campaign input
- **THEN** the review SHALL return an issue with type `wrong_price`
- **AND** severity SHALL be `critical`

#### Scenario: Wrong product name detected

- **WHEN** the generated image displays a product name different from the campaign input
- **THEN** the review SHALL return an issue with type `wrong_product_name`
- **AND** severity SHALL be `critical`

#### Scenario: Wrong store name detected

- **WHEN** the generated image displays a store name different from the store identity
- **THEN** the review SHALL return an issue with type `wrong_store_name`
- **AND** severity SHALL be `critical`

#### Scenario: Illegible text detected

- **WHEN** the generated image contains text that is unreadable, distorted, or visually corrupted
- **THEN** the review SHALL return an issue with type `illegible_text`
- **AND** severity SHALL be `critical`

#### Scenario: Invented commercial condition detected as critical

- **WHEN** the generated image contains a specific commercial condition not provided in the campaign input (e.g., "12x sem juros", "10% desconto", "frete grátis", "garantia de 1 ano", "consulte estoque", prazo, parcelamento, entrega, condições técnicas/médicas/de resultado)
- **THEN** the review SHALL return an issue with type `invented_information`
- **AND** severity SHALL be `critical`

#### Scenario: Generic disclaimer flagged as minor

- **WHEN** the generated image contains a generic, non-committal phrase like "consulte condições" or "sujeito a disponibilidade" that does not assert a specific factual claim
- **THEN** the review SHALL return an issue with type `invented_information`
- **AND** severity SHALL be `minor`

#### Scenario: Deformed product detected

- **WHEN** the product image in the generated output appears distorted, stretched, or unrecognizable
- **THEN** the review SHALL return an issue with type `deformed_product`
- **AND** severity SHALL be `critical`

#### Scenario: Amateur visual quality flagged as critical

- **WHEN** the generated image has amateur-level visual quality that is below minimum publishable standard (poor composition, unappealing design, low resolution artifacts)
- **THEN** the review SHALL return an issue with type `weak_visual_quality`
- **AND** severity SHALL be `critical`

#### Scenario: Minor visual issues pass as minor

- **WHEN** the generated image has minor aesthetic issues but is still publishable (small imperfections, slightly off alignment)
- **THEN** the review SHALL return an issue with type `weak_visual_quality`
- **AND** severity SHALL be `minor`

### Requirement: Review drives correction lifecycle

The review result SHALL drive the correction state machine in `ImageGenerationService`. Critical issues trigger correction or regeneration. Minor issues may be reported without blocking delivery.

#### Scenario: Critical issue triggers correction

- **WHEN** the review finds any critical issue
- **AND** retries remain in the lifecycle
- **THEN** a correction or regeneration SHALL be attempted

#### Scenario: Only minor issues pass through

- **WHEN** the review finds only minor issues (e.g., weak visual quality)
- **AND** no critical issues exist
- **THEN** the image SHALL be considered passing
- **AND** minor issues MAY be logged for diagnostics

### Requirement: No sensitive data in review

The system SHALL ensure that sensitive or unverifiable information mentioned by the user (e.g., "cores variadas", "consulte prazo", parcelamento, estoque, garantia, claims técnicos/médicos) is NOT represented as factual detail in the review output. If such data appears, the review SHALL flag it:

- Specific commercial conditions (parcelamento, desconto, frete, garantia, prazo, estoque, claims de resultado) → `critical`
- Generic non-committal phrases ("consulte condições", "sujeito a disponibilidade") → `minor`

#### Scenario: Specific invented commercial condition flagged as critical

- **WHEN** the generated image contains "12x sem juros" or "garantia de 1 ano" that was not explicitly provided in the campaign input
- **THEN** the review SHALL flag it as `invented_information` with `critical` severity

#### Scenario: Generic unverifiable phrase flagged as minor

- **WHEN** the generated image contains "consulte condições" or "sujeito a disponibilidade" that was not explicitly provided in the campaign input
- **THEN** the review SHALL flag it as `invented_information` with `minor` severity
