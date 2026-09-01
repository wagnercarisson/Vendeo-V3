# Transactional Pipeline

> Synced from `fase-25-integracao-transacional-pipeline` (ADDED).
> Modified by `fase-38-credit-operation-costs` (MODIFIED + ADDED). `COST_PER_GENERATION` removed from `config.ts`; pre-stream pipeline resolves `campaign_generation` cost dynamically via `OperationCostService` (D12).
> Modified by `fase-38-1-ai-cost-accounting` (MODIFIED). Pipeline adopts `AiCostTracker` as the sole cost-telemetry write path (`operation_run_id` + `trace_id`); all call-level events recorded with granular attempt/duration; `campaign_pipeline` delivery marker carries NULL cost/tokens.
> Modified by `fase-39-brief-estruturado-campanha` (D11): `mapBriefToCopyDirectorInput` passa a ler do **domínio estruturado** (`brief.product`/`brief.commercial`) em vez do corpo flat. Saída `CopyDirectorInput` **inalterada**. `validity.displayText` propagado quando habilitado (D8); aviso legal (`legalNotice`) **não** entra no copy (fronteira copy × arte preservada).
> Modified by `fase-41-midia-de-campanha-mobile` (D2/D5/D10): a validação de imagem no pré-stream evolui para a **regra de exclusividade/compatibilidade** (400) + **limites por item/teto agregado** (413); o pré-stream **pré-gera o `campaignId`**, faz o **upload dos inputs** antes de montar o snapshot e chama `createCampaign` com o id pré-gerado (D5); falha pré-stream → `removeCampaignInputs` (sem órfãos).

## Purpose

Pipeline de geração de imagem em 3 zonas (pré-stream, paralelo, pós) com reserva e estorno de créditos, execução paralela Copy Director ∥ Image Director, retry seletivo com fallback Gemini, e idempotência.

## Requirements

### Requirement: Pipeline em 3 zonas (pré-stream, paralelo, pós)

O sistema SHALL estruturar o handler `POST /api/campaign/generate-image` em três zonas com responsabilidades distintas:

**PRÉ-STREAM (síncrono, fora do ReadableStream):** parse + auth + ownership + **legal clearance (inclui reaceite v1.2)** + **campaignIntent guard** + rate limit + saldo check + **regra de exclusividade de imagem + limites (400/413 — D2/D10)** + input validation + **pré-geração do `campaignId` + upload dos inputs + montagem do snapshot com `storagePath`** + criar campanha + reservar crédito. Produz Response HTTP direto (400, 401, 403, 429, 402, 409, 413, 500). Nunca chama IA paga se alguma condição falhar.

**F41 D2/D10 — validação de imagem no pré-stream:**
- **Exclusividade:** `productImages` presente + `productImageDataUrl` ausente → usa `productImages` (exatamente 1 `primary` — invariante do transporte); legado `productImageDataUrl` → equivalente a 1 primary/upload; **ambos ausentes → 400** "Imagem do produto é obrigatória"; **ambos presentes → 400** (payload ambíguo).
- **Limites:** cada `dataUrl` do `productImages[]` ≤ `MAX_PRODUCT_IMAGE_BASE64_SIZE`; **teto agregado** (soma dos dataUrls) ≤ limite agregado → senão **413** PT-BR indicando item/total. O limite legado single permanece para `productImageDataUrl`.

**F41 D5 — persistência de inputs antes do snapshot (mudança de ordem):**
1. **Pré-gera o `campaignId`** na rota (`crypto.randomUUID()`);
2. **Gera/normaliza um `id` por imagem** (uuid — o cliente não envia id, D2);
3. Faz o **upload dos inputs** (`{storeId}/{campaignId}/inputs/{imageId}.jpg`) via `uploadCampaignInputImage`;
4. Monta o snapshot **com `storagePath` por imagem**;
5. Chama `createCampaign(storeId, input, campaignIdPreGerado)` (assinatura com parâmetro opcional — D5);
6. **Limpeza pré-stream:** falha no upload de inputs ou no fluxo pré-stream → `removeCampaignInputs` (remove objetos já enviados, sem órfãos).

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

#### Scenario: Payload ambíguo retorna 400 no pré-stream (D2)

- **WHEN** o body contém **ambos** `productImageDataUrl` e `productImages`
- **THEN** retorna HTTP 400 (payload ambíguo — mutuamente exclusivos)
- **AND** nenhuma operação de IA, saldo, upload de inputs ou criação de campanha é executada

#### Scenario: Ausência de imagem retorna 400 no pré-stream (D2)

- **WHEN** o body não contém `productImageDataUrl` E não contém `productImages`
- **THEN** retorna HTTP 400 "Imagem do produto é obrigatória"
- **AND** nenhuma operação posterior é executada

#### Scenario: Teto agregado excedido retorna 413 no pré-stream (D10)

- **WHEN** a soma dos dataUrls do `productImages[]` excede o teto agregado (ou um item excede `MAX_PRODUCT_IMAGE_BASE64_SIZE`)
- **THEN** retorna HTTP 413 com mensagem PT-BR indicando o limite
- **AND** nenhuma operação posterior é executada

#### Scenario: Upload de inputs pré-snapshot com campaignId pré-gerado (D5)

- **WHEN** o pré-stream valida a imagem e prossegue
- **THEN** o `campaignId` é **pré-gerado** na rota
- **AND** os inputs sobem em `{storeId}/{campaignId}/inputs/{imageId}.jpg` **antes** de montar o snapshot
- **AND** o snapshot carrega `storagePath` por imagem
- **AND** `createCampaign` recebe o `campaignId` pré-gerado

#### Scenario: Falha pré-stream remove inputs já enviados (D5)

- **WHEN** o upload de inputs falha no meio (ou o fluxo pré-stream falha após alguns uploads)
- **THEN** `removeCampaignInputs` remove os objetos já enviados
- **AND** nenhum input órfão permanece no storage

#### Scenario: Fluxo completo com saldo suficiente e rate limit OK

- **WHEN** `POST /api/campaign/generate-image` é chamado com saldo suficiente e rate limit OK
- **THEN** rate limit guard passa
- **AND** tentativa é registrada em `generation_rate_events`
- **AND** saldo check passa
- **AND** campanha é criada com status `generating` (com `campaignId` pré-gerado e snapshot com `storagePath` dos inputs)
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

#### Scenario: InputSnapshot inclui campaignIntent e preserveImageContext

- **WHEN** o body contém `campaignIntent: "offer"` e `preserveImageContext: true`
- **THEN** o `inputSnapshot` contém `campaignIntent: "offer"`
- **AND** `preserveImageContext` é normalizado para `false` ou omitido

#### Scenario: Pipeline regression — generation with clearance succeeds

- **WHEN** `POST /api/campaign/generate-image` é chamado com legal clearance ok e saldo suficiente
- **THEN** a geração prossegue e completa normalmente (regressão zero)

### Requirement: COST_PER_GENERATION fixo em 1

> **Delta F38 (D12):** O sistema SHALL **remover** `COST_PER_GENERATION` de `src/lib/image-generation/config.ts`. O custo da geração de campanha passa a ser resolvido em runtime por `OperationCostService.getCost("campaign_generation")` (fonte: `credit_operation_costs`; fallback seguro 1 crédito quando linha inexistente — D5). Nenhum import de `COST_PER_GENERATION` pode restar no código.

O sistema SHALL definir o custo da geração de campanha dinamicamente via `OperationCostService` (D12), em vez de uma constante fixa em código.

#### Scenario: Constante removida de config

- **WHEN** `src/lib/image-generation/config.ts` é inspecionado
- **THEN** `COST_PER_GENERATION` NÃO existe

#### Scenario: Nenhum import restante

- **WHEN** o código é varrido por imports de `COST_PER_GENERATION`
- **THEN** nenhum import restante é encontrado

#### Scenario: Custo resolvido pelo OperationCostService

- **WHEN** a rota `generate-image` precisa do custo de geração
- **THEN** chama `OperationCostService.getCost("campaign_generation")` (fonte tabela ou fallback)

### Requirement: Pipeline pré-stream resolve custo via OperationCostService

> **Delta F38 (D12):** O pipeline pré-stream do `POST /api/campaign/generate-image` SHALL passar a resolver o custo de `campaign_generation` **uma única vez por request, após auth/ownership/readiness/rate guards e antes do saldo check** (evita leitura de custo antes de validar usuário/loja). O custo é dinâmico (`OperationCostService.getCost`), o balance check é `balance < cost.costCredits`, e a reserva usa `cost.costCredits` com metadata snapshot (`operation_key`, `operation_cost_credits`, `operation_cost_source`).

O sistema SHALL manter a estrutura de 3 zonas do pipeline de geração de campanha (pré-stream, paralelo, pós), com a resolução de custo dinâmica no pré-stream:

**PRÉ-STREAM (síncrono, fora do ReadableStream):** parse + auth + ownership + legal clearance (inclui reaceite v1.2) + campaignIntent guard + rate limit + **resolver custo `campaign_generation` (após os guards, antes do saldo)** + saldo check + input validation + criar campanha + reservar crédito. Produz Response HTTP direto (400, 401, 403, 429, 402, 409, 500). Nunca chama IA paga se alguma condição falhar.

#### Scenario: Saldo insuficiente retorna 402 antes do stream

- **WHEN** `POST /api/campaign/generate-image` é chamado com `balance < cost.costCredits`
- **THEN** retorna HTTP 402 Payment Required
- **AND** Nenhuma chamada de IA é feita
- **AND** Nenhum evento NDJSON é emitido

#### Scenario: Fluxo completo com saldo suficiente e rate limit OK

- **WHEN** `POST /api/campaign/generate-image` é chamado com saldo suficiente e rate limit OK
- **THEN** rate limit guard passa
- **AND** tentativa é registrada em `generation_rate_events`
- **AND** saldo check passa (contra `cost.costCredits` dinâmico)
- **AND** campanha é criada com status `generating`
- **AND** `cost.costCredits` é reservado via `reserveCredit` com metadata snapshot (`operation_key`, `operation_cost_credits`, `operation_cost_source`)
- **AND** Copy Director + Image Director executam em paralelo
- **AND** NDJSON events de progresso são emitidos
- **AND** ao finalizar, campanha fica com status `ready`
- **AND** `publication_copy_snapshot` contém resultado do Copy Director
- **AND** NDJSON result é emitido com `campaignId` e `campaignUrl`

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

> **Delta F38.1 (D1/D7):** O pipeline passa a usar o `AiCostTracker` como **único caminho de escrita** de telemetria de custo. `tracker.startRun("campaign_delivery")` no início do request gera `operation_run_id` (UUID, agrupador econômico) + `trace_id` (rastreio técnico) **distintos**; ambos são propagados a todas as chamadas filhas via contexto `opts.telemetry`. O `operation_run_id` cobre **todas as tentativas** da entrega (validação → copy → imagem → revisão → recomposição) até a aprovação final. Nesta fase, o run é criado por request e reutilizado nas regenerações **internas** do loop de qualidade/revisão (attempt 2..n). O reaproveitamento do mesmo `operation_run_id` em um request **posterior** de reprovação/recomposição explícita do usuário (F37) é **preparado** nesta fase: a rota persiste o `operation_run_id` na campanha (`campaigns.operation_run_id` — coluna adicionada na migration, D2) no momento da criação, de modo que a F37 possa reabrir o mesmo run ao re-compor a campanha. A mecânica de reabertura cross-request em si é escopo da F37 — nesta fase a coluna nasce preenchida e disponível.

#### Scenario: traceId único por request

- **WHEN** dois requests simultâneos chegam a `POST /api/campaign/generate-image`
- **THEN** cada request tem um `traceId` diferente

#### Scenario: operation_run_id propagado da rota até imagem/review/copy

- **WHEN** o pipeline executa com sucesso
- **THEN** todos os eventos call-level gravados (copy, input_validation, image, image_review) compartilham o mesmo `operation_run_id`
- **AND** o delivery marker `campaign_pipeline` usa o mesmo `operation_run_id`

#### Scenario: regeneração mantém o mesmo operation_run_id

- **WHEN** a revisão reprova e o pipeline recompoe/regenera (attempt 2..n)
- **THEN** os novos eventos usam o **mesmo** `operation_run_id` (sem novo run — D1)

#### Scenario: operation_run_id persistido na campanha na criação

- **WHEN** o pipeline cria uma campanha com sucesso
- **THEN** `campaigns.operation_run_id` da campanha é igual ao `operation_run_id` dos eventos do run (persistido na criação — preparo reuso F37, D1/D2)

#### Scenario: request posterior nesta fase ainda cria novo run

- **WHEN** um request independente posterior reprova/recompõe a campanha (nesta fase, sem a mecânica F37 de reabertura)
- **THEN** um novo `operation_run_id` é criado para esse request (mesmo run apenas dentro do request/loop interno — D1)

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

> **Delta F38.1 (D5/D7):** O pipeline passa a gravar **todas** as chamadas call-level via `AiCostTracker` (substituindo os 4 inserts inline): `campaign_copy`, `campaign_input_validation`, `campaign_image` e `campaign_image_review` (furo 4 sanado — revisão e validação não somem mais). O delivery `campaign_pipeline` é gravado **sem custo e sem tokens** (anti-dupla-contagem D1/D6).

#### Scenario: Telemetria após Copy Director

- **WHEN** Copy Director completa com sucesso
- **THEN** um registro `campaign_copy` é inserido em `generation_events` com **usage real** e `estimated_cost_usd` preenchido (furo 1 sanado)

#### Scenario: Telemetria após Image Director

- **WHEN** Image Director completa com sucesso
- **THEN** um registro `campaign_image` é inserido em `generation_events` com custo, modelo, provedor

#### Scenario: Telemetria de revisão e validação registrada

- **WHEN** o pipeline executa input validation (vision) e image review (vision)
- **THEN** registros `campaign_input_validation` e `campaign_image_review` são inseridos com custo/tokens (furo 4 sanado)

#### Scenario: Telemetria pipeline completo (delivery marker)

- **WHEN** o pipeline finaliza (sucesso)
- **THEN** um registro `campaign_pipeline` é inserido com `duration_ms` (pipeline), `metadata.duration_is_pipeline: true` e **custo/tokens NULL** (anti-dupla-contagem D1/D6)

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

O sistema SHALL prover uma função `mapBriefToCopyDirectorInput(brief: CampaignBrief, input)` que monta o `CopyDirectorInput` a partir do domínio estruturado + dados do formulário, incluindo `buildOfferText()` para montar o texto da oferta a partir de `badgeText`, `originalPriceCents` e `discountedPriceCents`.

> Modified by `fase-39-brief-estruturado-campanha` (D11): a função passa a receber/ler o `CampaignBrief` **de domínio estruturado** (produto/oferta separados) e monta o `CopyDirectorInput` a partir de `brief.product`/`brief.commercial`.

- `productName` lido de `brief.product.name`; `intent` de `brief.commercial.intent`; preços/badge de `brief.commercial.*` (D11)
- `validity.displayText` propagado para o copy **quando** `brief.commercial.validity?.enabled === true` (D8)
- `legalNotice` **não** entra no `CopyDirectorInput` (fronteira copy × texto obrigatório preservada — `mandatory-artwork-text`)
- A saída `CopyDirectorInput` permanece **equivalente** à produzida pelo fluxo flat atual para o mesmo input (D11)

#### Scenario: mapBriefToCopyDirectorInput com input completo

- **WHEN** `mapBriefToCopyDirectorInput` é chamado com um `CampaignBrief` estruturado e input completos
- **THEN** retorna `CopyDirectorInput` com todos os campos mapeados
- **AND** `offer` contém o texto montado com badge + preços
- **AND** `legalNotice`/`mandatoryArtworkText` NÃO está presente no resultado

#### Scenario: CopyDirectorInput equivalente ao fluxo flat atual

- **WHEN** o mesmo payload flat de hoje é convertido para `CampaignBrief` e passado a `mapBriefToCopyDirectorInput`
- **THEN** o `CopyDirectorInput` resultante é equivalente ao produzido pelo fluxo flat atual (D11 — regressão preservada)

#### Scenario: validade propaga no copy quando habilitada

- **WHEN** `brief.commercial.validity = { enabled: true, displayText: "válida até 30/09" }`
- **THEN** o texto de validade entra no contexto do Copy Director (D8)

#### Scenario: legalNotice não entra no copy

- **WHEN** um brief tem `commercial.legalNotice` preenchido
- **THEN** o `CopyDirectorInput` NÃO contém o texto do aviso legal (fronteira copy × arte mantida)

### Requirement: Attempt granular e duration_ms por chamada

O sistema SHALL registrar, nos eventos call-level do pipeline, o `attempt_number` granular e o `duration_ms` da chamada individual.

> **Delta F38.1 (D6/D11):** O `attempt_number` passa a refletir a tentativa **real** do loop de revisão/recomposição (furo 6 sanado): `campaign_image` e `campaign_image_review` gravam `attempt_number` 1..n conforme o `generateWithRetry` avança. O `duration_ms` passa a ser a duração da **chamada individual** (furo 7 sanado), medido no ponto de execução de cada chamada — não o pipeline inteiro.

#### Scenario: review gravado por tentativa com attempt 1..n

- **WHEN** a revisão reprova na tentativa 1 e passa na tentativa 2
- **THEN** existem eventos `campaign_image_review` com `attempt_number: 1` e `attempt_number: 2` (furo 6 sanado)

#### Scenario: duration_ms por chamada (copy ≠ pipeline)

- **WHEN** o pipeline roda copy e imagem
- **THEN** `campaign_copy.duration_ms` é a duração da chamada de copy (não o pipeline inteiro — furo 7 sanado)

### Requirement: metadata.totalCost correto

O sistema SHALL gravar `metadata.totalCost` do evento `campaign_pipeline` como a soma real das chamadas do run.

> **Delta F38.1 (D7):** O `metadata.totalCost` do delivery `campaign_pipeline` passa a gravar a **soma real das chamadas** em USD (via `resolveAiCost`), em vez do nome do provider (furo 2 sanado). **Ressalva anti-dupla-contagem:** `metadata.totalCost` é **metadata operacional** — as views e o RPC de apuração (`admin_ai_*`, `admin_cost_vs_credits`, `admin_get_ai_costs`) **NUNCA usam `metadata.totalCost` como fonte contábil**; o valor contábil é sempre somado a partir dos eventos call-level (`COALESCE(provider_reported_cost_usd, estimated_cost_usd)`) por `operation_run_id` (D1/D6/D10).

#### Scenario: totalCost = soma real das chamadas

- **WHEN** o pipeline conclui com copy (0.01) + image (0.02) + review (0.007)
- **THEN** `metadata.totalCost` do `campaign_pipeline` é `0.037` (soma numérica, não nome do provider — furo 2 sanado)

### Requirement: Reconciliação via views — anti-dupla-contagem

O sistema SHALL garantir que a apuração de custo da entrega via views some apenas eventos call-level.

> **Delta F38.1 (D10):** O custo e a duração econômicos da entrega são apurados **exclusivamente** somando eventos call-level por `operation_run_id` nas views (`admin_ai_operation_costs`, `admin_campaign_delivery_costs`, etc.). O delivery marker tem custo/tokens NULL — nenhum valor é contado duas vezes.

#### Scenario: delivery marker com custo/tokens NULL

- **WHEN** o evento `campaign_pipeline` é inspecionado
- **THEN** `estimated_cost_usd`/`provider_reported_cost_usd` e tokens são NULL
- **AND** o custo da entrega via view = soma dos eventos call-level (anti-dupla-contagem D1/D6/D10)
