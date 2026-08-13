# Image Quality Review

## Purpose

Defines the post-generation vision-based quality review service, its structured result types including `failureType` classification, and how the review drives the correction lifecycle in `ImageGenerationService`.

> Modified by `fase-39-brief-estruturado-campanha` (D9/D11): o `ImageReviewInput` passa a ser **montado a partir do domínio estruturado** (`CampaignBrief`), incluindo `legalNotice` e `validity`. `legalNotice.text` entra no review **apenas quando** `enabled === true`; `validity.displayText` entra quando habilitada. O comportamento de revisão em si não muda.

## Requirements

### Requirement: ImageReviewService reviews generated images

The system SHALL provide an `ImageReviewService` that inspects every generated campaign image before it is shown to the user. The review runs **after** image generation, as part of the correction lifecycle.

The `ImageReviewService.review` SHALL accept an optional `onCall?: (info: AiCallInfo) => void` callback that is invoked after each real vision call, with `provider`, `model`, `usage`, and `durationMs`. The API route SHALL use this callback to record `campaign_image_review` — the vision call (e.g., gpt-4o) SHALL NOT be lost from cost accounting.

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

#### Scenario: Only minor issues pass through

- **WHEN** the review finds only minor issues (e.g., `commercial_tone_mismatch` minor, `weak_visual_quality` minor)
- **AND** no critical issues exist
- **AND** `failureType` is `null`
- **THEN** the image SHALL be considered passing
- **AND** minor issues MAY be logged for diagnostics

#### Scenario: review expõe usage via onCall

- **WHEN** `review(dataUrl, input, { onCall })` é chamado
- **THEN** o callback `onCall` é invocado após a chamada vision com `AiCallInfo` (provider, model, usage, durationMs)
- **AND** a rota registra `campaign_image_review` com custo/tokens (furo 4 sanado)

#### Scenario: review sem onCall mantém comportamento

- **WHEN** `review(dataUrl, input)` é chamado sem `onCall`
- **THEN** o comportamento é idêntico ao anterior (callback opcional, retrocompatível)

#### Scenario: Falha na revisão ainda registra custo

- **WHEN** a revisão falha (`passed: false`)
- **THEN** o evento `campaign_image_review` é gravado com `status: failed` e o custo dos tokens gastos (D5/D7)

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

### Requirement: ImageReviewInput extended with validationContext

The `ImageReviewInput` interface SHALL be extended with an optional `validationContext?: ValidationContext` field.

When `validationContext` is provided, the system SHALL pass it to the review prompt as contextual information. The review prompt SHALL include a "Contexto de Validação" section informing the model about:
- Any product name correction that was applied (the review SHALL use the corrected name as the ground truth)
- Any conflicts the user explicitly approved (the review SHALL NOT flag those specific conflict types)

#### Scenario: Validation context included in review prompt

- **WHEN** `ImageReviewInput.validationContext` contains an `inputCorrection`
- **THEN** the review prompt SHALL include the correction information
- **AND** the model SHALL use the corrected product name as the reference for comparison

### Requirement: ImageReviewInput extended with campaignIntent and preserveImageContext

The `ImageReviewInput` interface SHALL be extended with:
- `campaignIntent?: CampaignIntent` — default `"offer"` for backward compatibility (lido de `brief.commercial.intent`)

> Modified by `fase-39-brief-estruturado-campanha` (D11): o `ImageReviewInput` passa a ser montado a partir do domínio estruturado `CampaignBrief` (`brief.product`/`brief.commercial`/`brief.creativeContext`), incluindo `legalNotice` e `validity` (D9/D8).
- `preserveImageContext?: boolean` — indicates whether the reviewer should allow contextual background (lido de `brief.creativeContext`)
- `badgeText?: string` — made optional (was required)
- `discountedPrice?: string` — made optional (was required)
- `originalPrice?: string` — remains optional
- `legalNoticeText?: string` — aviso legal a verificar na arte; presente **apenas quando** `brief.commercial.legalNotice?.enabled === true` (D9)
- `validityText?: string` — texto de validade a verificar; presente **apenas quando** `brief.commercial.validity?.enabled === true` (D8)

The `validationContext?: ValidationContext` field SHALL remain as previously defined.

#### Scenario: ImageReviewInput with campaignIntent exclusive

- **WHEN** `ImageReviewInput` is constructed with `{ campaignIntent: "exclusive" }`
- **THEN** `discountedPrice` MAY be omitted
- **AND** the review SHALL NOT expect a price on the image
- **AND** `badgeText` MAY be omitted
- **AND** the review SHALL NOT require a badge

#### Scenario: revisor recebe legalNotice quando habilitado

- **WHEN** o `ImageReviewInput` é montado de um brief com `commercial.legalNotice = { enabled: true, text: "Imagem meramente ilustrativa" }`
- **THEN** `legalNoticeText` contém o texto do aviso (D9)

#### Scenario: revisor NÃO recebe legalNotice quando desabilitado

- **WHEN** o `ImageReviewInput` é montado de um brief com `legalNotice.enabled === false` (ou ausente)
- **THEN** `legalNoticeText` está ausente — o texto obrigatório não entra na revisão (D9)

#### Scenario: revisor recebe validity quando habilitada

- **WHEN** o `ImageReviewInput` é montado de um brief com `commercial.validity = { enabled: true, displayText: "válida até 30/09" }`
- **THEN** `validityText` contém `"válida até 30/09"` (D8)

### Requirement: ImageReviewInput montado do domínio (campaign-brief)

> Added by `fase-39-brief-estruturado-campanha`.

O sistema SHALL montar o `ImageReviewInput` a partir do domínio estruturado `CampaignBrief` (D11), incluindo:

- `productName` (de `brief.product.name`), `storeName` (do contexto resolvido), `campaignIntent` (de `brief.commercial.intent`), preços (de `brief.commercial.*`), `campaignDetails`/`availabilityNotes` (de `brief.commercial.*`)
- `legalNoticeText` (apenas quando `enabled === true` — D9) e `validityText` (apenas quando `enabled === true` — D8)
- `preserveImageContext` (de `brief.creativeContext`)

A saída resultante SHALL ser **equivalente** à montada pelo fluxo flat atual para o mesmo input (regressão preservada — D11).

#### Scenario: revisor montado do domínio mantém campos essenciais

- **WHEN** o `ImageReviewInput` é montado de um `CampaignBrief` estruturado
- **THEN** contém `productName`, `storeName`, `campaignIntent`, preços e `campaignDetails` — equivalentes ao fluxo flat atual (D11)

#### Scenario: revisor recebe dados equivalentes para o mesmo input

- **WHEN** o mesmo payload flat de hoje é convertido para `CampaignBrief` e usado na montagem do review
- **THEN** o `ImageReviewInput` resultante é equivalente ao do fluxo flat atual (D11 — regressão preservada)

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
