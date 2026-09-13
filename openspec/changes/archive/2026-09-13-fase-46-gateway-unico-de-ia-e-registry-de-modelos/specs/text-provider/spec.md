# TextProvider (delta F46)

> Delta da capability existente `text-provider` pela `fase-46-gateway-unico-de-ia-e-registry-de-modelos`. Substitui a configuração por env-var (`OPENAI_TEXT_MODEL`, `TEXT_PROVIDER`) pela resolução via registry/gateway, preservando a interface e o resultado.

## ADDED Requirements

### Requirement: Alvo de fallback configurável resolvido pelo registry e acionado pelo orquestrador

O fallback de texto hoje controlado por `TEXT_FALLBACK_PROVIDER` SHALL ser registrado no registry como **default inicial** de `campaign_copy` (um `AiModelTarget` com o seu `protocol`). O gateway SHALL NOT acionar o fallback automaticamente; o **serviço orquestrador** SHALL fazer uma **segunda `invoke(..., target: "fallback")` explícita** quando a chamada primária falhar com erro `retryable` e houver alvo de fallback configurado (diferente do primary). O orquestrador SHALL NOT conhecer o provider que ocupa o fallback. Cada chamada SHALL emitir o seu próprio envelope de telemetria.

#### Scenario: Fallback acionado explicitamente pelo orquestrador

- **WHEN** a chamada primária de texto falha de forma retryable e há alvo de fallback configurado
- **THEN** o orquestrador faz uma segunda `invoke` explícita no alvo `fallback`
- **AND** dois envelopes de telemetria são emitidos (primária + fallback)

#### Scenario: Sem fallback configurado o erro propaga

- **WHEN** a chamada primária falha e não há fallback configurado
- **THEN** o erro é propagado sem segunda chamada

## MODIFIED Requirements

### Requirement: OpenAITextProvider implementation

O sistema SHALL implementar `OpenAITextProvider` usando OpenAI Chat Completions API, com o **modelo resolvido pelo registry** (default `gpt-4o` preservado para texto de campanha), sem depender de `OPENAI_TEXT_MODEL`. A execução SHALL ocorrer pela camada única (gateway), preservando o contrato `TextProviderResult`.

#### Scenario: OpenAITextProvider chama com o prompt correto

- **WHEN** `generateText(prompt, options)` é chamado
- **THEN** chama OpenAI Chat Completions com o modelo resolvido pelo registry
- **AND** o parâmetro `messages` contém `system` de `options.system` (se fornecido) e `user` com o `prompt`

#### Scenario: OpenAITextProvider retorna resultado estruturado

- **WHEN** OpenAI responde com sucesso
- **THEN** retorna `TextProviderResult` com `content`, `usage.promptTokens`, `usage.completionTokens`, e `model`

#### Scenario: OpenAITextProvider suporta AbortSignal

- **WHEN** `options.signal` é fornecido
- **THEN** o sinal é propagado ao adapter/gateway
- **AND** o cancelamento interrompe a chamada

### Requirement: createTextProvider factory

O sistema SHALL implementar `createTextProvider(provider?: string): TextProvider` que resolve o provider pelo **registry/alvo** (provider padrão `openai`), sem depender da env-var `TEXT_PROVIDER`. A escolha de provider/modelo passa a vir do registry (alvo resolvido), **não** de string hardcoded no orquestrador; o factory permanece como utilidade de compatibilidade/teste, e o orquestrador usa `invoke(..., target)`.

#### Scenario: createTextProvider sem argumento retorna OpenAITextProvider

- **WHEN** `createTextProvider()` é chamado sem argumentos
- **THEN** retorna instância de `OpenAITextProvider` (provider padrão do registry)

#### Scenario: createTextProvider('openai') retorna OpenAITextProvider

- **WHEN** `createTextProvider('openai')` é chamado
- **THEN** retorna instância de `OpenAITextProvider`

#### Scenario: createTextProvider('mock') retorna MockTextProvider

- **WHEN** `createTextProvider('mock')` é chamado
- **THEN** retorna instância de `MockTextProvider`

## REMOVED Requirements

### Requirement: TEXT_PROVIDER env var configuration

**Reason**: a escolha de provider/modelo passa a ser responsabilidade do registry (e, no Change B, da seleção administrativa persistida). Manter uma env-var paralela criaria duas fontes da verdade.

**Migration**: remover a leitura de `TEXT_PROVIDER` e de `OPENAI_TEXT_MODEL` do runtime; o provider padrão (`openai`), o modelo padrão (`gpt-4o`) e o alvo de fallback passam a vir do registry (default inicial configurável).
