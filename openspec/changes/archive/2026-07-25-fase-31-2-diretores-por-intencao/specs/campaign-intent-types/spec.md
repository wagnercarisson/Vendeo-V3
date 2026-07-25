# Campaign Intent Types

> Modified by `fase-31-2-diretores-por-intencao`.

## ADDED Requirements

### Requirement: Spotlight e exclusive desbloqueados

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

O sistema SHALL normalizar `discountedPriceCents` para `undefined` quando `campaignIntent === "exclusive"` e o campo estiver presente, independente do valor. A normalização acontece depois do guard de legal/auth/ownership e antes de montar o `campaignInput`.

#### Scenario: exclusive com preço normaliza antes do brief

- **WHEN** o body chega com `campaignIntent: "exclusive"` e `discountedPriceCents: 5000`
- **THEN** o valor é normalizado para `undefined` antes de construir o brief
- **AND** o diretor de imagem nunca recebe preço

### Requirement: Comportamento semântico por intent documentado

O sistema SHALL documentar o comportamento esperado de cada intent:

| Intent | Preço | Badge | Prompt de imagem | Prompt de copy |
|--------|-------|-------|-----------------|----------------|
| offer | DE/POR obrigatório | Obrigatório (BADGE_OPTIONS_BY_INTENT) | campaign-image-director-offer | campaign-copy-director-offer |
| spotlight | Preço único (normalmente presente) | Opcional | campaign-image-director-spotlight | campaign-copy-director-spotlight |
| exclusive | Sem preço (sempre omitido) | Opcional | campaign-image-director-exclusive | campaign-copy-director-exclusive |

#### Scenario: offer mantém comportamento da F31.1

- **WHEN** a intent é "offer"
- **THEN** o comportamento é idêntico ao da F31.1 — sem regressão
