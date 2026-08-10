## MODIFIED Requirements

### Requirement: Brand inference service

O sistema SHALL prover um `BrandTextOnlyInferenceService` que: carrega o prompt `store-brand-inference.md`, preenche com dados da loja + cores do usuário, chama OpenAI (`response_format: { type: 'json_object' }`, `max_tokens: 2000`), valida o output e retorna `TextOnlyInferenceResult`.

> **Delta F38.1 (D5/D11):** O `BrandTextOnlyInferenceService` passa a expor callback `onCall` com `usage` da chamada de inferência. O fluxo de brand profile passa a registrar eventos de custo — **hoje nenhum evento existe** (nenhuma contabilidade de brand profile). A cada request de geração/realinhamento, um novo `operation_run_id` (semântica `brand_profile`, D1).

#### Scenario: Service returns complete result with all intelligence fields

- **WHEN** o serviço de inferência completa com sucesso
- **THEN** o resultado contém `safe_color_tokens` com `{ primary, secondary, accent, background }`
- **AND** `visual_style`, `visual_tone`, `typography_direction`, `brand_personality`, `campaign_guidelines`, `campaign_brief` presentes
- **AND** `inferred_primary_color` e `inferred_accent_color` presentes
- **AND** `confidence_score` é um número entre 0 e 1

#### Scenario: brand_profile_text registrado com custo

- **WHEN** o text-only inference faz a chamada de IA
- **THEN** um evento `brand_profile_text` é gravado com custo/tokens via callback `onCall` (D11)
- **AND** o evento compartilha o `operation_run_id` do request (D1)

#### Scenario: inferência expõe usage via onCall

- **WHEN** a inferência é chamada com `onCall`
- **THEN** o callback é invocado com `AiCallInfo` (usage, provider, model, durationMs)
- **AND** sem `onCall` o comportamento permanece idêntico (retrocompatível)

#### Scenario: Service enforces timeout via AbortController

- **WHEN** a chamada OpenAI excede `timeoutMs`
- **THEN** o serviço SHALL lançar `BrandTextOnlyInferenceError` com `errorType: 'timeout'`
- **AND** a rota SHALL tratar como falha não-bloqueante (profile `failed`, stores atualizadas)
