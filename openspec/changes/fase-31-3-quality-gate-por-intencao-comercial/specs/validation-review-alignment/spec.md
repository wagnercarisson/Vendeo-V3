## MODIFIED Requirements

### Requirement: Non-override issues are never removed by override

The following issue types SHALL never be removed by `applyValidationContextToReviewResult()` regardless of validation context or creative context. "Never removed" is a property of the function filter — distinct from "always blocks generation":

- `wrong_price`
- `wrong_store_name`
- `wrong_product_name`
- `generated_product_mismatch`
- `illegible_text`
- `insufficient_image`
- `wrong_cta`
- `bad_composition`
- `invented_badge`
- `distorted_product`
- `empty_review`
- `review_low_confidence`
- `commercial_tone_mismatch` (added by F31.3)

Only `product_image_conflict` and `product_image_low_confidence` MAY be removed when the user has explicitly confirmed an override.

**Blocking behavior depends on severity, not on removability.** An issue can be non-removable (protected from override filter) but non-blocking when its severity is `minor`:

| Issue type | Non-removable? | Blocks when critical? | Blocks when minor? |
|-----------|----------------|----------------------|-------------------|
| `wrong_price` | Yes | Yes | N/A (always critical) |
| `commercial_tone_mismatch` | Yes | Yes | No |
| `weak_visual_quality` | Yes | Yes | No |
| `invented_information` | Yes | Yes (specific conditions) | No (generic warnings) |

The existing review severity semantics SHALL be preserved — critical issues block, minor issues do not. `commercial_tone_mismatch` follows this same rule.

#### Scenario: commercial_tone_mismatch critical is non-removable and blocks

- **WHEN** the user confirmed an override (`productImageCheck === "user_confirmed_continue"`)
- **AND** the review finds `commercial_tone_mismatch` with severity `critical`
- **THEN** `commercial_tone_mismatch` SHALL NOT be removed by the override filter
- **AND** generation SHALL enter correction cycle or fail

#### Scenario: commercial_tone_mismatch minor does not block

- **WHEN** `applyValidationContextToReviewResult` is called with a result containing `commercial_tone_mismatch` severity `minor`
- **AND** no critical issues remain
- **THEN** `result.passed` MAY become `true`
- **AND** the image SHALL be considered passing

#### Scenario: commercial_tone_mismatch minor is still non-removable

- **WHEN** `applyValidationContextToReviewResult` is called with `commercial_tone_mismatch` severity `minor`
- **AND** an override is present
- **THEN** the issue SHALL NOT be removed from the issues array
- **AND** it SHALL remain for logging/diagnostics
- **AND** it SHALL NOT affect `passed`
