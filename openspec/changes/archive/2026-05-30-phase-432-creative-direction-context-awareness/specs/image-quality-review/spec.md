## ADDED Requirements

### Requirement: ImageReviewInput extended with validationContext

The `ImageReviewInput` interface SHALL be extended with an optional `validationContext?: ValidationContext` field.

When `validationContext` is provided, the system SHALL pass it to the review prompt as contextual information. The review prompt SHALL include a "Contexto de Validação" section informing the model about:
- Any product name correction that was applied (the review SHALL use the corrected name as the ground truth)
- Any conflicts the user explicitly approved (the review SHALL NOT flag those specific conflict types)

#### Scenario: Validation context included in review prompt

- **WHEN** `ImageReviewInput.validationContext` contains an `inputCorrection`
- **THEN** the review prompt SHALL include the correction information
- **AND** the model SHALL use the corrected product name as the reference for comparison

### Requirement: ImageReviewService does NOT filter issues internally

The `ImageReviewService` SHALL parse the model's response into a raw `ImageReviewResult` via `parseResult()` and return it without any context-aware issue filtering.

The service MAY receive `validationContext` only to render the optional "Contexto de Validação" prompt section — informing the vision model about corrections and overrides so it evaluates the image against the right reference data.

The service SHALL NOT perform context-aware issue filtering, mutate review results based on overrides, or make state-machine decisions.

All post-parse alignment SHALL be performed externally by `applyValidationContextToReviewResult()` in `ImageGenerationService`.

#### Scenario: Service returns raw review result

- **WHEN** the vision model returns issues including `product_image_conflict`
- **THEN** `ImageReviewService.review()` SHALL return the issues as-is
- **AND** SHALL NOT remove `product_image_conflict` even if context suggests an override exists

### Requirement: Review prompt includes validation context section

The `campaign-image-reviewer.md` prompt SHALL be updated to include an optional "Contexto de Validação" section that provides the model with information about:

- Corrected product names: `"O nome do produto foi corrigido automaticamente de '{original}' para '{corrigido}' (motivo: {razão}). A revisão deve usar '{corrigido}' como referência."`
- User-confirmed overrides: `"O usuário confirmou que a imagem do produto está correta, mesmo com divergência na pré-validação. A revisão não deve reportar conflito produto × imagem."`

This section SHALL be interpolated before the image analysis instructions.

#### Scenario: Validation context section included in prompt

- **WHEN** `validationContext` is provided to `ImageReviewService`
- **THEN** the review prompt SHALL include the validation context section
- **AND** the model SHALL use the corrected names as ground truth

#### Scenario: No validation context omits section

- **WHEN** `validationContext` is not provided
- **THEN** the review prompt SHALL NOT include the validation context section
- **AND** the prompt SHALL be identical to the pre-4.3.2 version
