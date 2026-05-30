## ADDED Requirements

### Requirement: ValidationContext type defined

The system SHALL define a `ValidationContext` type that captures decisions made during the pre-generation input validation phase. The type SHALL contain:

- `inputCorrection?` — object with `field` (currently only `"productName"`), `from` (original value), `to` (corrected value), `reason` (why the correction was made)
- `allowedConflicts?` — array of conflicts the user explicitly approved, each with `type` (`"product_image_conflict"` or `"product_image_low_confidence"`) and `userAction` (`"user_confirmed_continue"` or `"accepted_suggestion"`)
- `overrides?` — object with optional `productImageCheck?: "user_confirmed_continue"`

`generated_product_mismatch` SHALL NEVER appear in `allowedConflicts`. Even when the user has confirmed an override, if the review detects that the generated image represents a different product, the generation SHALL fail.

#### Scenario: ValidationContext carries input correction

- **WHEN** the input validation corrected the product name from `"neskau"` to `"Nescau"`
- **THEN** `inputCorrection` SHALL contain `{ field: "productName", from: "neskau", to: "Nescau", reason: "O texto na imagem do produto é 'Nescau'" }`

#### Scenario: ValidationContext carries allowed conflicts

- **WHEN** the user accepted a suggestion for a `"product_image_conflict"`
- **THEN** `allowedConflicts` SHALL contain `{ type: "product_image_conflict", userAction: "accepted_suggestion" }`

### Requirement: ImageReviewInput extended with validationContext

The `ImageReviewInput` type used by `ImageReviewService.review()` SHALL be extended with an optional `validationContext?: ValidationContext` field.

The review prompt `campaign-image-reviewer.md` SHALL include the validation context as a new section so the vision model is aware of:
- Any product name correction that was applied (the review SHALL use the corrected name as reference)
- Any conflicts the user has explicitly approved (the review SHALL NOT flag those specific conflicts)

The `productName` passed to `ImageReviewInput` SHALL always be the `effectiveProductName` — the name after any correction from input validation.

#### Scenario: Review input receives effectiveProductName

- **WHEN** input validation corrected the product name
- **THEN** `ImageReviewInput.productName` SHALL contain the corrected name
- **AND** the review SHALL use the corrected name as the ground truth for comparison

#### Scenario: Review prompt includes validation context section

- **WHEN** `validationContext` is provided
- **THEN** the review prompt SHALL include a "Contexto de Validação" section describing corrections and overrides

### Requirement: applyValidationContextToReviewResult() as explicit post-parse step

The system SHALL implement a pure function `applyValidationContextToReviewResult(result: ImageReviewResult, context?: ValidationContext): ImageReviewResult` that is applied AFTER `ImageReviewService.parseResult()`.

The function SHALL operate as follows:
1. If no `context` is provided or the result already `passed`, return the result unchanged
2. If `context.overrides.productImageCheck === "user_confirmed_continue"`, remove ONLY issues with type `"product_image_conflict"` and `"product_image_low_confidence"` — all other issues SHALL remain
3. `generated_product_mismatch` SHALL NEVER be removed, regardless of context
4. After filtering: if any remaining issue has a type listed under "Non-override issues always block" below, `result.passed` SHALL be `false`. Only when no blocking issues remain (or only minor/non-blocking issues remain) MAY `result.passed` become `true`. The existing review severity semantics SHALL be preserved — critical non-override issues SHALL always block, minor non-override issues SHALL respect the existing lifecycle rules

The function SHALL be called in `ImageGenerationService.generateImage()` immediately after `await this.imageReview.review(...)` and before any state machine decision.

#### Scenario: Override removes only product_image_conflict issues

- **WHEN** the review result has issues `[{ type: "product_image_conflict" }, { type: "wrong_price" }, { type: "illegible_text" }]`
- **AND** `context.overrides.productImageCheck === "user_confirmed_continue"`
- **THEN** the returned result SHALL contain only `[{ type: "wrong_price" }, { type: "illegible_text" }]`
- **AND** `product_image_conflict` SHALL be removed

#### Scenario: generated_product_mismatch never filtered

- **WHEN** the review result has `{ type: "generated_product_mismatch" }`
- **AND** any override exists
- **THEN** the issue SHALL remain in the result
- **AND** `passed` SHALL remain `false`

#### Scenario: No context returns result unchanged

- **WHEN** `context` is `undefined`
- **THEN** the result SHALL be returned unchanged
- **AND** no filtering SHALL occur

### Requirement: wrong_product_name uses effective name, no blind filter

The `reviewInput.productName` passed to `ImageReviewService.review()` SHALL always be the `effectiveProductName` — the corrected name from input validation, or the original name if no correction occurred.

The `applyValidationContextToReviewResult()` function SHALL NOT filter `wrong_product_name` issues. If the generated image displays a product name different from `effectiveProductName`, the issue SHALL remain and SHALL block the generation.

#### Scenario: Wrong product name blocks even with correction

- **WHEN** the input validation corrected `"neskau"` → `"Nescau"`
- **AND** the generated image displays `"Skol Beats"`
- **THEN** the review SHALL report `{ type: "wrong_product_name", severity: "critical" }`
- **AND** `applyValidationContextToReviewResult()` SHALL NOT remove this issue
- **AND** generation SHALL fail with `generated_product_mismatch` or equivalent terminal error

### Requirement: Non-override issues always block

The following issue types SHALL never be removed by `applyValidationContextToReviewResult()` regardless of validation context:

- `wrong_price` — displayed price differs from input
- `wrong_store_name` — store name in art differs from identity
- `generated_product_mismatch` — art shows different product
- `illegible_text` — text is unreadable
- `insufficient_image` — image quality is below threshold
- `wrong_cta` — call to action differs from input
- `bad_composition` — layout is broken or confusing
- `invented_badge` — badge/text not in input
- `distorted_product` — product appears deformed
- `empty_review` — model returned no content
- `review_low_confidence` — model cannot assess with confidence

Only `product_image_conflict` and `product_image_low_confidence` MAY be removed when the user has explicitly confirmed an override.

#### Scenario: Wrong price blocks even with override

- **WHEN** the user confirmed an override (`productImageCheck === "user_confirmed_continue"`)
- **AND** the review finds `wrong_price`
- **THEN** `wrong_price` SHALL NOT be removed
- **AND** generation SHALL enter correction cycle or fail
