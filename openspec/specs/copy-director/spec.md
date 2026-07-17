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

O sistema SHALL chamar `provider.generateText(prompt, { system, temperature, maxTokens, signal })` com parâmetros apropriados.

#### Scenario: generateCopy calls provider with correct parameters

- **WHEN** `generateCopy` é chamado
- **THEN** `provider.generateText` é chamado com o prompt interpolado
- **AND** `system` contém instrução de copywriter especialista
- **AND** `temperature` é 0.7
- **AND** `maxTokens` é 1000

### Requirement: generateCopy propaga AbortSignal para TextProvider

O sistema SHALL propagar o `AbortSignal` recebido por `generateCopy(input, options?)` para `TextProvider.generateText(prompt, { ..., signal })`, de modo que o ramo Copy possa ser abortado quando o Image Director falha (e vice-versa).

#### Scenario: generateCopy repassa signal para TextProvider

- **WHEN** `generateCopy(input, { signal })` é chamado com um `AbortSignal` válido
- **THEN** o `signal` é repassado para `provider.generateText(prompt, { ..., signal })`

#### Scenario: generateCopy funciona sem signal

- **WHEN** `generateCopy(input)` é chamado sem `options` ou sem `signal`
- **THEN** `provider.generateText` é chamado sem `signal` (comportamento retrocompatível)

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

### Requirement: parseResult usa 2 tiers (JSON + regex) e lança MalformedResponseError se ambos falharem

O sistema SHALL modificar `CopyDirectorService.parseResult()` para usar apenas 2 tiers de parse (JSON → regex), lançando `MalformedResponseError` se AMBOS falharem.

O fallback determinístico existente (usar o texto bruto como caption) DEVE ser removido do `parseResult()` porque:
1. **Pipeline F25 é "campanha completa ou nada" (D8)** — publicar copy de baixa qualidade sem chance de retry viola o contrato
2. **Retry Gemini precisa ser exercitável** — se o fallback determinístico sempre "consegue" produzir resultado para qualquer texto não vazio, o caminho de retry com Gemini nunca é acionado para respostas malformadas
3. **Consistência:** o estorno é preferível a publicar copy incoerente

O fallback determinístico pode ser mantido **fora** do `parseResult()`, como decisão explícita no pipeline em cenários futuros de "degradar sem retry" — mas na F25 ele não é chamado.

#### Scenario: JSON e regex falham → MalformedResponseError

- **WHEN** `parseResult` recebe string que não é JSON válido E regex não consegue extrair campos
- **THEN** lança `MalformedResponseError`

#### Scenario: JSON válido → retorna CopyDirectorResult

- **WHEN** `parseResult` recebe JSON válido com todos os campos obrigatórios
- **THEN** retorna `CopyDirectorResult` sem lançar erro

#### Scenario: Regex funciona quando JSON falha → retorna CopyDirectorResult

- **WHEN** `parseResult` recebe texto não-JSON mas regex extrai campos com sucesso
- **THEN** retorna `CopyDirectorResult` sem lançar erro

### Requirement: GeminiTextProvider como fallback de retry

O sistema SHALL implementar `GeminiTextProvider` em `src/lib/text-provider/gemini.ts`, ativado apenas como fallback de retry do Copy Director (não como provider primário).

O sistema SHALL usar as seguintes configurações:

| Variável | Obrigatória? | Padrão | Descrição |
|----------|:---:|--------|-----------|
| `TEXT_FALLBACK_PROVIDER` | Não | (vazio = desligado) | `gemini` para ativar fallback |
| `GEMINI_API_KEY` | Se fallback ativo | — | Chave de API Google Gemini |
| `GEMINI_TEXT_MODEL` | Não | `gemini-3.1-flash-lite` | Modelo usado no fallback de texto |

#### Scenario: GeminiTextProvider é instanciado via factory

- **WHEN** `createTextProvider('gemini')` é chamado com `GEMINI_API_KEY` configurada
- **THEN** retorna uma instância de `GeminiTextProvider`

#### Scenario: GeminiTextProvider generateText retorna conteúdo

- **WHEN** `GeminiTextProvider.generateText(prompt)` é chamado com prompt válido
- **THEN** retorna `TextProviderResult` com `content`, `usage` e `model`

#### Scenario: Fallback não ativo não impede funcionamento

- **WHEN** `TEXT_FALLBACK_PROVIDER` não está configurado ou `GEMINI_API_KEY` está vazia
- **THEN** o fallback Gemini simplesmente não é usado — o segundo retry não acontece

### Requirement: isRetryableError function

O sistema SHALL prover uma função `isRetryableError(err)` que classifica erros para decidir se o Copy Director deve tentar novamente com fallback:

| Classificação | Erros | Ação |
|--------------|-------|------|
| **Retryable** | timeout, rate limit do provider, erro 5xx, `MalformedResponseError`, falha de rede, indisponibilidade do provider | Retry com fallback Gemini |
| **Não retryable** | ZodError, SafetyBlockError, InputConflictError, AuthConfigError, PayloadTooLargeError | Falha imediata |

#### Scenario: Erro retryable → retorna true

- **WHEN** `isRetryableError` recebe um TimeoutError, ProviderRateLimitError, Provider5xxError, MalformedResponseError, ou NetworkError
- **THEN** retorna `true`

#### Scenario: Erro não retryable → retorna false

- **WHEN** `isRetryableError` recebe um ZodError, SafetyBlockError, InputConflictError, AuthConfigError, ou PayloadTooLargeError
- **THEN** retorna `false`

#### Scenario: Erro desconhecido → retorna false

- **WHEN** `isRetryableError` recebe um erro de tipo não classificado
- **THEN** retorna `false` (default: não retry)

### Requirement: GeminatextProvider lança MalformedResponseError para resposta vazia

O sistema SHALL fazer `GeminiTextProvider.generateText()` lançar `MalformedResponseError` se a resposta da API Gemini for vazia ou não contiver texto utilizável, para que o retry seletivo do pipeline funcione corretamente também com o fallback.

#### Scenario: Gemini retorna vazio → MalformedResponseError

- **WHEN** `GeminiTextProvider.generateText()` recebe resposta vazia da API Gemini
- **THEN** lança `MalformedResponseError`
