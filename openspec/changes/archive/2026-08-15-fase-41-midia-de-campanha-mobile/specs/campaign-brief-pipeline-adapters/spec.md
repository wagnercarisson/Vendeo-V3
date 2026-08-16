# Campaign Brief Pipeline Adapters

> Delta spec for `fase-41-midia-de-campanha-mobile` (D7/D8/D9).

## MODIFIED Requirements

### Requirement: Ponte media.images → provider/input-validation

O sistema SHALL formalizar a ponte **explícita** dos dataUrls de `brief.media.images` para:

- o **provider de imagem** (envio das imagens ao modelo)
- o **`InputValidationService` / revisor de visão** (validação de input)

A ponte single `primaryImageDataUrl(brief)` SHALL evoluir para **`mediaImagesDataUrls(brief)`** (D7): uma **lista ordenada** de dataUrls dos itens de `brief.media.images`, em que **a posição 0 é sempre a primary**. A lista alimenta `ImageProviderInput.productImagesDataUrls`; quando há **apenas a primary**, o provider pode receber `productImageDataUrl` (legado) ou uma lista de 1 elemento — comportamento equivalente.

O base64 SHALL viver **só em memória/transporte** (tipo runtime `CampaignProductImageInput`); o snapshot nunca o expõe (D6/D7).

#### Scenario: provider recebe a lista de dataUrls (D7)

- **WHEN** o pipeline gera a imagem com um brief com primary + 2 auxiliares
- **THEN** o provider recebe `productImagesDataUrls` com 3 itens (posição 0 = primary)
- **AND** a ponte `mediaImagesDataUrls(brief)` preserva a ordem dos itens do brief

#### Scenario: lista de 1 elemento mantém caminho legado

- **WHEN** o brief tem apenas a primary (1 imagem)
- **THEN** `mediaImagesDataUrls(brief)` retorna uma lista de 1 elemento
- **AND** o provider pode receber `productImageDataUrl` (legado) com comportamento equivalente

#### Scenario: InputValidationService usa apenas a primary (D8)

- **WHEN** o pipeline valida o input com o `InputValidationService`/revisor de visão
- **THEN** a validação recebe **apenas** o dataUrl da imagem **primary** (posição 0) — auxiliares não participam (primary-only na v1)

#### Scenario: snapshot nunca expõe a ponte

- **WHEN** o snapshot `campaign_brief_v1` é construído
- **THEN** nenhuma imagem do snapshot contém `dataUrl` — a ponte existe apenas no runtime (D6/D7)

### Requirement: ImageReviewInput montado do domínio

O sistema SHALL montar o `ImageReviewInput` (revisor — `src/lib/image-generation/services/image-review-service.ts`) a partir do domínio (D11):

- `productName`, `storeName`, `intent`, preços, `campaignDetails`, `availabilityNotes` lidos de `brief.product`/`brief.commercial`
- `legalNotice.text` incluído no review **apenas quando** `legalNotice.enabled === true` (D9)
- `validity.displayText` incluído quando `validity.enabled === true` (D8)
- `preserveImageContext`/`campaignIntent` lidos de `brief.creativeContext`/`brief.commercial`
- **F41 D9:** o `ImageReviewInput` passa a carregar, **opcionalmente**, a **dataUrl da imagem principal** (`mediaImagesDataUrls(brief)[0]`) como **referência de fidelidade** — o revisor compara o produto da arte com a imagem de referência.

#### Scenario: revisor recebe legalNotice quando habilitado

- **WHEN** `brief.commercial.legalNotice = { enabled: true, text: "Imagem meramente ilustrativa" }`
- **THEN** o `ImageReviewInput` contém o texto do aviso (D9)

#### Scenario: revisor NÃO recebe legalNotice quando desabilitado

- **WHEN** `brief.commercial.legalNotice.enabled === false` (ou ausente)
- **THEN** o `ImageReviewInput` NÃO contém o texto do aviso (D9)

#### Scenario: revisor recebe validity quando habilitada

- **WHEN** `brief.commercial.validity = { enabled: true, displayText: "válida até 30/09" }`
- **THEN** o `ImageReviewInput` contém `validity.displayText` (D8)

#### Scenario: revisor recebe a primary como referência (D9)

- **WHEN** o brief tem uma imagem primary (dataUrl)
- **THEN** o `ImageReviewInput` carrega a dataUrl da primary
- **AND** o revisor verifica a fidelidade do produto da arte contra a imagem de referência

#### Scenario: revisor sem primary mantém comportamento atual

- **WHEN** não há imagem primary disponível (caminho legado sem referência)
- **THEN** o `ImageReviewInput` NÃO carrega imagem de referência
- **AND** o comportamento do revisor é idêntico ao atual (retrocompatível — D9)

#### Scenario: revisor montado do domínio mantém campos essenciais

- **WHEN** o `ImageReviewInput` é montado de um brief estruturado
- **THEN** contém `productName`, `storeName`, `campaignIntent`, preços, `campaignDetails` — equivalentes ao fluxo flat atual (D11)
