# Transactional Pipeline

> Synced from `fase-25-integracao-transacional-pipeline` (ADDED).

## Purpose

Pipeline de geração de imagem em 3 zonas (pré-stream, paralelo, pós) com reserva e estorno de créditos, execução paralela Copy Director ∥ Image Director, retry seletivo com fallback Gemini, e idempotência.

## Requirements

### Requirement: Pipeline em 3 zonas (pré-stream, paralelo, pós)

O sistema SHALL estruturar o handler `POST /api/campaign/generate-image` em três zonas com responsabilidades distintas:

**PRÉ-STREAM (síncrono, fora do ReadableStream):** parse + auth + ownership + **legal clearance (inclui reaceite v1.2)** + **campaignIntent guard** + rate limit + saldo check + input validation + criar campanha + reservar crédito. Produz Response HTTP direto (400, 401, 403, 429, 402, 409, 500). Nunca chama IA paga se alguma condição falhar.

O pré-stream SHALL incluir `campaignIntent` (default "offer") e `preserveImageContext` (normalizado para false quando offer) no `inputSnapshot` ao criar a campanha.

**PARALELO (dentro do ReadableStream):** Copy Director ∥ Image Director com retry seletivo. Produz NDJSON events de progresso.

**PÓS-PARALELO (dentro do ReadableStream):** Merge → transcode → upload → updateReady → confirma crédito. Produz NDJSON result ou error com estorno.

#### Scenario: Saldo insuficiente retorna 402 antes do stream

- **WHEN** `POST /api/campaign/generate-image` é chamado com saldo < 1
- **THEN** retorna HTTP 402 Payment Required
- **AND** Nenhuma chamada de IA é feita
- **AND** Nenhum evento NDJSON é emitido

#### Scenario: Rate limit excedido retorna 429 antes do stream

- **WHEN** `POST /api/campaign/generate-image` é chamado e rate limit (10/h ou 30/dia) está excedido
- **THEN** retorna HTTP 429 Too Many Requests
- **AND** Nenhuma chamada de IA é feita

#### Scenario: Fluxo completo com saldo suficiente e rate limit OK

- **WHEN** `POST /api/campaign/generate-image` é chamado com saldo suficiente e rate limit OK
- **THEN** rate limit guard passa
- **AND** tentativa é registrada em `generation_rate_events`
- **AND** saldo check passa
- **AND** campanha é criada com status `generating`
- **AND** 1 crédito é reservado via `reserveCredit`
- **AND** Copy Director + Image Director executam em paralelo
- **AND** NDJSON events de progresso são emitidos
- **AND** ao finalizar, campanha fica com status `ready`
- **AND** `publication_copy_snapshot` contém resultado do Copy Director
- **AND** NDJSON result é emitido com `campaignId` e `campaignUrl`

#### Scenario: Legal clearance fails returns 403 before rate limit

- **WHEN** `POST /api/campaign/generate-image` é chamado com legal clearance pendente
- **THEN** retorna HTTP 403 Forbidden
- **AND** Nenhuma chamada de IA é feita
- **AND** Nenhum rate limit check é executado

#### Scenario: Legal clearance bloqueia sem v1.2 (ADDED F32)

- **WHEN** `POST /api/campaign/generate-image` é chamado
- **AND** loja não aceitou `terms_of_service` v1.2
- **THEN** retorna HTTP 403 antes de qualquer operação (rate limit, saldo, IA)

#### Scenario: Legal clearance passes continues normally

- **WHEN** `POST /api/campaign/generate-image` é chamado com legal clearance ok
- **THEN** rate limit guard é executado
- **AND** fluxo normal do pipeline prossegue

#### Scenario: Request com intent != offer é rejeitado no pré-stream

- **WHEN** o body contém `campaignIntent: "spotlight"` ou `"exclusive"`
- **THEN** o pré-stream retorna HTTP 400
- **AND** a mensagem de erro informa que apenas ofertas podem ser geradas no momento
- **AND** nenhuma operação de IA, saldo ou criação de campanha é executada

#### Scenario: InputSnapshot inclui campaignIntent e preserveImageContext

- **WHEN** o body contém `campaignIntent: "offer"` e `preserveImageContext: true`
- **THEN** o `inputSnapshot` contém `campaignIntent: "offer"`
- **AND** `preserveImageContext` é normalizado para `false` ou omitido

#### Scenario: Pipeline regression — generation with clearance succeeds

- **WHEN** `POST /api/campaign/generate-image` é chamado com legal clearance ok e saldo suficiente
- **THEN** a geração prossegue e completa normalmente (regressão zero)

### Requirement: COST_PER_GENERATION fixo em 1

O sistema SHALL definir `COST_PER_GENERATION = 1` em `src/lib/image-generation/config.ts`, fixo para todas as gerações na v1.5.

#### Scenario: Constante definida em config

- **WHEN** `COST_PER_GENERATION` é importado de `@/lib/image-generation/config`
- **THEN** seu valor é `1`

### Requirement: Execução paralela Copy Director ∥ Image Director

O sistema SHALL executar `CopyDirectorService.generateCopy()` e `ImageGenerationService.generateImage()` em paralelo via `Promise.all`, já que copy (texto) não influencia a arte (imagem).

#### Scenario: Ambos executam em paralelo

- **WHEN** o pipeline atinge a zona paralela
- **THEN** Copy Director e Image Director são chamados simultaneamente
- **AND** o resultado de ambos é mergeado ao final

#### Scenario: Um ramo falha → estorno + campanha error

- **WHEN** Copy Director OU Image Director falha (após retries)
- **THEN** o ramo remanescente é abortado via `AbortController`
- **AND** `refundCredit` é chamado com idempotência
- **AND** campanha é atualizada para status `error`
- **AND** NDJSON error é emitido

#### Scenario: Ambos falham → estorno único

- **WHEN** ambos Copy Director e Image Director falham
- **THEN** `refundCredit` é chamado uma única vez (idempotente)
- **AND** campanha é atualizada para status `error`

### Requirement: Retry seletivo do Copy Director com fallback Gemini

O sistema SHALL implementar retry seletivo no Copy Director com até 2 tentativas:

| Tentativa | Provider | Quando |
|-----------|----------|--------|
| 1ª | Primário (OpenAI GPT-4o) | Sempre |
| 2ª | Alternativo (Gemini) | Se 1ª falhou com erro retryable |

O sistema SHALL classificar erros como retryable (timeout, rate limit do provider, 5xx, `MalformedResponseError`, falha de rede) e não retryable (ZodError, SafetyBlockError, InputConflictError, AuthConfigError, PayloadTooLargeError).

O sistema SHALL usar `AbortSignal` para abortar o ramo remanescente quando um ramo falha definitivamente.

#### Scenario: Copy falha retryable → retry Gemini OK → ready

- **WHEN** Copy Director falha na 1ª tentativa com erro retryable
- **THEN** retry com Gemini como fallback é tentado
- **AND** se o retry for bem-sucedido, campanha fica `ready` (1 crédito cobrado)

#### Scenario: Copy falha retryable → retry Gemini falha → estorno

- **WHEN** Copy Director falha na 1ª tentativa (retryable) e retry Gemini também falha
- **THEN** `refundCredit` é chamado
- **AND** campanha fica `error`

#### Scenario: Copy falha não retryable → estorno imediato

- **WHEN** Copy Director falha com erro não retryable (ex: SafetyBlockError)
- **THEN** falha é imediata — sem retry
- **AND** `refundCredit` é chamado

#### Scenario: Image Director sem retry externo

- **WHEN** Image Director falha (retry interno esgotado)
- **THEN** ramo falha definitivamente
- **AND** estorno ocorre — sem retry externo adicional

### Requirement: Persistência falha após merge → estorno + limpeza

O sistema SHALL, se a persistência (transcode, upload, updateReady) falhar após o merge bem-sucedido dos dois ramos, executar compensação: limpar imagem do storage, atualizar campanha para `error` e estornar o crédito.

#### Scenario: Upload falha → estorno + limpa storage

- **WHEN** transcode/upload falha após Copy e Image terem sucesso
- **THEN** a imagem enviada (se alguma) é removida do storage
- **AND** campanha é atualizada para status `error`
- **AND** `refundCredit` é chamado

### Requirement: Reserva e estorno idempotentes

O sistema SHALL garantir idempotência na reserva (`reserve_${campaignId}`) e no estorno (`refund_${txId}`) usando chaves de idempotência.

#### Scenario: Reserva idempotente

- **WHEN** `reserveCredit` é chamado duas vezes com a mesma `reserve_${campaignId}`
- **THEN** a segunda chamada retorna a mesma transação sem duplicar

#### Scenario: Refund idempotente

- **WHEN** `refundCredit` é chamado duas vezes com a mesma `refund_${txId}`
- **THEN** a segunda chamada retorna o mesmo refund sem duplicar

### Requirement: AbortSignal propagado para TextProvider

O sistema SHALL propagar o `AbortSignal` recebido pelo `CopyDirectorService.generateCopy()` para `TextProvider.generateText()`, permitindo que o ramo Copy seja abortado quando o Image Director falha (e vice-versa).

#### Scenario: generateCopy propaga signal

- **WHEN** `generateCopy(input, { signal })` é chamado com um `AbortSignal`
- **THEN** o signal é repassado para `provider.generateText(prompt, { ..., signal })`

### Requirement: Launch config checks no início do pré-stream

O sistema SHALL verificar as flags de launch config no início do handler `POST /api/campaign/generate-image`, antes de qualquer operação:

1. `generationPaused` → HTTP 503, sem qualquer operação
2. `v15Enabled` → master switch; quando false, pipeline roda como v1.4 (sem crédito, sem Copy Director, sem rate limit)
3. `rateLimitEnabled` → guard opcional
4. `creditsChargingEnabled` → saldo check opcional
5. `copyDirectorEnabled` → Copy Director opcional

#### Scenario: generationPaused=true → 503 antes de tudo

- **WHEN** `VENDEO_GENERATION_PAUSED=true` está configurado
- **AND** `POST /api/campaign/generate-image` é chamado
- **THEN** retorna HTTP 503 com mensagem "Geração temporariamente indisponível."
- **AND** nenhuma operação é executada (sem log, sem telemetria, sem consulta de saldo, sem IA)

#### Scenario: v15Enabled=false → pipeline v1.4

- **WHEN** `VENDEO_V15_ENABLED=false` está configurado
- **AND** `POST /api/campaign/generate-image` é chamado
- **THEN** pipeline ignora `creditsChargingEnabled`, `copyDirectorEnabled`, `rateLimitEnabled`
- **AND** pipeline não verifica saldo (`getBalance`/`reserveCredit`)
- **AND** pipeline não chama `CopyDirectorService` (usa fallback determinístico)
- **AND** pipeline não aplica rate limit
- **AND** pipeline gera campanha com comportamento equivalente a v1.4

#### Scenario: creditsChargingEnabled=false → sem verificação de saldo

- **WHEN** `VENDEO_CREDITS_CHARGING_ENABLED=false` está configurado
- **AND** `VENDEO_V15_ENABLED=true`
- **THEN** pipeline não chama `getBalance()` nem `reserveCredit()`
- **AND** toda geração prossegue sem verificação de saldo

#### Scenario: copyDirectorEnabled=false → fallback determinístico

- **WHEN** `VENDEO_COPY_DIRECTOR_ENABLED=false` está configurado
- **AND** `VENDEO_V15_ENABLED=true`
- **THEN** pipeline não chama `CopyDirectorService.generateCopy()`
- **AND** `publication_copy_snapshot` é populado via `buildPublicationCopySnapshot()` determinístico

### Requirement: traceId gerado por request

O sistema SHALL gerar um `traceId` via `randomUUID()` no início de cada request a `POST /api/campaign/generate-image` e propagá-lo em todas as chamadas a `logPipelineEvent()` e inserts de telemetria.

#### Scenario: traceId único por request

- **WHEN** dois requests simultâneos chegam a `POST /api/campaign/generate-image`
- **THEN** cada request tem um `traceId` diferente

#### Scenario: traceId presente em logs e telemetria

- **WHEN** o pipeline executa com sucesso
- **THEN** todos os eventos de log emitidos contêm o mesmo `traceId`
- **AND** os registros em `generation_events` contêm o mesmo `trace_id`

### Requirement: Logging estruturado em todas as etapas

O sistema SHALL emitir `logPipelineEvent()` em todas as etapas do pipeline (pré-stream, paralelo, pós-paralelo), com eventos `running` e `complete|failed` para cada etapa.

#### Scenario: Pré-stream inteiro logado

- **WHEN** o pré-stream executa com sucesso
- **THEN** eventos são emitidos para: `rate_limit_check`, `balance_check`, `campaign_create`, `credit_reserve`
- **AND** cada etapa tem ao menos 1 evento `running` e 1 `complete`

#### Scenario: Paralelo inteiro logado

- **WHEN** os ramos paralelos executam com sucesso
- **THEN** eventos são emitidos para: `copy_generation`, `image_generation`
- **AND** cada etapa tem ao menos 1 evento `running` e 1 `complete`

#### Scenario: Pós-paralelo inteiro logado

- **WHEN** o pós-paralelo executa com sucesso
- **THEN** eventos são emitidos para: `merge`, `upload`, `update_ready`, `credit_confirm`
- **AND** cada etapa tem ao menos 1 evento `running` e 1 `complete`

#### Scenario: Etapa com erro tem evento failed

- **WHEN** qualquer etapa do pipeline falha
- **THEN** um evento com `status: "failed"`, `errorCode` e `errorMessage` é emitido para aquela etapa

### Requirement: Telemetria persistida no pipeline

O sistema SHALL persistir telemetria em `generation_events` após:
- Copy Director completar ou falhar (`campaign_copy`)
- Image Director completar ou falhar (`campaign_image`)
- Pipeline completo finalizar (`campaign_pipeline`)

A inserção SHALL ser best-effort (try/catch), nunca bloqueando o pipeline.

#### Scenario: Telemetria após Copy Director

- **WHEN** Copy Director completa com sucesso
- **THEN** um registro `campaign_copy` é inserido em `generation_events` com tokens, custo, modelo, provedor

#### Scenario: Telemetria após Image Director

- **WHEN** Image Director completa com sucesso
- **THEN** um registro `campaign_image` é inserido em `generation_events` com custo, modelo, provedor

#### Scenario: Telemetria pipeline completo

- **WHEN** o pipeline finaliza (sucesso)
- **THEN** um registro `campaign_pipeline` é inserido em `generation_events` com custo total, duração total, metadata dos ramos

#### Scenario: Falha de INSERT não quebra pipeline

- **WHEN** o INSERT em `generation_events` falha (ex: timeout de rede)
- **THEN** o erro é logado via `console.error`
- **AND** o pipeline continua normalmente
- **AND** o usuário recebe a resposta normalmente

### Requirement: Log e telemetria sem dados sensíveis

O sistema SHALL garantir que nenhum evento de log ou registro de telemetria contenha:
- Imagens em base64
- Prompt completo enviado ao provider
- Dados sensíveis (senhas, tokens, API keys)

#### Scenario: Prompt completo não vaza

- **WHEN** `logPipelineEvent()` ou INSERT de telemetria inclui dados do prompt
- **THEN** o prompt completo nunca está presente nos campos emitidos

### Requirement: Mapper CampaignBrief → CopyDirectorInput

O sistema SHALL prover uma função `mapBriefToCopyDirectorInput(brief, input)` que monta o `CopyDirectorInput` a partir do `CampaignBrief` + dados do formulário, incluindo `buildOfferText()` para montar o texto da oferta a partir de `badgeText`, `originalPriceCents` e `discountedPriceCents`.

#### Scenario: mapBriefToCopyDirectorInput com input completo

- **WHEN** `mapBriefToCopyDirectorInput` é chamado com brief e input completos
- **THEN** retorna `CopyDirectorInput` com todos os campos mapeados
- **AND** `offer` contém o texto montado com badge + preços
- **AND** `mandatoryArtworkText` NÃO está presente no resultado
