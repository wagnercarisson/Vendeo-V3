# TextProvider

> Synced from `fase-23-text-provider-copy-director` (ADDED) + `fase-46-gateway-unico-de-ia-e-registry-de-modelos` (ADDED/MODIFIED/REMOVED).

## Purpose

Abstração genérica de IA para texto, paralela ao `ImageProvider`. Define interface, options, result, implementações OpenAI e Mock e factory de compatibilidade/teste. A escolha de provider/modelo é resolvida pelo registry/gateway (F46); o alvo de fallback é configurável e acionado explicitamente pelo orquestrador.

## Requirements

### Requirement: TextProvider interface

O sistema SHALL definir a interface `TextProvider` com método `generateText(prompt: string, options?: TextProviderOptions): Promise<TextProviderResult>` e propriedade `readonly name: string`.

#### Scenario: TextProvider interface defines generateText contract

- **WHEN** `TextProvider` é implementado
- **THEN** expõe método `generateText` que aceita `prompt` (string) e `options` (opcional `TextProviderOptions`)
- **AND** retorna `Promise<TextProviderResult>`

#### Scenario: TextProvider interface exposes name

- **WHEN** `TextProvider` é implementado
- **THEN** expõe `readonly name: string`

### Requirement: TextProviderOptions interface

O sistema SHALL definir `TextProviderOptions` com campos opcionais: `system? (string)`, `temperature? (number)`, `maxTokens? (number)`, `signal? (AbortSignal)`.

#### Scenario: TextProviderOptions has optional fields

- **WHEN** `TextProviderOptions` é usado
- **THEN** `system`, `temperature`, `maxTokens`, e `signal` são todos opcionais

### Requirement: TextProviderResult interface

O sistema SHALL definir `TextProviderResult` com campos: `content (string)`, `usage: { promptTokens: number; completionTokens: number }`, `model (string)`.

#### Scenario: TextProviderResult has content and usage

- **WHEN** `generateText` retorna
- **THEN** o resultado contém `content` (string), `usage.promptTokens`, `usage.completionTokens`, e `model`

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

### Requirement: MockTextProvider implementation

O sistema SHALL implementar `MockTextProvider` que retorna dados determinísticos para testes e desenvolvimento.

#### Scenario: MockTextProvider returns deterministic data

- **WHEN** `generateText` é chamado
- **THEN** retorna `TextProviderResult` com `content` previsível e `usage` fixo

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

### Requirement: MockTextProvider never used as production fallback

O sistema SHALL garantir que `MockTextProvider` nunca seja usado como fallback em produção. Se a API falhar em produção, o erro deve propagar.

#### Scenario: MockTextProvider is not used in production error path

- **WHEN** `OpenAITextProvider.generateText` lança erro em produção
- **THEN** o erro é propagado, sem fallback para `MockTextProvider`

### Requirement: Alvo de fallback configurável resolvido pelo registry e acionado pelo orquestrador

O fallback de texto hoje controlado por `TEXT_FALLBACK_PROVIDER` SHALL ser registrado no registry como **default inicial** de `campaign_copy` (um `AiModelTarget` com o seu `protocol`). O gateway SHALL NOT acionar o fallback automaticamente; o **serviço orquestrador** SHALL fazer uma **segunda `invoke(..., target: "fallback")` explícita** quando a chamada primária falhar com erro `retryable` e houver alvo de fallback configurado (diferente do primary). O orquestrador SHALL NOT conhecer o provider que ocupa o fallback. Cada chamada SHALL emitir o seu próprio envelope de telemetria.

#### Scenario: Fallback acionado explicitamente pelo orquestrador

- **WHEN** a chamada primária de texto falha de forma retryable e há alvo de fallback configurado
- **THEN** o orquestrador faz uma segunda `invoke` explícita no alvo `fallback`
- **AND** dois envelopes de telemetria são emitidos (primária + fallback)

#### Scenario: Sem fallback configurado o erro propaga

- **WHEN** a chamada primária falha e não há fallback configurado
- **THEN** o erro é propagado sem segunda chamada
