## ADDED Requirements

### Requirement: Pipeline em 3 zonas (pré-stream, paralelo, pós)

O sistema SHALL estruturar o handler `POST /api/campaign/generate-image` em três zonas com responsabilidades distintas:

**PRÉ-STREAM (síncrono, fora do ReadableStream):** parse + auth + ownership + rate limit + saldo check + input validation + criar campanha + reservar crédito. Produz Response HTTP direto (400, 401, 403, 429, 402, 409, 500). Nunca chama IA paga se alguma condição falhar.

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

### Requirement: Mapper CampaignBrief → CopyDirectorInput

O sistema SHALL prover uma função `mapBriefToCopyDirectorInput(brief, input)` que monta o `CopyDirectorInput` a partir do `CampaignBrief` + dados do formulário, incluindo `buildOfferText()` para montar o texto da oferta a partir de `badgeText`, `originalPriceCents` e `discountedPriceCents`.

#### Scenario: mapBriefToCopyDirectorInput com input completo

- **WHEN** `mapBriefToCopyDirectorInput` é chamado com brief e input completos
- **THEN** retorna `CopyDirectorInput` com todos os campos mapeados
- **AND** `offer` contém o texto montado com badge + preços
- **AND** `mandatoryArtworkText` NÃO está presente no resultado
