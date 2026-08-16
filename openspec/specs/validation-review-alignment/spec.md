# Validation & Review Alignment

## Purpose

Defines how pre-generation validation decisions (product name corrections, user-confirmed overrides) are captured in a `ValidationContext`, passed to the image review service so the model evaluates against corrected data, and post-processed via `applyValidationContextToReviewResult()` to filter approved conflicts without masking real issues.

## Requirements

### Requirement: ValidationContext type defined

The system SHALL define a `ValidationContext` type that captures decisions made during the pre-generation input validation phase. The type SHALL contain:

- `inputCorrection?` — object with `field` (currently only `"productName"`), `from` (original value), `to` (corrected value), `reason` (why the correction was made)
- `allowedConflicts?` — array of conflicts the user explicitly approved, each with `type` (`"product_image_conflict"` or `"product_image_low_confidence"`) and `userAction` (`"user_confirmed_continue"` or `"accepted_suggestion"`)
- `overrides?` — object with optional `productImageCheck?: "user_confirmed_continue"`

`generated_product_mismatch` SHALL NEVER appear in `allowedConflicts`. Even when the user has confirmed an override, if the review detects that the generated image represents a different product, the generation SHALL fail.

> **Delta F38.1 (D7/D11):** `InputValidationService.validate` passa a aceitar um callback opcional `onCall?: (info: AiCallInfo) => void` invocado após cada chamada vision real (`chat.completions`), com `provider`, `model`, `usage` e `durationMs`. A rota usa esse callback para registrar `campaign_input_validation` — a chamada vision de validação **não some mais** da contabilidade (furo 4 sanado).

#### Scenario: ValidationContext carries input correction

- **WHEN** the input validation corrected the product name from `"neskau"` to `"Nescau"`
- **THEN** `inputCorrection` SHALL contain `{ field: "productName", from: "neskau", to: "Nescau", reason: "O texto na imagem do produto é 'Nescau'" }`

#### Scenario: ValidationContext carries allowed conflicts

- **WHEN** the user accepted a suggestion for a `"product_image_conflict"`
- **THEN** `allowedConflicts` SHALL contain `{ type: "product_image_conflict", userAction: "accepted_suggestion" }`

#### Scenario: validate expõe usage via onCall

- **WHEN** `validate(name, dataUrl, override?, { onCall })` é chamado
- **THEN** o callback `onCall` é invocado após a chamada vision com `AiCallInfo` (provider, model, usage, durationMs)
- **AND** a rota registra `campaign_input_validation` com custo/tokens (furo 4 sanado)

#### Scenario: validate sem onCall mantém comportamento

- **WHEN** `validate(name, dataUrl)` é chamado sem `onCall`
- **THEN** o comportamento é idêntico ao anterior (callback opcional, retrocompatível)

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
5. **Creative freedom rule:** The director's creative choices SHALL be preserved when price, product name, store name, legibility, and product×image match are all correct. Acceptable visual divergences with sufficient commercial context (e.g., a beverage store selling 51 Ice with correct name on the art) SHALL NOT block generation. However, creative freedom SHALL NOT override: wrong price, wrong product name, wrong store name, illegible text, or strong product×image conflict.

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

The following issue types SHALL never be removed by `applyValidationContextToReviewResult()` regardless of validation context or creative context. Note: both `wrong_product_name` (issue type, triggers correction cycle) and `generated_product_mismatch` (failure type, terminal) exist in the schema and both SHALL block:

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
- `commercial_tone_mismatch` (added by F31.3) — tone contradicts intent or invents commercial condition

**Blocking behavior depends on severity, not on removability.** An issue can be non-removable (protected from override filter) but non-blocking when its severity is `minor`:

| Issue type | Non-removable? | Blocks when critical? | Blocks when minor? |
|-----------|----------------|----------------------|-------------------|
| `wrong_price` | Yes | Yes | N/A (always critical) |
| `commercial_tone_mismatch` | Yes | Yes | No |
| `weak_visual_quality` | Yes | Yes | No |
| `invented_information` | Yes | Yes (specific conditions) | No (generic warnings) |

Only `product_image_conflict` and `product_image_low_confidence` MAY be removed when the user has explicitly confirmed an override.

#### Scenario: Wrong price blocks even with override

- **WHEN** the user confirmed an override (`productImageCheck === "user_confirmed_continue"`)
- **AND** the review finds `wrong_price`
- **THEN** `wrong_price` SHALL NOT be removed
- **AND** generation SHALL enter correction cycle or fail

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

### Requirement: Review prompt clarifies creative freedom boundaries

The `campaign-image-reviewer.md` prompt SHALL be updated to include explicit guidance about creative freedom:
- The director's creative choices SHALL be preserved when essential data (price, product name, store name, legibility) is correct
- Creative freedom SHALL NOT override: wrong price, wrong product name, wrong store name, illegible text, or strong product×image conflict
- Minor visual divergences with sufficient commercial context SHALL NOT block generation

#### Scenario: Review prompt includes creative freedom guidance

- **WHEN** the review prompt is loaded
- **THEN** it SHALL include text describing the boundary between creative freedom and essential data correctness

### Requirement: Validação produto×imagem primary-only (D8)

O sistema SHALL manter `InputValidationService.validate(nome, productImageDataUrl)` (`input-validation-service.ts:40-71`) validando **apenas a imagem principal** (primary) contra o nome digitado — uma chamada vision antes da geração (comportamento atual preservado).

- **Auxiliares NÃO participam** da checagem de conflito/confiança (primary-only na v1).
- O fluxo de 409 (conflict / low-confidence / strong_conflict / override `user_confirmed_continue`) permanece **inalterado**.
- **Extensão futura registrada:** validação multi-imagem (ex.: confirmar variações/combos) quando roles avançadas forem expostas.

#### Scenario: validação usa apenas a primary

- **WHEN** o brief tem primary + 2 auxiliares e o `InputValidationService` valida o nome do produto
- **THEN** apenas a dataUrl da **primary** é enviada à chamada vision
- **AND** as auxiliares não participam da checagem

#### Scenario: fluxo de 409 inalterado

- **WHEN** a primary gera conflito/low-confidence com o nome digitado
- **THEN** a rota responde 409 com `needs_user_action` (comportamento atual preservado — D8)

### Requirement: Review com a imagem principal como referência (D9)

O sistema SHALL fazer `ImageReviewService.review(generatedImage, input)` (`image-review-service.ts:54-63`) receber, **opcionalmente**, a **dataUrl da imagem principal** e enviá-la junto ao prompt `campaign-image-reviewer` (bloco de imagem + texto).

- O revisor SHALL verificar a **fidelidade do produto na arte gerada** — o produto da imagem de referência é o produto da peça.
- **Sem nova variável de prompt do revisor** — a imagem entra como input multimodal; o texto do prompt pode ganhar uma linha fixa "Compare o produto da arte com a imagem de referência".
- **Retrocompatível:** sem primary/sem `productImagesDataUrls` → o revisor se comporta como hoje (nenhuma mudança para o caminho legado).
- Receber **TODAS** as imagens no review fica **deferido** (custo × benefício avaliado quando roles avançadas forem expostas).

#### Scenario: revisor recebe a primary como referência

- **WHEN** o brief tem uma imagem primary (dataUrl)
- **THEN** o `ImageReviewService.review` recebe a dataUrl da primary
- **AND** o prompt `campaign-image-reviewer` recebe o bloco de imagem + a linha "Compare o produto da arte com a imagem de referência"

#### Scenario: sem primary o revisor mantém comportamento atual

- **WHEN** não há imagem primary disponível (caminho legado sem referência)
- **THEN** o revisor não recebe imagem de referência
- **AND** o comportamento é idêntico ao atual (retrocompatível — D9)
