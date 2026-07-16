# Copy Director

> Synced from `fase-23-text-provider-copy-director` (ADDED).

## Purpose

Geração de copy persuasivo para campanhas usando `TextProvider` e `PromptLoader`. Define schemas de input/output (Zod), o serviço `CopyDirectorService`, e parse da saída da IA com fallback em 3 camadas.

## Requirements

### Requirement: CopyDirectorInput schema (Zod)

O sistema SHALL definir o schema `CopyDirectorInput` (Zod) com campos: `productName (string, obrigatório)`, `description? (string)`, `offer (string, obrigatório)`, `storeName (string, obrigatório)`, `segment (string, obrigatório)`, `toneOfVoice? (string)`, `positioning? (string)`, `shortDescription? (string)`, `slogan? (string)`, `brandPersonality? (string)`, `campaignGuidelines? (string)`.

#### Scenario: CopyDirectorInput accepts complete input

- **WHEN** `CopyDirectorInput` é validado com todos os campos
- **THEN** a validação passa

#### Scenario: CopyDirectorInput accepts minimal input

- **WHEN** `CopyDirectorInput` é validado com apenas campos obrigatórios (`productName`, `offer`, `storeName`, `segment`)
- **THEN** a validação passa

#### Scenario: CopyDirectorInput rejects empty productName

- **WHEN** `productName` é string vazia
- **THEN** a validação rejeita

#### Scenario: CopyDirectorInput rejects missing productName

- **WHEN** `productName` está ausente
- **THEN** a validação rejeita

### Requirement: CopyDirectorInput does not include mandatoryArtworkText

O sistema SHALL NÃO incluir o campo `mandatoryArtworkText` no schema `CopyDirectorInput`.

#### Scenario: mandatoryArtworkText is not in schema

- **WHEN** `CopyDirectorInput` schema é inspecionado
- **THEN** NÃO contém o campo `mandatoryArtworkText`
- **AND** passar `mandatoryArtworkText` como propriedade extra resulta em erro de schema ou é ignorado

### Requirement: CopyDirectorResult schema (Zod)

O sistema SHALL definir o schema `CopyDirectorResult` (Zod) com campos: `title (string, obrigatório)`, `caption (string, obrigatório)`, `hashtags (string[], obrigatório)`, `cta_post (string, obrigatório)`, `toneDescription? (string)`.

#### Scenario: CopyDirectorResult accepts valid result

- **WHEN** `CopyDirectorResult` é validado com `title`, `caption`, `hashtags` (array), `cta_post`, e opcionalmente `toneDescription`
- **THEN** a validação passa

#### Scenario: CopyDirectorResult rejects missing caption

- **WHEN** `caption` está ausente
- **THEN** a validação rejeita

#### Scenario: CopyDirectorResult title is required

- **WHEN** `title` está ausente
- **THEN** a validação rejeita

### Requirement: CopyDirectorService class

O sistema SHALL implementar `CopyDirectorService` que usa `TextProvider` e `PromptLoader` para gerar copy persuasivo.

#### Scenario: CopyDirectorService is constructable

- **WHEN** `new CopyDirectorService(provider)` é chamado com um `TextProvider` válido
- **THEN** a construção é bem-sucedida

### Requirement: generateCopy with complete input returns valid CopyDirectorResult

O sistema SHALL garantir que `generateCopy(input)` com input completo retorne `CopyDirectorResult` válido.

#### Scenario: generateCopy with complete input

- **WHEN** `generateCopy` é chamado com `CopyDirectorInput` completo (obrigatórios + opcionais)
- **THEN** retorna `CopyDirectorResult` com `title` não vazio, `caption` não vazio, `hashtags` com ao menos 3 itens, `cta_post` presente e não vazio

### Requirement: generateCopy with minimal input returns valid CopyDirectorResult

O sistema SHALL garantir que `generateCopy(input)` com input mínimo (apenas obrigatórios) funcione sem erros.

#### Scenario: generateCopy with minimal input

- **WHEN** `generateCopy` é chamado com apenas campos obrigatórios
- **THEN** retorna `CopyDirectorResult` válido

### Requirement: generateCopy uses PromptLoader to load campaign-copy-director prompt

O sistema SHALL carregar o template `campaign-copy-director` via `PromptLoader.load()` e interpolar as variáveis do input.

#### Scenario: generateCopy loads prompt template

- **WHEN** `generateCopy` é chamado
- **THEN** `PromptLoader.load("campaign-copy-director", { ... })` é chamado com as variáveis mapeadas do input

### Requirement: generateCopy calls TextProvider with system prompt and temperature

O sistema SHALL chamar `provider.generateText(prompt, { system, temperature, maxTokens })` com parâmetros apropriados.

#### Scenario: generateCopy calls provider with correct parameters

- **WHEN** `generateCopy` é chamado
- **THEN** `provider.generateText` é chamado com o prompt interpolado
- **AND** `system` contém instrução de copywriter especialista
- **AND** `temperature` é 0.7
- **AND** `maxTokens` é 1000

### Requirement: parseResult handles valid JSON output

O sistema SHALL fazer parse de saída JSON válida para `CopyDirectorResult` via `JSON.parse()` + validação Zod.

#### Scenario: parseResult with valid JSON

- **WHEN** a IA retorna JSON válido com todos os campos
- **THEN** o parse produz `CopyDirectorResult` correto sem erros

### Requirement: parseResult handles malformed JSON via regex fallback

O sistema SHALL implementar fallback via regex quando `JSON.parse()` falha, extraindo campos do texto bruto.

#### Scenario: parseResult uses regex fallback

- **WHEN** a IA retorna texto que não é JSON válido mas contém campos reconhecíveis
- **THEN** regex extrai `title`, `caption`, `hashtags`, e `cta_post` do texto

### Requirement: parseResult has deterministic fallback for completely invalid output

O sistema SHALL implementar fallback determinístico que usa o texto bruto como `caption` quando JSON e regex falham.

#### Scenario: parseResult uses deterministic fallback

- **WHEN** a IA retorna texto completamente malformatado
- **THEN** o fallback usa o texto bruto como `caption`
- **AND** `title` recebe valor extraído ou padrão
- **AND** `hashtags` recebe array vazio
- **AND** `cta_post` recebe valor padrão
