## MODIFIED Requirements

### Requirement: Pipeline em 3 zonas (pré-stream, paralelo, pós)

O sistema SHALL estruturar o handler `POST /api/campaign/generate-image` em três zonas com responsabilidades distintas:

**PRÉ-STREAM (síncrono, fora do ReadableStream):** parse + auth + ownership + legal clearance + campaignIntent guard + rate limit + saldo check + input validation + criar campanha + reservar crédito. Produz Response HTTP direto (400, 401, 403, 429, 402, 409, 500). Nunca chama IA paga se alguma condição falhar.

O pré-stream SHALL incluir `campaignIntent` (default "offer") e `preserveImageContext` (normalizado para false quando offer) no `inputSnapshot` ao criar a campanha.

**PARALELO (dentro do ReadableStream):** Copy Director ∥ Image Director com retry seletivo. Produz NDJSON events de progresso.

**PÓS-PARALELO (dentro do ReadableStream):** Merge → transcode → upload → updateReady → confirma crédito. Produz NDJSON result ou error com estorno.

#### Scenario: Request com intent != offer é rejeitado no pré-stream

- **WHEN** o body contém `campaignIntent: "spotlight"` ou `"exclusive"`
- **THEN** o pré-stream retorna HTTP 400
- **AND** a mensagem de erro informa que apenas ofertas podem ser geradas no momento
- **AND** nenhuma operação de IA, saldo ou criação de campanha é executada

#### Scenario: InputSnapshot inclui campaignIntent e preserveImageContext (apenas offer transita)

- **WHEN** o body contém `campaignIntent: "offer"` e `preserveImageContext: true`
- **THEN** o `inputSnapshot` contém `campaignIntent: "offer"`
- **AND** `preserveImageContext` é normalizado para `false` ou omitido
