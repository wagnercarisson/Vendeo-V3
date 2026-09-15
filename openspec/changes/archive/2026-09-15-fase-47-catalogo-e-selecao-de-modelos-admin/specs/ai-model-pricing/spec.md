# AI Model Pricing (delta F47)

> Delta da capability existente `ai-model-pricing` pela `fase-47-catalogo-e-selecao-de-modelos-admin`. Adiciona a validação de consistência, **ciente da capacidade**, entre o catálogo de modelos selecionáveis e as linhas de preço vigentes.

## ADDED Requirements

### Requirement: Modelos selecionáveis têm o pricing exigido pela capacidade

Ao listar o catálogo para seleção, o sistema SHALL verificar o pricing **exigido pela capacidade** de cada modelo e SHALL sinalizar explicitamente o que estiver faltando. A ausência de pricing SHALL NOT bloquear a seleção. O painel SHALL expor cobertura `complete`, `partial` ou `missing` e os componentes ausentes, informando que a estimativa pode permanecer parcial ou seguir a cadeia existente até `fallback_static`/`not_available`; o painel não SHALL predizer a fonte final sem usage/env da chamada.

O pricing exigido SHALL considerar:

- **Texto e visão** (`chat-completions`): linha vigente (ou bootstrap) com preço de tokens (`input`/`output`) para `(provider, model)`.
- **`campaign_image` e `visual_signature_image`** (`responses` com a tool `image_generation`): preço do modelo **e** o componente da tool — linha `(provider, 'responses:image_generation')` com `image_unit_usd`.
- **`campaign_image_edit`** (`images`): preço **por unidade de imagem** (`image_unit_usd`) para `(provider, model)`.

#### Scenario: Modelo sem pricing é sinalizado

- **WHEN** o catálogo é listado e um modelo não tem o pricing exigido pela capacidade
- **THEN** o modelo é sinalizado como "sem pricing configurado" para aquele componente
- **AND** o admin é informado de que o custo cairá no fallback

#### Scenario: Componente da tool de imagem é exigido

- **WHEN** um modelo é selecionável em `campaign_image` ou `visual_signature_image`
- **THEN** a verificação exige, além do preço do modelo, o componente `(provider, 'responses:image_generation')` com `image_unit_usd`
- **AND** a ausência do componente é sinalizada

#### Scenario: Modelo de edição exige preço por unidade de imagem

- **WHEN** um modelo é selecionável em `campaign_image_edit`
- **THEN** a verificação exige `image_unit_usd` para `(provider, model)`
- **AND** a ausência é sinalizada

#### Scenario: Modelo com pricing não é sinalizado

- **WHEN** um modelo tem todos os componentes de pricing exigidos pela capacidade
- **THEN** ele aparece como precificado
- **AND** a troca para esse modelo mantém a contabilidade clara

### Requirement: Seleção não altera o resolvedor de custo

A seleção administrativa SHALL NOT alterar o comportamento de `resolveAiCost`: a cadeia de fontes (provider_reported → manual_unknown → pricing_table → fallback_static → not_available) permanece inalterada.

#### Scenario: Custo continua resolvido pela cadeia existente

- **WHEN** uma capacidade com seleção persistida é executada
- **THEN** o custo é resolvido pela cadeia de fontes existente
- **AND** nenhuma regra nova de custo é introduzida pela seleção
