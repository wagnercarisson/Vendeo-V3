# TextProvider

> Synced from `fase-23-text-provider-copy-director` (ADDED).

## Purpose

Abstração genérica de IA para texto, paralela ao `ImageProvider`. Define interface, options, result, implementações OpenAI e Mock, e factory com configuração via variável de ambiente.

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

O sistema SHALL implementar `OpenAITextProvider` usando OpenAI Chat Completions API (modelo `gpt-4o` por padrão, configurável via `OPENAI_TEXT_MODEL`).

#### Scenario: OpenAITextProvider calls OpenAI with correct prompt

- **WHEN** `generateText(prompt, options)` é chamado
- **THEN** chama OpenAI Chat Completions com `model` do env `OPENAI_TEXT_MODEL` (ou `gpt-4o` como fallback)
- **AND** o parâmetro `messages` contém `system` de `options.system` (se fornecido) e `user` com o `prompt`

#### Scenario: OpenAITextProvider returns structured result

- **WHEN** OpenAI responde com sucesso
- **THEN** retorna `TextProviderResult` com `content`, `usage.promptTokens`, `usage.completionTokens`, e `model`

#### Scenario: OpenAITextProvider supports AbortSignal

- **WHEN** `options.signal` é fornecido
- **THEN** o sinal é passado para a chamada OpenAI

### Requirement: MockTextProvider implementation

O sistema SHALL implementar `MockTextProvider` que retorna dados determinísticos para testes e desenvolvimento.

#### Scenario: MockTextProvider returns deterministic data

- **WHEN** `generateText` é chamado
- **THEN** retorna `TextProviderResult` com `content` previsível e `usage` fixo

### Requirement: createTextProvider factory

O sistema SHALL implementar `createTextProvider(provider?: string): TextProvider` que retorna o provider baseado na variável de ambiente `TEXT_PROVIDER`.

#### Scenario: createTextProvider without env returns OpenAITextProvider

- **WHEN** `createTextProvider()` é chamado sem argumentos e sem `TEXT_PROVIDER`
- **THEN** retorna instância de `OpenAITextProvider`

#### Scenario: createTextProvider('openai') returns OpenAITextProvider

- **WHEN** `createTextProvider('openai')` é chamado
- **THEN** retorna instância de `OpenAITextProvider`

#### Scenario: createTextProvider('mock') returns MockTextProvider

- **WHEN** `createTextProvider('mock')` é chamado
- **THEN** retorna instância de `MockTextProvider`

### Requirement: TEXT_PROVIDER env var configuration

O sistema SHALL usar `TEXT_PROVIDER` (valores: `openai` | `mock`) para configurar o provider padrão. Default: `openai`.

#### Scenario: TEXT_PROVIDER=mock selects MockTextProvider

- **WHEN** `TEXT_PROVIDER=mock` está definido
- **THEN** `createTextProvider()` sem argumentos retorna `MockTextProvider`

### Requirement: MockTextProvider never used as production fallback

O sistema SHALL garantir que `MockTextProvider` nunca seja usado como fallback em produção. Se a API falhar em produção, o erro deve propagar.

#### Scenario: MockTextProvider is not used in production error path

- **WHEN** `OpenAITextProvider.generateText` lança erro em produção
- **THEN** o erro é propagado, sem fallback para `MockTextProvider`
