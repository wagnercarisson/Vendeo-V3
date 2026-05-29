## ADDED Requirements

### Requirement: buildPromptVariables includes creative direction context

The `ImageGenerationService.buildPromptVariables()` method SHALL be extended to accept an optional `inferredCategory?: string` parameter and return the following new variables:

- `creativePersona` — segment-based persona string
- `inferredCategory` — product category (inferred or store segment fallback)
- `hasCategoryConflict` — `"sim"` or `"nao"` based on `isSameCategory()` comparison
- `categoryConflictDirective` — conditional directive string (empty when no conflict)
- `commercialRepertoire` — output of `buildCommercialRepertoire()`
- `inputValidationSummary` — output of `buildValidationSummary()`

All existing variables SHALL be preserved unchanged.

#### Scenario: New variables present in buildPromptVariables output

- **WHEN** `buildPromptVariables()` is called with `inferredCategory: "bebidas-energeticos"`
- **THEN** the returned record SHALL include `creativePersona`, `inferredCategory`, `hasCategoryConflict`, `categoryConflictDirective`, `commercialRepertoire`, and `inputValidationSummary`

### Requirement: buildCommercialRepertoire extracts actionable arguments

The system SHALL implement `ImageGenerationService.buildCommercialRepertoire(body: GenerateImageRequest): string` that analyzes the following fields for commercially actionable content:

- `additionalDetails` — free-form text
- `availabilityNotes` — availability information (e.g., "poucas unidades", "cores variadas")
- `validity` — promotion validity period
- `campaignDetails` — additional campaign context

The method SHALL return a single PT-BR string with extracted arguments formatted as visual repertoire. When no actionable content is found, the method SHALL return an empty string.

#### Scenario: Availability notes become commercial repertoire

- **WHEN** `availabilityNotes` is `"vários sabores disponíveis"`
- **THEN** the returned string SHALL contain `"Disponível em vários sabores"` or equivalent PT-BR text

### Requirement: buildValidationSummary generates sanitized summary

The system SHALL implement `ImageGenerationService.buildValidationSummary(body: GenerateImageRequest, effectiveProductName: string): string` that generates a sanitized summary of the input validation phase.

The summary SHALL include:
- Whether the product name was corrected (original → corrected, with reason)
- Whether the user confirmed an override for product-image conflict

The summary SHALL be in PT-BR and SHALL NOT expose raw model output, API keys, or internal error details.

#### Scenario: Validation summary includes correction info

- **WHEN** the product name was corrected from `"neskau"` to `"Nescau"` with reason `"O texto na imagem é 'Nescau'"`
- **THEN** the summary SHALL include `"Nome corrigido automaticamente de 'neskau' para 'Nescau'"`

### Requirement: assemblePrompt uses evolved prompt with new sections

The `ImageGenerationService.assemblePrompt()` method SHALL load the `campaign-image-director.md` prompt and interpolate all existing plus new creative direction variables. The evolved prompt SHALL include the new sections for creative persona, category context, commercial repertoire, and validation summary.

#### Scenario: Evolved prompt includes creative direction

- **WHEN** `assemblePrompt()` is called with variables that include creative direction context
- **THEN** the returned prompt string SHALL contain the interpolated creative direction sections

### Requirement: Pipeline emits sanitized technical detail events

The `ImageGenerationService` SHALL emit `detail` (sanitized technical info) in `GenerationPhaseEvent` at the following points:

| Phase | When | Detail content |
|-------|------|----------------|
| `input_validation` | After validation completes | `"classificação: {classification}, nome corrigido: '{from}' → '{to}'"` (if applicable) |
| `prompt_assembly` | After prompt assembly | `"briefing com persona de {segment}, categoria inferida: {category}"` |
| `image_generation` | At start of each attempt | `"tentativa {n}/{max}, modelo: {model}, tempo decorrido: {t}s"` |
| `quality_review` | After review completes | `"issues: {n} ({critical} críticas, {minor} menores), failureType: {type}"` |
| `done` | On completion | `"geração concluída em {t}s, {attempts} tentativas, {corrections} correções"` |

The pipeline SHALL emit `detail` strings that are safe-by-construction — containing only summarized technical metadata (phase name, classification, attempt count, model name, elapsed time). `GenerationProgress` SHALL continue applying `sanitizeDetail()` before display as a defense-in-depth measure.

#### Scenario: detail emitted for prompt_assembly phase

- **WHEN** the prompt assembly phase completes
- **THEN** the phase event SHALL include `detail` with the segment persona and inferred category
- **AND** the `detail` SHALL NOT contain raw model output or API keys

#### Scenario: detail emitted for each generation attempt

- **WHEN** a retry attempt begins during `image_generation`
- **THEN** the phase event SHALL include `detail` with the attempt number, model name, and elapsed time
- **AND** the `detail` SHALL NOT include estimated budget remaining unless the pipeline has reliable timeout tracking

### Requirement: validationContext passed to ImageReviewService

The `ImageGenerationService` SHALL construct a `ValidationContext` from the input validation results and pass it to `ImageReviewService` via the extended `ImageReviewInput`.

The `ValidationContext` SHALL include:
- `inputCorrection` — when the product name was corrected by validation
- `allowedConflicts` — when the user approved specific conflicts
- `overrides` — when the user confirmed "continue anyway"

#### Scenario: Validation context flows to review

- **WHEN** input validation corrected the product name
- **THEN** `validationContext.inputCorrection` SHALL be populated
- **AND** `ImageReviewInput.validationContext` SHALL contain the context
- **AND** the review SHALL use `effectiveProductName` as reference

### Requirement: applyValidationContextToReviewResult called after review

The `ImageGenerationService.generateImage()` method SHALL call `applyValidationContextToReviewResult()` immediately after `await this.imageReview.review(...)` returns, before evaluating `reviewResult.passed` and deciding the next state machine transition.

```typescript
reviewResult = await this.imageReview.review(imageDataUrl, reviewInput);
reviewResult = applyValidationContextToReviewResult(reviewResult, validationContext);
```

#### Scenario: Alignment applied before state machine decision

- **WHEN** the review completes with issues that include user-approved conflicts
- **THEN** `applyValidationContextToReviewResult()` SHALL remove only the approved conflict issues
- **AND** the state machine SHALL evaluate the filtered result
