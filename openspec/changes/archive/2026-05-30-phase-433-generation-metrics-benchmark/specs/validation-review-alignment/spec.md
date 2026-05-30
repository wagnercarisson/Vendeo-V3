## MODIFIED Requirements

### Requirement: applyValidationContextToReviewResult() as explicit post-parse step

**Modification:** Creative freedom SHALL be preserved when essential data is correct. The function SHALL NOT override blocking issues for wrong price, wrong product name, wrong store name, illegible text, or strong product×image conflict — even when creative context appears valid.

The system SHALL implement a pure function `applyValidationContextToReviewResult(result: ImageReviewResult, context?: ValidationContext): ImageReviewResult` that is applied AFTER `ImageReviewService.parseResult()`.

The function SHALL operate as follows:
1. If no `context` is provided or the result already `passed`, return the result unchanged
2. If `context.overrides.productImageCheck === "user_confirmed_continue"`, remove ONLY issues with type `"product_image_conflict"` and `"product_image_low_confidence"` — all other issues SHALL remain
3. `generated_product_mismatch` SHALL NEVER be removed, regardless of context
4. After filtering: if any remaining issue has a type listed under "Non-override issues always block" below, `result.passed` SHALL be `false`. Only when no blocking issues remain (or only minor/non-blocking issues remain) MAY `result.passed` become `true`. The existing review severity semantics SHALL be preserved — critical non-override issues SHALL always block, minor non-override issues SHALL respect the existing lifecycle rules
5. **Creative freedom rule:** The director's creative choices SHALL be preserved when price, product name, store name, legibility, and product×image match are all correct. Acceptable visual divergences with sufficient commercial context (e.g., a beverage store selling 51 Ice with correct name on the art) SHALL NOT block generation. However, creative freedom SHALL NOT override: wrong price, wrong product name, wrong store name, illegible text, or strong product×image conflict.

The function SHALL be called in `ImageGenerationService.generateImage()` immediately after `await this.imageReview.review(...)` and before any state machine decision.

#### Scenario: Creative freedom preserves acceptable divergence

- **WHEN** the store is `"alimentacao-bebidas"` selling `"51 Ice"`
- **AND** the art displays the correct product name, price, and store name
- **AND** the review reports a minor visual divergence with sufficient commercial context
- **THEN** the divergence SHALL NOT block generation
- **AND** `result.passed` SHALL remain `true`

#### Scenario: Creative freedom does not override wrong price

- **WHEN** the review finds `wrong_price` with severity `critical`
- **THEN** `wrong_price` SHALL NOT be removed
- **AND** generation SHALL enter correction cycle or fail
- **AND** creative context SHALL NOT override this

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

### Requirement: Non-override issues always block

**Modification:** Added clarification that creative freedom rules do not override the blocking list. The following issue types SHALL never be removed by `applyValidationContextToReviewResult()` regardless of validation context or creative context. Note: both `wrong_product_name` (issue type, triggers correction cycle) and `generated_product_mismatch` (failure type, terminal) exist in the schema and both SHALL block:

- `wrong_price` — displayed price differs from input
- `wrong_store_name` — store name in art differs from identity
- `wrong_product_name` — generated art shows product name different from effectiveProductName (non-terminal, triggers correction)
- `generated_product_mismatch` — art shows a completely different product (terminal, fails immediately)
- `illegible_text` — text is unreadable
- `insufficient_image` — image quality is below threshold
- `wrong_cta` — call to action differs from input
- `bad_composition` — layout is broken or confusing
- `invented_badge` — badge/text not in input
- `distorted_product` — product appears deformed
- `empty_review` — model returned no content
- `review_low_confidence` — model cannot assess with confidence

Only `product_image_conflict` and `product_image_low_confidence` MAY be removed when the user has explicitly confirmed an override.

#### Scenario: Wrong price blocks even with creative context

- **WHEN** the user confirmed an override (`productImageCheck === "user_confirmed_continue"`)
- **AND** the review finds `wrong_price`
- **THEN** `wrong_price` SHALL NOT be removed
- **AND** generation SHALL enter correction cycle or fail
- **AND** creative context SHALL NOT override this

## ADDED Requirements

### Requirement: Review prompt clarifies creative freedom boundaries

The `campaign-image-reviewer.md` prompt SHALL be updated to include explicit guidance about creative freedom:
- The director's creative choices SHALL be preserved when essential data (price, product name, store name, legibility) is correct
- Creative freedom SHALL NOT override: wrong price, wrong product name, wrong store name, illegible text, or strong product×image conflict
- Minor visual divergences with sufficient commercial context SHALL NOT block generation

#### Scenario: Review prompt includes creative freedom guidance

- **WHEN** the review prompt is loaded
- **THEN** it SHALL include text describing the boundary between creative freedom and essential data correctness
