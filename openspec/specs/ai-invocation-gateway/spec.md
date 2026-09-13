# AI Invocation Gateway

> Synced from `fase-46-gateway-unico-de-ia-e-registry-de-modelos` (ADDED).

## Purpose

Camada única de execução de chamadas de IA com adapters por protocolo, contrato único de request/result/usage e telemetria obrigatória por chamada. O gateway (`src/lib/ai/gateway.ts`) resolve o alvo (primary/fallback) por uma `AiModelResolver` injetada, executa uma tentativa por invocação e emite um envelope de telemetria por tentativa real via sink injetável.

## Requirements

### Requirement: Camada única de invocação de IA

O sistema SHALL expor um gateway único (`src/lib/ai/gateway.ts`) como `class AiGateway { constructor(resolver: AiModelResolver, adapters: AiAdapterRegistry) }` — dependências **injetadas por construtor** — com a operação `invoke(capability, request, telemetry, target = "primary")`, onde `target: "primary" | "fallback"` é a **seleção explícita do orquestrador** e o **contexto de telemetria é obrigatório em produção**. `invoke` **não** recebe o resolver por argumento. Os serviços de IA SHALL NOT instanciar providers (`new OpenAI()`, `new GoogleGenerativeAI()`) nem chamar APIs de provider diretamente; eles continuam responsáveis por prompts, regras de negócio, retry e timeout.

#### Scenario: Serviço invoca pela camada única

- **WHEN** um serviço de IA precisa de uma chamada
- **THEN** ele chama `invoke(...)` do gateway
- **AND** não instancia provider nem executa chamada HTTP de IA diretamente

#### Scenario: Serviço mantém prompts e regras

- **WHEN** um serviço é migrado
- **THEN** a montagem de prompt e as regras de negócio permanecem no serviço
- **AND** o gateway recebe o prompt já montado

#### Scenario: Contexto de telemetria obrigatório em produção

- **WHEN** uma capacidade é invocada sem contexto de telemetria (ou com contexto sem `sink`)
- **THEN** a invocação é rejeitada (contexto e `sink` obrigatórios — `AiTelemetryContext.sink` não é opcional)
- **AND** um `NoopAiTelemetrySink` só é aceito em testes com adapter falso; `createDefaultTelemetryContext(...)` injeta o sink padrão

#### Scenario: Orquestrador seleciona o alvo explicitamente

- **WHEN** o orquestrador aciona o fallback de `campaign_copy`
- **THEN** chama `invoke("campaign_copy", request, telemetry, target: "fallback")`
- **AND** o gateway resolve o alvo de fallback **configurado** (default inicial Gemini) sem decidir por conta própria

#### Scenario: Gateway não decide o alvo

- **WHEN** `target` não é informado
- **THEN** o gateway usa `primary`
- **AND** nunca aciona `fallback` automaticamente

### Requirement: Adapters por protocolo de wire

O gateway SHALL selecionar o adapter pelo **`protocol`** declarado na configuração resolvida (não pelo segmento nem pelo serviço), entre: `chat-completions` (OpenAI Chat: texto, visão, JSON mode/structured outputs), `responses` (Responses API: tool `image_generation` e visão), `images` (`images.edit` multi-imagem) e `gemini` (`generateContent`). O adapter SHALL conhecer apenas o shape do seu protocolo e retornar o contrato comum.

#### Scenario: Adapter selecionado por protocolo

- **WHEN** a capacidade exige o protocolo `responses` (tool de imagem)
- **THEN** o gateway usa o adapter `responses`
- **AND** a capacidade de texto usa o adapter `chat-completions`

#### Scenario: Mesmo segmento, protocolos diferentes

- **WHEN** `campaign_image` (`responses`) e `campaign_image_edit` (`images`) são executadas
- **THEN** cada uma usa o adapter do seu protocolo
- **AND** o gateway não infere o adapter pelo segmento `image`

#### Scenario: Adapter não contém regra de negócio

- **WHEN** um adapter é inspecionado
- **THEN** ele apenas traduz request/result do protocolo
- **AND** não decide prompt, modelo ou regra de campanha

### Requirement: Contrato único de resultado e usage

O gateway SHALL normalizar a resposta dos adapters num contrato único contendo o conteúdo/imagem, o **modelo real** usado, o `mimeType` quando aplicável e o `usage` normalizado (`promptTokens`, `completionTokens`, `totalTokens`, `cachedInputTokens`, `imageTokens` e breakdown text/image quando disponível). Providers que não expõem usage SHALL ser representados de forma explícita (ausência/`not_available`), nunca silenciados.

#### Scenario: Usage normalizado entre protocolos

- **WHEN** um adapter `chat-completions` e um adapter `responses` retornam usage
- **THEN** ambos são normalizados no mesmo formato `TokenUsage`
- **AND** o resultado expõe o modelo real usado

#### Scenario: Provider sem usage é explícito

- **WHEN** o fallback `images.edit` retorna sem usage
- **THEN** o resultado sinaliza ausência de tokens (não inventa zeros)
- **AND** a duração e o custo por unidade (quando aplicável) ainda são reportados

### Requirement: Contrato de erro normalizado preserva os gates de fallback

O gateway SHALL normalizar **erros HTTP/provider** num contrato único (`AiInvocationError`) com `kind` (`timeout` | `auth` | `rate_limit` | `capability` | `network` | `content_filter` | `provider_error`), `httpStatus`, `retryable`, `code` e `message` sanitizada (sem vazar chave/URL). **Erros de parsing do domínio** (ex.: `MalformedResponseError`) NÃO são normalizados pelo gateway — o orquestrador os classifica. Os gates de fallback existentes SHALL ser preservados exatamente:

- **Fallback de modelo (`target: "fallback"`)**: acionado quando `retryable === true` e há fallback configurado (diferente do primary). Os erros retryable atuais são `MalformedResponseError`, `ProviderRateLimitError`, `Provider5xxError`, `NetworkError` e `AbortError` — logo `rate_limit` e `timeout` **acionam** o fallback de modelo, como hoje.
- **Fallback técnico `images.edit`**: acionado **somente** por erro de `capability` do Responses e quando existe imagem primary.
- **Fallback técnico `json_object`**: acionado **somente** por erro de `capability` relacionado a `response_format`/`json_schema`.
- **Auth/configuração e safety**: **não** acionam fallback.

#### Scenario: Fallback de modelo por erro retryable

- **WHEN** a chamada primária de texto falha com erro retryable (`rate_limit`/`timeout`/`network`/5xx/`MalformedResponseError`) e há fallback configurado
- **THEN** o contrato expõe `retryable: true`
- **AND** o orquestrador aciona o alvo `fallback` (se diferente do primary)

#### Scenario: Erro de capability habilita fallback técnico

- **WHEN** a Responses API falha com erro de capability (`model_not_found`/tool não suportada) e há imagem primary
- **THEN** o contrato expõe `kind: "capability"`
- **AND** o orquestrador pode acionar o fallback técnico `images.edit` (nunca o fallback de modelo)

#### Scenario: Auth/configuração e safety não habilitam fallback

- **WHEN** a chamada falha com `kind: "auth"` ou `content_filter`/safety
- **THEN** o contrato expõe o `kind` correspondente
- **AND** o orquestrador NÃO aciona nenhum fallback (o erro propaga)

#### Scenario: Timeout preservado

- **WHEN** a chamada excede o tempo limite/abort
- **THEN** o contrato expõe `kind: "timeout"` e `retryable: true` (`AbortError`)
- **AND** o envelope registra `status: "timeout"` com `errorType` correspondente

#### Scenario: retryable preserva o gate atual

- **WHEN** a chamada falha com `httpStatus` 5xx ou 429
- **THEN** o contrato expõe `retryable: true`
- **AND** o retry/backoff e o fallback de modelo permanecem no serviço, como hoje

### Requirement: Um envelope de telemetria por tentativa HTTP real

Cada **tentativa HTTP real** executada pelo gateway SHALL emitir **exatamente um envelope de telemetria** — um `AiCallEnvelope extends AiCallInfo` com `capability`, `protocol`, `status` e `errorType` (o `AiCallInfo` legado permanece intacto durante a migração) — registrando `success`, `failed` ou `timeout`, com provider, **modelo real**, usage (ou `not_available`) e duração. A **persistência é best-effort** (`resolveAiCost` + `AiCostTracker`, fail-open por design) e SHALL NOT bloquear a geração. Quando um serviço/rota precisa de buffering ou ordenação, ele SHALL fornecer seu próprio sink, preservando o comportamento atual.

#### Scenario: Tentativa real gera exatamente um envelope

- **WHEN** uma tentativa HTTP é executada (com sucesso, falha ou timeout)
- **THEN** exatamente um envelope de telemetria é emitido
- **AND** o envelope registra o status correspondente (`success`/`failed`/`timeout`), `capability` e `protocol`

#### Scenario: Falha de persistência não bloqueia geração

- **WHEN** a gravação do evento falha
- **THEN** a geração prossegue (persistência best-effort)
- **AND** a falha é logada, nunca propagada

#### Scenario: Sink preserva buffering e ordenação

- **WHEN** a rota de assinatura visual invoca o gateway antes de a assinatura existir
- **THEN** o sink injetado bufferiza o evento até o `visual_signature_id` ser conhecido
- **AND** a ordem dos eventos por run é preservada

#### Scenario: Modelo real no evento

- **WHEN** a validação de entrada (gpt-4o) e a revisão (gpt-4o) emitem telemetria
- **THEN** o evento registra `gpt-4o` (modelo real)
- **AND** não registra o modelo de imagem (correção do furo de telemetria)

### Requirement: Preservação de retry, timeout e cancelamento

O gateway SHALL executar **uma tentativa** por invocação, sem retry/backoff e **sem fallback automático**. O retry, o backoff, o timeout global e os fallbacks SHALL permanecer nos serviços/rotas que já os implementam, como **segunda chamada explícita** ao gateway com o alvo indicado. O `AbortSignal` SHALL ser propagado ao adapter.

#### Scenario: Gateway não faz retry

- **WHEN** uma invocação falha
- **THEN** o gateway retorna o erro sem tentar novamente
- **AND** o retry é decidido pelo serviço/rota chamador

#### Scenario: Fallback é segunda chamada explícita

- **WHEN** a chamada primária falha e o orquestrador decide acionar um fallback
- **THEN** o orquestrador faz uma nova `invoke` explícita com o alvo (`target: "fallback"` no mesmo capability — alvo configurado, default inicial Gemini; ou `target: "primary"` num capability dedicado, ex. `campaign_image_edit`)
- **AND** cada chamada (primária e fallback) gera o seu próprio envelope de telemetria

#### Scenario: AbortSignal propagado

- **WHEN** o chamador fornece um `AbortSignal`
- **THEN** o adapter propaga o sinal à API do provider
- **AND** o cancelamento interrompe a chamada

### Requirement: Comportamento preservado durante a migração

A migração das capacidades SHALL preservar o comportamento observável: defaults idênticos, mesmos prompts, mesmos parâmetros (temperatura, max tokens, JSON mode), mesmo **alvo de fallback configurado** (default inicial Gemini para texto) e mesmas superfícies externas (contrato HTTP, schema, snapshot, domínio, UI).

#### Scenario: Fallback configurado preservado

- **WHEN** o alvo primário de texto falha de forma retryable e há fallback configurado (default inicial Gemini)
- **THEN** o orquestrador faz uma segunda `invoke` explícita no alvo `fallback`, sem conhecer o provider que o ocupa
- **AND** o resultado é equivalente ao comportamento atual, com dois envelopes de telemetria (primária + fallback)

#### Scenario: Contrato externo inalterado

- **WHEN** as suites de rota/schema/snapshot/domínio rodam após a migração
- **THEN** nenhuma asserção de contrato externo muda
