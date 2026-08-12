## MODIFIED Requirements

### Requirement: Brand profiler execution

O brand profiler SHALL executar inline após o lojista aprovar a assinatura visual: VS → active, `logo_status` → generated, profiler invocado, brand profile persistido (`source: without_logo`, `status: synced` ou `failed`).

> **Delta F38.1 (D5/D11):** O `BrandProfilerWithoutLogoService` passa a expor callback `onCall` em `callVision`/`callVisionFull` (usage do `chat.completions`). O fluxo de brand profile passa a registrar eventos de custo — **hoje nenhum evento existe** (nenhuma contabilidade de brand profile). A cada request de geração/realinhamento, um novo `operation_run_id` (semântica `brand_profile`, D1).

#### Scenario: Reuse mode returns existing profile (unchanged)

- **WHEN** o profiler é invocado com mode:'reuse'
- **AND** existe um profile existente para o `visual_signature_id`
- **THEN** o profile existente SHALL ser retornado
- **AND** nenhuma inferência nova SHALL ser feita

#### Scenario: brand_profile_vision registrado com custo

- **WHEN** o profiler/director faz chamada vision (`callVision`/`callVisionFull`)
- **THEN** um evento `brand_profile_vision` é gravado com custo/tokens via callback `onCall` (D11)
- **AND** o evento compartilha o `operation_run_id` do request (D1)

#### Scenario: callVision expõe usage via onCall

- **WHEN** `callVision`/`callVisionFull` é chamado com `onCall`
- **THEN** o callback é invocado com `AiCallInfo` (usage do `chat.completions`, provider, model, durationMs)
- **AND** sem `onCall` o comportamento permanece idêntico (retrocompatível)

### Requirement: Presence validation flow

Quando `intendedPalette` é não-nulo, o profiler SHALL rodar `ColorProbe.probeColors()` e classificar presença por ∆E (confirmed ≤ 18, ambiguous 18–25, not_confirmed > 25).

> **Delta F38.1 (D1):** Realinhamento (mode:'regenerate' via `POST /realign`) gera um **novo** `operation_run_id` (cada request de geração/realinhamento é um run — D1).

#### Scenario: All colors confirmed — semantic analysis only

- **WHEN** cada cor intencional tem ∆E ≤ 18 contra um cluster de probe não-artefato
- **THEN** `global_status` SHALL ser `'all_confirmed'`
- **AND** a visão SHALL ser chamada apenas para análise semântica
- **AND** `safe_color_tokens` SHALL igualar `intendedToResolved(intendedPalette, intendedPalette.support)`

#### Scenario: Modo regenerate gera novo operation_run_id

- **WHEN** o fluxo de realinhamento (`mode: regenerate`) executa
- **THEN** os eventos usam um **novo** `operation_run_id` (cada request de geração/realinhamento é um run — D1)
