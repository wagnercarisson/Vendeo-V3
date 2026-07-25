# Campaign Intent Types

> Added by `fase-31-1-modelo-comercial-formulario`.

## Purpose

Define o conceito de intenção comercial (`CampaignIntent`) que roteia o comportamento do gerador de campanhas — oferta promocional, destaque de produto, ou lançamento exclusivo. Esses tipos são transportados nos schemas, formulário e pipeline para preparar a F31.2 (ativação de spotlight/exclusive).

## Requirements

### Requirement: CampaignIntent type

O sistema SHALL definir o tipo `CampaignIntent` como `"offer" | "spotlight" | "exclusive"` em `src/lib/campaign/types.ts`.

O termo PT-BR na UI SHALL ser:
- `offer` → "Oferta"
- `spotlight` → "Destaque"
- `exclusive` → "Exclusivo"

#### Scenario: CampaignIntent accepts three values

- **WHEN** `CampaignIntent` é usado
- **THEN** aceita apenas `"offer"`, `"spotlight"`, ou `"exclusive"`

#### Scenario: campaignIntent default is offer

- **WHEN** `campaignIntent` não é fornecido em nenhum schema que o aceita como opcional
- **THEN** o valor padrão SHALL ser `"offer"`

### Requirement: campaignIntent e preserveImageContext em InputSnapshot

O sistema SHALL adicionar os campos opcionais `campaignIntent?: CampaignIntent` e `preserveImageContext?: boolean` na interface `InputSnapshot` em `src/lib/campaign/types.ts`.

#### Scenario: InputSnapshot aceita campaignIntent

- **WHEN** `InputSnapshot` é populado com `campaignIntent`
- **THEN** o campo `campaignIntent` está presente como `CampaignIntent | undefined`

#### Scenario: InputSnapshot aceita preserveImageContext

- **WHEN** `InputSnapshot` é populado com `preserveImageContext`
- **THEN** o campo `preserveImageContext` está presente como `boolean | undefined`

### Requirement: preserveImageContext normalization for offer intent

O sistema SHALL normalizar `preserveImageContext` para `false` (ou omitir) no `inputSnapshot` quando `campaignIntent === "offer"`, independente do valor enviado pelo formulário.

#### Scenario: offer + preserveImageContext=true normaliza para false

- **WHEN** `campaignIntent` é `"offer"` e `preserveImageContext` é `true`
- **THEN** o `inputSnapshot` SHALL conter `preserveImageContext: false` ou omitir o campo

#### Scenario: spotlight + preserveImageContext=true mantém true

- **WHEN** `campaignIntent` é `"spotlight"` e `preserveImageContext` é `true`
- **THEN** o `inputSnapshot` SHALL conter `preserveImageContext: true`

### Requirement: Spotlight e exclusive desbloqueados

> Added by `fase-31-2-diretores-por-intencao`.

O sistema SHALL NÃO bloquear o uso de `spotlight` e `exclusive`. Os bloqueios da F31.1 (UI "Em breve", guard early-return no form, guard HTTP 400 no pipeline) SHALL ser removidos.

#### Scenario: spotlight transita pelo pipeline sem bloqueio

- **WHEN** uma requisição chega com `campaignIntent: "spotlight"`
- **THEN** o pipeline NÃO retorna HTTP 400
- **AND** o fluxo prossegue para os diretores de imagem e copy

#### Scenario: exclusive transita pelo pipeline sem bloqueio

- **WHEN** uma requisição chega com `campaignIntent: "exclusive"`
- **THEN** o pipeline NÃO retorna HTTP 400
- **AND** o fluxo prossegue para os diretores de imagem e copy

### Requirement: exclusive normaliza preço para ausente

> Added by `fase-31-2-diretores-por-intencao`.

O sistema SHALL normalizar `discountedPriceCents` para `undefined` quando `campaignIntent === "exclusive"` e o campo estiver presente, independente do valor. A normalização acontece depois do guard de legal/auth/ownership e antes de montar o `campaignInput`.

#### Scenario: exclusive com preço normaliza antes do brief

- **WHEN** o body chega com `campaignIntent: "exclusive"` e `discountedPriceCents: 5000`
- **THEN** o valor é normalizado para `undefined` antes de construir o brief
- **AND** o diretor de imagem nunca recebe preço

### Requirement: Comportamento semântico por intent documentado

> Added by `fase-31-2-diretores-por-intencao`.

O sistema SHALL documentar o comportamento esperado de cada intent:

| Intent | Preço | Badge | Prompt de imagem | Prompt de copy |
|--------|-------|-------|-----------------|----------------|
| offer | DE/POR obrigatório | Obrigatório (BADGE_OPTIONS_BY_INTENT) | campaign-image-director-offer | campaign-copy-director-offer |
| spotlight | Preço único (normalmente presente) | Opcional | campaign-image-director-spotlight | campaign-copy-director-spotlight |
| exclusive | Sem preço (sempre omitido) | Opcional | campaign-image-director-exclusive | campaign-copy-director-exclusive |

#### Scenario: offer mantém comportamento da F31.1

- **WHEN** a intent é "offer"
- **THEN** o comportamento é idêntico ao da F31.1 — sem regressão
