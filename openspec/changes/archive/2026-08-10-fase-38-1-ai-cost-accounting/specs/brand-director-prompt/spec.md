## MODIFIED Requirements

### Requirement: Store Brand Director prompt file

O sistema SHALL ter um arquivo de prompt dedicado em `prompts/store-brand-director-with-logo.md` para análise visual de logos de loja com geração de perfil de marca estruturado.

> **Delta F38.1 (D5/D11):** O `BrandDirectorService` passa a expor callback `onCall` com `usage` da chamada vision. O fluxo de brand profile passa a registrar eventos de custo — **hoje nenhum evento existe** (nenhuma contabilidade de brand profile). A cada request de geração/realinhamento, um novo `operation_run_id` (semântica `brand_profile`, D1).

#### Scenario: Prompt file exists

- **WHEN** o projeto é inspecionado
- **THEN** um arquivo existe em `prompts/store-brand-director-with-logo.md`
- **AND** o arquivo contém instruções para análise de logo e geração de perfil

#### Scenario: brand_profile_vision registrado (director com logo)

- **WHEN** o BrandDirector faz a chamada vision de análise do logo
- **THEN** um evento `brand_profile_vision` é gravado com custo/tokens via callback `onCall` (D11)
- **AND** o evento compartilha o `operation_run_id` do request (D1)

#### Scenario: BrandDirector expõe usage via onCall

- **WHEN** a análise do logo é chamada com `onCall`
- **THEN** o callback é invocado com `AiCallInfo` (usage, provider, model, durationMs)
- **AND** sem `onCall` o comportamento permanece idêntico (retrocompatível)

### Requirement: Store Brand Director JSON output schema

O Store Brand Director LLM SHALL retornar JSON estruturado com os campos definidos (logo_colors_detected, safe_color_tokens, visual_style, visual_tone, typography_direction, brand_personality, campaign_guidelines, campaign_brief, confidence_score).

> **Delta F38.1 (D5):** O delivery de brand profile (`brand_profile_with_logo`/`brand_profile_without_logo` — tipos existentes agora usados) é gravado **sem custo/tokens** (anti-dupla-contagem D1/D6), preservando status e `duration_ms`.

#### Scenario: LLM returns valid JSON

- **WHEN** o Store Brand Director responde
- **THEN** a resposta SHALL ser JSON válido no schema definido
- **AND** o sistema SHALL fazer parse e persistir os valores em store_brand_profiles

#### Scenario: LLM returns invalid JSON

- **WHEN** a resposta não é JSON válido
- **THEN** o sistema SHALL registrar o erro no metadata
- **AND** definir o status do brand profile como `failed`

#### Scenario: delivery brand_profile gravado sem custo

- **WHEN** o fluxo de brand profile conclui
- **THEN** um evento `brand_profile_without_logo`/`brand_profile_with_logo` é gravado com status e `duration_ms`
- **AND** custo/tokens ficam NULL (anti-dupla-contagem D1/D6)
- **AND** o custo da entrega = soma dos eventos call-level (`brand_profile_vision`/`brand_profile_text`) via view
