# Transactional Pipeline

> Delta spec for `fase-41-midia-de-campanha-mobile` (D2/D5/D10).

## MODIFIED Requirements

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
