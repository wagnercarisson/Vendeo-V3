# Image Quality Review

> Modified by `fase-39-brief-estruturado-campanha` (D9/D11): o `ImageReviewInput` passa a ser **montado a partir do domínio estruturado** (`CampaignBrief`), incluindo `legalNotice` e `validity`. `legalNotice.text` entra no review **apenas quando** `enabled === true`; `validity.displayText` entra quando habilitada. O comportamento de revisão em si não muda.

## MODIFIED Requirements

### Requirement: ImageReviewInput extended with campaignIntent and preserveImageContext

The `ImageReviewInput` interface SHALL be extended with:
- `campaignIntent?: CampaignIntent` — default `"offer"` for backward compatibility (lido de `brief.commercial.intent`)

> Modified by `fase-39-brief-estruturado-campanha` (D11): o `ImageReviewInput` passa a ser montado a partir do domínio estruturado `CampaignBrief` (`brief.product`/`brief.commercial`/`brief.creativeContext`), incluindo `legalNotice` e `validity` (D9/D8).
- `preserveImageContext?: boolean` — indicates whether the reviewer should allow contextual background (lido de `brief.creativeContext`)
- `badgeText?: string` — made optional (was required)
- `discountedPrice?: string` — made optional (was required)
- `originalPrice?: string` — remains optional
- `legalNoticeText?: string` — aviso legal a verificar na arte; presente **apenas quando** `brief.commercial.legalNotice?.enabled === true` (D9)
- `validityText?: string` — texto de validade a verificar; presente **apenas quando** `brief.commercial.validity?.enabled === true` (D8)

The `validationContext?: ValidationContext` field SHALL remain as previously defined.

#### Scenario: ImageReviewInput com campaignIntent exclusive

- **WHEN** `ImageReviewInput` é construído com `{ campaignIntent: "exclusive" }`
- **THEN** `discountedPrice` MAY be omitted
- **AND** the review SHALL NOT expect a price on the image
- **AND** `badgeText` MAY be omitted
- **AND** the review SHALL NOT require a badge

#### Scenario: revisor recebe legalNotice quando habilitado

- **WHEN** o `ImageReviewInput` é montado de um brief com `commercial.legalNotice = { enabled: true, text: "Imagem meramente ilustrativa" }`
- **THEN** `legalNoticeText` contém o texto do aviso (D9)

#### Scenario: revisor NÃO recebe legalNotice quando desabilitado

- **WHEN** o `ImageReviewInput` é montado de um brief com `legalNotice.enabled === false` (ou ausente)
- **THEN** `legalNoticeText` está ausente — o texto obrigatório não entra na revisão (D9)

#### Scenario: revisor recebe validity quando habilitada

- **WHEN** o `ImageReviewInput` é montado de um brief com `commercial.validity = { enabled: true, displayText: "válida até 30/09" }`
- **THEN** `validityText` contém `"válida até 30/09"` (D8)

### ADDED Requirement: ImageReviewInput montado do domínio (campaign-brief)

O sistema SHALL montar o `ImageReviewInput` a partir do domínio estruturado `CampaignBrief` (D11), incluindo:

- `productName` (de `brief.product.name`), `storeName` (do contexto resolvido), `campaignIntent` (de `brief.commercial.intent`), preços (de `brief.commercial.*`), `campaignDetails`/`availabilityNotes` (de `brief.commercial.*`)
- `legalNoticeText` (apenas quando `enabled === true` — D9) e `validityText` (apenas quando `enabled === true` — D8)
- `preserveImageContext` (de `brief.creativeContext`)

A saída resultante SHALL ser **equivalente** à montada pelo fluxo flat atual para o mesmo input (regressão preservada — D11).

#### Scenario: revisor montado do domínio mantém campos essenciais

- **WHEN** o `ImageReviewInput` é montado de um `CampaignBrief` estruturado
- **THEN** contém `productName`, `storeName`, `campaignIntent`, preços e `campaignDetails` — equivalentes ao fluxo flat atual (D11)

#### Scenario: revisor recebe dados equivalentes para o mesmo input

- **WHEN** o mesmo payload flat de hoje é convertido para `CampaignBrief` e usado na montagem do review
- **THEN** o `ImageReviewInput` resultante é equivalente ao do fluxo flat atual (D11 — regressão preservada)
