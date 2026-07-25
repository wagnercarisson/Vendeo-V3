# Campaign Form Intent

> Modified by `fase-31-2-diretores-por-intencao`.

## MODIFIED Requirements

### Requirement: Submit permitido para todas as intents

O sistema SHALL modificar `handleSubmit()` e `isValid` para permitir submissão de todas as intents (offer, spotlight, exclusive). O bloqueio anterior ("Disponível em breve" para non-offer) SHALL ser removido.

A validação condicional de preço e badge permanece:
- Offer: `discountedPriceCents` obrigatório, badge obrigatório
- Spotlight: `discountedPriceCents` normalmente presente (validação tolerante), badge opcional
- Exclusive: `discountedPriceCents` sempre omitido, badge opcional

#### Scenario: Spotlight pode submeter

- **WHEN** `campaignIntent === "spotlight"` e campos válidos
- **THEN** `handleSubmit()` prossegue com a requisição
- **AND** não retorna "Disponível em breve"

#### Scenario: Exclusive pode submeter

- **WHEN** `campaignIntent === "exclusive"` e campos válidos
- **THEN** `handleSubmit()` prossegue com a requisição
- **AND** não retorna "Disponível em breve"

#### Scenario: isValid retorna true para spotlight

- **WHEN** `campaignIntent === "spotlight"` e validação passa
- **THEN** `isValid` retorna `true` (antes retornava `false` para non-offer)

## ADDED Requirements

### Requirement: discountedPriceCents fluido no submit body

O sistema SHALL incluir `discountedPriceCents` no body do submit apenas quando presente no form. Para exclusive, o campo é omitido.

#### Scenario: Submit exclusive omite discountedPriceCents

- **WHEN** o formulário envia com `campaignIntent: "exclusive"` e `discountedPriceCents: undefined`
- **THEN** o body NÃO contém `discountedPriceCents`
