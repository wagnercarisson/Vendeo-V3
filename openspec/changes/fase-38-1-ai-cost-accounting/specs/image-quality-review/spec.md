## MODIFIED Requirements

### Requirement: ImageReviewService reviews generated images

O sistema SHALL provide an `ImageReviewService` that inspects every generated campaign image before it is shown to the user. The review runs **after** image generation, as part of the correction lifecycle.

> **Delta F38.1 (D7/D11):** `ImageReviewService.review` passa a aceitar um callback opcional `onCall?: (info: AiCallInfo) => void` que é invocado após cada chamada vision real, com `provider`, `model`, `usage` e `durationMs`. A rota usa esse callback para registrar `campaign_image_review` — a chamada vision (gpt-4o, cara) **não some mais** da contabilidade (furo 4 sanado).

#### Scenario: Generated image passes all checks

- **WHEN** a generated image contains the correct price (for offer) or no price (for exclusive), correct product name, correct store name, legible text, no invented information, acceptable visual quality, and tone coherent with intent
- **THEN** the review SHALL return `passed: true`
- **AND** `failureType` SHALL be `null`
- **AND** the issues array SHALL be empty or contain only minor issues

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
