# Validation & Review Alignment

## Purpose

Delta F43 (D5): `InputValidationService` e `ValidationContext` passam a aceitar o novo literal `brief_review_confirmed` do override produto×imagem (revisão humana explícita do brief, semântica distinta de `user_confirmed_continue`); `ImageGenerationService` Phase 1 (`input_validation`) passa a emitir a fase com **obrigatoriamente** `status: "skipped"` (detail opcional "Brief confirmado pelo usuário") quando o override pula a IA — nunca `running → complete` nem `complete` com detail. Capacidade `InputValidationService` intacta e reativável pela flag administrativa `force_brief_vision_check` (leitura no backend de geração).

## MODIFIED Requirements

### Requirement: ValidationContext type defined

O sistema SHALL definir um tipo `ValidationContext` que captura decisões da validação de entrada pré-geração, incluindo `overrides.productImageCheck` que SHALL aceitar os literais `"user_confirmed_continue"` e `"brief_review_confirmed"`.

> Delta F43 (D5): `overrides.productImageCheck` aceita o novo literal `brief_review_confirmed` (revisão humana explícita do brief) além de `user_confirmed_continue` (409 + insistiu). Comportamento de `applyValidationContextToReviewResult` inalterado — apenas `product_image_conflict`/`product_image_low_confidence` são filtráveis com override.

O sistema SHALL definir um tipo `ValidationContext` que captura decisões tomadas durante a fase de validação de entrada pré-geração. O tipo SHALL conter:

- `inputCorrection?` — objeto com `field` (atualmente apenas `"productName"`), `from` (valor original), `to` (valor corrigido), `reason` (por que a correção foi feita)
- `allowedConflicts?` — array de conflitos que o usuário aprovou explicitamente, cada um com `type` (`"product_image_conflict"` ou `"product_image_low_confidence"`) e `userAction` (`"user_confirmed_continue"` ou `"accepted_suggestion"`)
- `overrides?` — objeto com `productImageCheck?: "user_confirmed_continue" | "brief_review_confirmed"`

`generated_product_mismatch` SHALL NUNCA aparecer em `allowedConflicts`. Mesmo quando o usuário confirma um override, se a revisão detectar que a imagem gerada representa um produto diferente, a geração SHALL falhar.

> **Delta F38.1 (D7/D11):** `InputValidationService.validate` passa a aceitar um callback opcional `onCall?: (info: AiCallInfo) => void` invocado após cada chamada vision real (`chat.completions`), com `provider`, `model`, `usage` e `durationMs`. A rota usa esse callback para registrar `campaign_input_validation` — a chamada vision de validação **não some mais** da contabilidade (furo 4 sanado).

> **Delta F43 (D5):** `InputValidationService.validate` aceita o override com o novo literal — `override?: { productImageCheck?: "user_confirmed_continue" | "brief_review_confirmed" }` — e **já pula a chamada quando o override é truthy** (`:47-49`), sem mudança de lógica. Nenhuma chamada vision é feita, nenhum `onCall`/`campaign_input_validation` é emitido nesse caminho.

#### Scenario: ValidationContext carries input correction

- **WHEN** a validação de entrada corrigiu o nome do produto de `"neskau"` para `"Nescau"`
- **THEN** `inputCorrection` SHALL conter `{ field: "productName", from: "neskau", to: "Nescau", reason: "O texto na imagem do produto é 'Nescau'" }`

#### Scenario: ValidationContext carries allowed conflicts

- **WHEN** o usuário aceitou uma sugestão para um `"product_image_conflict"`
- **THEN** `allowedConflicts` SHALL conter `{ type: "product_image_conflict", userAction: "accepted_suggestion" }`

#### Scenario: validate expõe usage via onCall

- **WHEN** `validate(name, dataUrl, override?, { onCall })` é chamado
- **THEN** o callback `onCall` é invocado após a chamada vision com `AiCallInfo` (provider, model, usage, durationMs)
- **AND** a rota registra `campaign_input_validation` com custo/tokens (furo 4 sanado)

#### Scenario: validate sem onCall mantém comportamento

- **WHEN** `validate(name, dataUrl)` é chamado sem `onCall`
- **THEN** o comportamento é idêntico ao anterior (callback opcional, retrocompatível)

#### Scenario: validate pula com override brief_review_confirmed (F43 D5)

- **WHEN** `validate(name, dataUrl, { productImageCheck: "brief_review_confirmed" }, { onCall })` é chamado
- **THEN** a validação retorna `{ classification: "match", confidence: 1.0 }` sem chamar a IA de visão
- **AND** `onCall` **não** é invocado (nenhuma chamada real — nenhum `campaign_input_validation`)

#### Scenario: validate pula com override user_confirmed_continue (F43 D5)

- **WHEN** `validate(name, dataUrl, { productImageCheck: "user_confirmed_continue" }, { onCall })` é chamado
- **THEN** a validação retorna `{ classification: "match", confidence: 1.0 }` sem chamar a IA de visão (comportamento atual preservado)
- **AND** `onCall` **não** é invocado

## ADDED Requirements

### Requirement: Fase input_validation emitida como skipped quando override pula (F43 D5)

O `ImageGenerationService.generateImage` (`image-generation-service.ts:162-277`, Phase 1 `input_validation`) SHALL **NÃO** emitir a fase como `running → complete` quando o override (`brief_review_confirmed` OU `user_confirmed_continue`) pular a chamada de IA — hoje `emitHuman("input_validation")` (`:163`) e `emitComplete`/detail (`:272-277`) rodam incondicionalmente.

- Quando o override estiver presente (pula a IA), o serviço SHALL emitir a fase `input_validation` com **obrigatoriamente** `status: "skipped"` (precedente `emitSkipped` em `:141`).
- O detail/mensagem é **opcional** e SHALL usar "Brief confirmado pelo usuário" ou "Validação dispensada" — **nunca** `status: "complete"` com detail (isso reintroduziria a fase falsa de "Validação concluída" sem chamada de IA).
- Aplica-se igualmente a `brief_review_confirmed` e `user_confirmed_continue`.
- Nenhum evento de métrica (`emitMetricsEvent("input_validation", ...)`) SHALL ser emitido sem chamada real (já garantido por `validationCallMade`, `:188-190`).

#### Scenario: Override brief_review_confirmed emite skipped

- **WHEN** o `context.campaignInput.inputValidationOverride.productImageCheck` é `"brief_review_confirmed"`
- **THEN** o Phase 1 do serviço NÃO chama a IA de visão
- **AND** a fase `input_validation` é emitida com **obrigatoriamente** `status: "skipped"` (detail opcional "Brief confirmado pelo usuário")
- **AND** nenhuma fase `complete` falsa é emitida
- **AND** nenhum evento `input_validation` de métrica é emitido

#### Scenario: Override user_confirmed_continue emite skipped

- **WHEN** o `context.campaignInput.inputValidationOverride.productImageCheck` é `"user_confirmed_continue"`
- **THEN** o Phase 1 do serviço NÃO chama a IA de visão
- **AND** a fase `input_validation` é emitida com **obrigatoriamente** `status: "skipped"` (detail opcional "Validação dispensada")
- **AND** nenhuma fase `complete` falsa é emitida

#### Scenario: Sem override a fase input_validation é normal

- **WHEN** o body não carrega `inputValidationOverride`
- **THEN** o Phase 1 do serviço chama a IA de visão (rede de segurança)
- **AND** a fase `input_validation` é emitida normalmente (`running` → `complete` com detail) e um evento de métrica é emitido (comportamento atual)