# Transactional Pipeline

> Modified by `fase-39-brief-estruturado-campanha` (D11): `mapBriefToCopyDirectorInput` passa a ler do **domínio estruturado** (`brief.product`/`brief.commercial`) em vez do corpo flat. Saída `CopyDirectorInput` **inalterada**. `validity.displayText` propagado quando habilitado (D8); aviso legal (`legalNotice`) **não** entra no copy (fronteira copy × arte preservada).

## MODIFIED Requirements

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
