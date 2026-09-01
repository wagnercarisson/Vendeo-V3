# AI Image Generation

> Modified by `fase-40-campos-comerciais-avisos-brief` (D6): os 4 prompts do diretor (`campaign-image-director.md`, `-offer.md`, `-spotlight.md`, `-exclusive.md`) perdem a instrução **incondicional** "SEMPRE acrescente ... 'Imagem meramente ilustrativa'" (herança UAT-3) e ganham um **bloco condicional de composição** — o aviso ilustrativo só entra na arte quando houver texto obrigatório/aviso legal informado. O conjunto de variáveis/keys do prompt permanece **idêntico** para o mesmo input (golden `EXPECTED_KEYS = 38`); o texto do prompt muda intencionalmente (D6). O comportamento visual default é preservado (checkbox marcado → aviso na arte como hoje). As superfícies de validade (`buildCommercialRepertoire` → `- Oferta válida:` e template offer/base → `**Validade da oferta:**`) NÃO mudam (D5).

## MODIFIED Requirements

### Requirement: Preservação comportamental — nenhuma variável criativa alterada

`buildPromptVariables()` SHALL preserve all existing variables and their rules. The following SHALL remain unchanged:
- `creativePersona`, `inferredCategory`, `hasCategoryConflict`, `categoryConflictDirective`
- `commercialRepertoire`, `inputValidationSummary`, `creativeContextGuidance`
- `campaignDetails`, `additionalDetails`, `hook`, `cta`, `objective`
- `targetChannel`, `format`, `validity`, `availabilityNotes`, `sensitiveConstraints`

> Modified by `fase-40-campos-comerciais-avisos-brief` (D6): o conjunto de variáveis/keys do prompt permanece **idêntico** para o mesmo input (golden `EXPECTED_KEYS = 38`). O **texto do prompt muda intencionalmente**: a instrução incondicional do aviso ilustrativo (herança UAT-3) é substituída pelo **bloco condicional de composição**. Não há novas variáveis; apenas a instrução textual é reframada. O comportamento visual default é preservado (checkbox marcado).

#### Scenario: Regression parity — conjunto de variáveis idêntico

- **WHEN** o mesmo payload flat de hoje é processado com os novos campos preenchidos (checkbox marcado default + validade preenchida)
- **THEN** o conjunto de variáveis/keys do prompt final é **idêntico** ao baseline (golden `EXPECTED_KEYS = 38`)
- **AND** o texto do prompt muda apenas na instrução do aviso ilustrativo (bloco condicional substitui a instrução incondicional — D6)

#### Scenario: Regression parity — comportamento visual default preservado

- **WHEN** o checkbox está marcado (default) e `mandatoryArtworkText = ILLUSTRATIVE_NOTICE_TEXT`
- **THEN** o prompt instrui a exibição do aviso com a mesma inteligência visual do UAT-3 (tipografia mínima, visível/legível, posição lateral)
- **AND** o comportamento visual resultante é o mesmo de hoje (aviso presente na arte)

## ADDED Requirements

### Requirement: Prompt reframe — bloco condicional de composição (D6)

Os 4 prompts do diretor SHALL **NÃO** conter a instrução incondicional "SEMPRE acrescente a arte o seguinte texto ... : 'Imagem meramente ilustrativa'" (herança UAT-3).

No lugar da instrução incondicional, os 4 prompts SHALL conter o **bloco condicional de composição**:

```
Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte.
Se o aviso for "Imagem meramente ilustrativa", posicione-o com tipografia mínima, mas visível e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço.
```

A linha condicional do texto obrigatório já existente ("Se o campo 'Texto obrigatório na arte' estiver preenchido ({{mandatoryArtworkText}})... Não o repita na legenda.") SHALL ser mantida em todos os 4 prompts.

#### Scenario: Prompts sem instrução incondicional do aviso

- **WHEN** `campaign-image-director.md`, `campaign-image-director-offer.md`, `campaign-image-director-spotlight.md` e `campaign-image-director-exclusive.md` são inspecionados
- **THEN** NENHUM deles contém "SEMPRE acrescente a arte o seguinte texto" referente ao aviso ilustrativo

#### Scenario: Prompts com bloco condicional de composição

- **WHEN** os 4 prompts do diretor são inspecionados
- **THEN** cada um contém o bloco condicional de composição (texto obrigatório informado → exibir exatamente; tipografia mínima/visível/legível; posição lateral; sem competir com oferta/produto/preço)

#### Scenario: Linha condicional do texto obrigatório mantida

- **WHEN** os 4 prompts do diretor são inspecionados
- **THEN** a linha "Se o campo 'Texto obrigatório na arte' estiver preenchido ({{mandatoryArtworkText}})... Não o repita na legenda." é mantida

### Requirement: legalNotice desabilitado SHALL resultar em prompt e revisor sem texto obrigatório

O sistema SHALL garantir que, quando `legalNotice.enabled === false` (checkbox desmarcado + sem texto livre → `mandatoryArtworkText` ausente):

- o prompt do diretor receba `mandatoryArtworkText` vazio;
- o revisor receba `mandatoryArtworkTextSection` vazio (nenhum texto obrigatório a verificar).

Quando `validity.enabled === true` + `displayText` (offer), o sistema SHALL montar `validityTextSection` no revisor com o `displayText`; quando ausente → `validityTextSection` vazio.

#### Scenario: legalNotice desabilitado gera prompt e revisor vazios

- **WHEN** o checkbox está desmarcado e não há texto livre (`mandatoryArtworkText` ausente → `legalNotice.enabled=false`)
- **THEN** o prompt do diretor recebe `mandatoryArtworkText` vazio
- **AND** `mandatoryArtworkTextSection` do revisor é vazio (nada a verificar)

#### Scenario: Validade habilitada monta seção no revisor

- **WHEN** `validity.enabled === true` com `displayText = "até 30/09"` e intent `offer`
- **THEN** o revisor monta `validityTextSection` contendo "até 30/09"
- **AND** sem validade → `validityTextSection` é vazio
