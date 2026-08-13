# Campaign Brief Pipeline Adapters

> Synced from `fase-39-brief-estruturado-campanha` (ADDED).

## Purpose

As costuras de consumo do domínio estruturado no pipeline (D11): ② `CampaignBrief` → prompts (`buildPromptVariables`/`buildCommercialRepertoire`), ③ → provider/input-validation (`media.primary.dataUrl`), ④ → copy (`mapBriefToCopyDirectorInput`), ⑤ → review (`ImageReviewInput`). Comportamento de geração **preservado** para o mesmo payload flat (golden tests por intent).

## Requirements

### Requirement: ImageGenerationService consome CampaignBrief estruturado

O sistema SHALL fazer `ImageGenerationService` (`src/lib/image-generation/services/image-generation-service.ts`) consumir o `CampaignBrief` estruturado em vez do corpo flat (`body.*`):

- `buildPromptVariables` SHALL ler `brief.product`, `brief.commercial`, `brief.media` e `brief.creativeContext` (em vez de `brief.campaignInput as GenerateImageRequest`)
- `buildCommercialRepertoire` SHALL decidir por `commercial.validity.enabled/displayText` — **sem** heurística de string (`/`, `até`, `válida`) (D8)
- A montagem do `ImageReviewInput` SHALL ler do domínio, incluindo `legalNotice` e `validity` (D9/D8)
- **O conjunto de variáveis de prompt SHALL permanecer idêntico** para o mesmo input — regressão garantida por golden tests por intent (offer/spotlight/exclusive)

#### Scenario: buildPromptVariables produz o MESMO conjunto de variáveis

- **WHEN** `buildPromptVariables` recebe um brief estruturado montado de um payload flat
- **THEN** produz o mesmo conjunto de variáveis que o fluxo flat atual produziria para o mesmo input (D11 — regressão por golden test por intent)

#### Scenario: buildCommercialRepertoire decide por validity.enabled/displayText

- **WHEN** `brief.commercial.validity = { enabled: true, displayText: "válida até 30/09" }`
- **THEN** `buildCommercialRepertoire` inclui a validade no repertório comercial
- **AND** a decisão não depende de heurística de string (`/`, `até`, `válida`)

#### Scenario: validity desabilitada não entra no repertório

- **WHEN** `brief.commercial.validity` está ausente ou `enabled === false`
- **THEN** `buildCommercialRepertoire` não emite texto de validade

#### Scenario: legalNotice.enabled=false bloqueia texto na arte

- **WHEN** `brief.commercial.legalNotice.enabled === false` (ou ausente)
- **THEN** o texto obrigatório não entra no prompt visual do Image Director (nem no revisor — D9)

### Requirement: Ponte media.primary.dataUrl → provider/input-validation

O sistema SHALL formalizar a ponte **explícita** `brief.media.images[0].dataUrl` (imagem `primary`) para:

- o **provider de imagem** (envio da imagem ao modelo)
- o **`InputValidationService` / revisor de visão** (validação de input)

O base64 SHALL viver **só em memória/transporte** (tipo runtime `CampaignProductImageInput`); o snapshot nunca o expõe (D6/D7).

#### Scenario: provider recebe media.primary.dataUrl

- **WHEN** o pipeline gera a imagem com um brief estruturado
- **THEN** o provider de imagem recebe `brief.media.images[0].dataUrl` (base64 em memória/transporte — D11)

#### Scenario: InputValidationService recebe media.primary.dataUrl

- **WHEN** o pipeline valida o input com o `InputValidationService`/revisor de visão
- **THEN** a validação recebe `brief.media.images[0].dataUrl` (ponte explícita — D11)

#### Scenario: snapshot nunca expõe a ponte

- **WHEN** o snapshot `campaign_brief_v1` é construído
- **THEN** nenhuma imagem do snapshot contém `dataUrl` — a ponte existe apenas no runtime (D6/D7)

### Requirement: mapBriefToCopyDirectorInput lê do domínio

O sistema SHALL fazer `mapBriefToCopyDirectorInput` (`src/lib/copy/mapper.ts`) ler do domínio estruturado — saída `CopyDirectorInput` **inalterada** (D11):

- `productName`/`intent`/preços/badge/validade lidos de `brief.product`/`brief.commercial`
- `validity.displayText` usado quando `enabled: true` (D8)
- `legalNotice` **não** entra no `CopyDirectorInput` (fronteira copy × texto obrigatório preservada — `mandatory-artwork-text`)

#### Scenario: CopyDirectorInput equivalente ao flat atual

- **WHEN** `mapBriefToCopyDirectorInput` recebe um brief estruturado de um payload flat
- **THEN** o `CopyDirectorInput` resultante é equivalente ao produzido pelo fluxo flat atual (D11)

#### Scenario: validity propaga no copy quando habilitada

- **WHEN** `brief.commercial.validity.enabled === true` com `displayText`
- **THEN** o texto de validade entra no contexto do Copy Director (D8)

#### Scenario: legalNotice não entra no copy

- **WHEN** um brief tem `commercial.legalNotice` preenchido
- **THEN** o `CopyDirectorInput` NÃO contém o texto do aviso legal (fronteira copy × arte mantida)

### Requirement: ImageReviewInput montado do domínio

O sistema SHALL montar o `ImageReviewInput` (revisor — `src/lib/image-generation/services/image-review-service.ts`) a partir do domínio (D11):

- `productName`, `storeName`, `intent`, preços, `campaignDetails`, `availabilityNotes` lidos de `brief.product`/`brief.commercial`
- `legalNotice.text` incluído no review **apenas quando** `legalNotice.enabled === true` (D9)
- `validity.displayText` incluído quando `validity.enabled === true` (D8)
- `preserveImageContext`/`campaignIntent` lidos de `brief.creativeContext`/`brief.commercial`

#### Scenario: revisor recebe legalNotice quando habilitado

- **WHEN** `brief.commercial.legalNotice = { enabled: true, text: "Imagem meramente ilustrativa" }`
- **THEN** o `ImageReviewInput` contém o texto do aviso (D9)

#### Scenario: revisor NÃO recebe legalNotice quando desabilitado

- **WHEN** `brief.commercial.legalNotice.enabled === false` (ou ausente)
- **THEN** o `ImageReviewInput` NÃO contém o texto do aviso (D9)

#### Scenario: revisor recebe validity quando habilitada

- **WHEN** `brief.commercial.validity = { enabled: true, displayText: "válida até 30/09" }`
- **THEN** o `ImageReviewInput` contém `validity.displayText` (D8)

#### Scenario: revisor montado do domínio mantém campos essenciais

- **WHEN** o `ImageReviewInput` é montado de um brief estruturado
- **THEN** contém `productName`, `storeName`, `campaignIntent`, preços, `campaignDetails` — equivalentes ao fluxo flat atual (D11)

### Requirement: Comportamento de geração preservado

O sistema SHALL preservar o **comportamento de geração atual** para o mesmo payload flat (D11): mesmo prompt, mesma copy, mesma revisão. A orquestração da rota (crédito, rate limit, clearance, readiness, stream, telemetria, estorno) SHALL permanecer **inalterada**.

#### Scenario: golden test por intent (offer/spotlight/exclusive)

- **WHEN** o pipeline gera com um brief estruturado montado de um payload flat de intent `offer` (ou `spotlight`/`exclusive`)
- **THEN** o prompt final é **idêntico** ao do fluxo flat atual para o mesmo intent (regressão por golden test)

#### Scenario: orquestração da rota inalterada

- **WHEN** o fluxo completo de geração roda
- **THEN** crédito, rate limit, clearance, readiness, stream, telemetria e estorno funcionam exatamente como antes (somente a camada de input muda de shape — D11)
