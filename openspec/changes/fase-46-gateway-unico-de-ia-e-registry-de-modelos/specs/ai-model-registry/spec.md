# AI Model Registry

> Capability nova (ADDED) pela `fase-46-gateway-unico-de-ia-e-registry-de-modelos`. Define o registro central de modelos por capacidade/segmento, a resolução de chaves de API por provider e a eliminação das env-vars de modelo como mecanismo de configuração.

## ADDED Requirements

### Requirement: Registro central de modelos por capacidade

O sistema SHALL manter um registro único em código (`src/lib/ai/model-registry.ts`) que mapeia cada **capacidade** de IA para um `AiModelConfig`: `{ capability, segment, primary: AiModelTarget, fallback?: AiModelTarget }`, onde `AiModelTarget = { provider, model, protocol }`. Cada capacidade SHALL pertencer a um **segmento** (`text` | `vision` | `image`) e **cada alvo (primary e fallback)** SHALL declarar o seu próprio **`protocol`** de wire (`chat-completions` | `responses` | `images` | `gemini`). O registro SHALL ser a **única fonte da verdade** para a escolha de modelo; nenhum serviço SHALL ler env-var de modelo diretamente.

#### Scenario: Capacidade resolve configuração completa pelo registry

- **WHEN** uma capacidade é consultada no registry
- **THEN** retorna a configuração com `segment` e `primary` (`provider`, `model`, `protocol`) definidos
- **AND** `primary.protocol` corresponde ao protocolo de wire exigido pela capacidade (ex.: `campaign_image` → `responses`; `campaign_image_edit` → `images`)

#### Scenario: Fallback carrega o próprio protocolo

- **WHEN** `campaign_copy` é resolvida
- **THEN** `primary.protocol` é `chat-completions`
- **AND** `fallback.protocol` é `gemini` (alvo `{ provider: gemini, model: gemini-3.1-flash-lite, protocol: gemini }`)

#### Scenario: Protocolos distintos no mesmo segmento

- **WHEN** `campaign_image` (protocolo `responses`) e `campaign_image_edit` (protocolo `images`) são resolvidas
- **THEN** cada uma declara o seu protocolo próprio
- **AND** o gateway seleciona o adapter pelo `protocol`, não pelo segmento

#### Scenario: Serviço não lê env-var de modelo

- **WHEN** os serviços de IA são inspecionados
- **THEN** nenhum deles lê `process.env` para escolher modelo ou provider
- **AND** todos obtêm a configuração via registry/gateway

### Requirement: Defaults do registry preservam o comportamento atual

Os defaults do registry SHALL ser idênticos aos valores efetivamente usados hoje, garantindo preservação de comportamento: `campaign_copy`/`campaign_correction_analysis`/`brand_profile_text`/`campaign_input_validation`/`campaign_image_review`/`brand_profile_vision` → openai `gpt-4o`; `campaign_spec` → openai `gpt-4o-mini`; `visual_signature_validation` → openai `gpt-4o-mini`; `campaign_image`/`visual_signature_image` → openai `gpt-5.5`; `campaign_image_edit` → openai `gpt-image-2`.

#### Scenario: Defaults equivalem aos valores atuais

- **WHEN** a configuração de cada capacidade é comparada ao comportamento pré-F46
- **THEN** o modelo e o provider resolvidos são idênticos aos usados antes da mudança
- **AND** nenhuma geração tem o modelo alterado por esta fase

#### Scenario: Capacidades do segmento visual mantêm modelos distintos

- **WHEN** `campaign_image_review` (gpt-4o) e `visual_signature_validation` (gpt-4o-mini) são resolvidas
- **THEN** cada uma mantém o seu modelo próprio (sem colapsar em um único modelo de visão)

### Requirement: Resolução de chaves de API por provider

O sistema SHALL resolver as chaves de API exclusivamente por env-var de chave (`OPENAI_API_KEY`, `GEMINI_API_KEY`) via módulo dedicado (`src/lib/ai/api-keys.ts`). Em produção, a ausência da chave do provider resolvido SHALL falhar de forma explícita; em desenvolvimento/teste, o comportamento atual é preservado.

#### Scenario: Provider OpenAI usa apenas OPENAI_API_KEY

- **WHEN** uma capacidade com provider `openai` é invocada
- **THEN** a chave usada é `OPENAI_API_KEY`
- **AND** nenhuma outra env-var de modelo/provider é necessária

#### Scenario: Ausência de chave em produção falha explicitamente

- **WHEN** a chave do provider resolvido não está configurada e `NODE_ENV === "production"`
- **THEN** a invocação falha com erro de configuração explícito (sem fallback silencioso)

### Requirement: Allowlist de modelos testados e validados

O registry SHALL declarar a **allowlist** de modelos conhecidos/testados, servindo de base para a seleção administrativa do Change B. A compatibilidade SHALL ser validada por **capacidade + provider + modelo + protocolo** (nunca apenas por segmento), pois dois modelos de imagem podem exigir protocolos diferentes. Um modelo fora da allowlist, ou um `protocol` incompatível com a capacidade, SHALL NOT ser resolvido pelo gateway.

#### Scenario: Modelo fora da allowlist é rejeitado

- **WHEN** uma configuração aponta para um modelo ausente da allowlist
- **THEN** a resolução falha (ou cai no default) sem executar a chamada com o modelo inválido

#### Scenario: Protocolo incompatível é rejeitado

- **WHEN** uma configuração associa uma capacidade a um `protocol` diferente do esperado para ela
- **THEN** a resolução rejeita a configuração
- **AND** nenhuma chamada é executada com o protocolo errado

### Requirement: Interface AiModelResolver como seam de resolução

O sistema SHALL definir a interface `AiModelResolver` (`src/lib/ai/model-resolver.ts`) com a operação de resolver a configuração de uma capacidade. O registry em código SHALL ser a **implementação inicial** e o gateway SHALL depender **apenas da interface** (nunca do mapa concreto), permitindo que o Change B decore/substitua o resolver (seleção persistida) sem refazer o gateway.

#### Scenario: Gateway depende da interface

- **WHEN** o gateway resolve uma capacidade
- **THEN** usa um `AiModelResolver` injetado
- **AND** não acessa diretamente a estrutura interna do registry

#### Scenario: Resolver substituível

- **WHEN** uma implementação alternativa de `AiModelResolver` é injetada
- **THEN** o gateway a utiliza sem alteração de código
- **AND** o comportamento com o registry em código permanece o default

### Requirement: Alvo de fallback inicial registrado como configuração (não regra)

O registry SHALL registrar o **alvo de fallback** hoje controlado por `TEXT_FALLBACK_PROVIDER` como **configuração inicial (default)**, antes de a env-var ser removida, incluindo o seu **próprio `protocol`**. O provider que ocupa o fallback **não** é regra arquitetural: é dado configurável, substituível no Change B. O gateway e os orquestradores SHALL NOT conhecer providers específicos (nenhum `if provider === "gemini"`).

#### Scenario: Default inicial de fallback registrado

- **WHEN** o registry é inspecionado após a F46
- **THEN** `campaign_copy` traz um alvo de fallback completo (`{ provider, model, protocol }`) como **default inicial**
- **AND** nenhum serviço/gateway contém lógica condicional por provider específico

### Requirement: Validação de alvos distintos

O registry SHALL rejeitar uma configuração em que `primary` e `fallback` tenham o mesmo `provider` + `model`, garantindo que o fallback nunca repita o alvo primário.

#### Scenario: Primary e fallback iguais são rejeitados

- **WHEN** uma configuração define `primary` e `fallback` com o mesmo `provider` + `model`
- **THEN** o registry rejeita a configuração
- **AND** o gateway não executa o fallback contra o mesmo alvo

#### Scenario: Fallback distinto é aceito

- **WHEN** `primary` e `fallback` diferem em `provider` ou `model`
- **THEN** a configuração é aceita
- **AND** o orquestrador pode acionar o alvo `fallback`

### Requirement: Env-vars de modelo eliminadas do runtime

O runtime SHALL NOT depender das env-vars de modelo/provider (`OPENAI_MODEL`, `OPENAI_TEXT_MODEL`, `OPENAI_BRAND_DIRECTOR_MODEL`, `OPENAI_TEXT_ONLY_INFERENCE_MODEL`, `IMAGE_GENERATION_RESPONSES_MODEL`, `GPT_IMAGE_MODEL`, `IMAGE_EDIT_FALLBACK_MODEL`, `VISION_REVIEW_MODEL`, `IMAGE_VALIDATION_MODEL`, `IMAGE_PROVIDER`, `TEXT_PROVIDER`, `TEXT_FALLBACK_PROVIDER`, `GEMINI_TEXT_MODEL`, `GEMINI_MODEL`). Restam apenas as chaves de API e as variáveis operacionais (timeout, qualidade, debug, fallback de custo).

#### Scenario: Configuração sem envs de modelo

- **WHEN** o código é executado apenas com as chaves de API e variáveis operacionais
- **THEN** todas as capacidades resolvem provider/modelo corretamente pelo registry
- **AND** nenhuma chamada de IA quebra por env-var de modelo ausente
