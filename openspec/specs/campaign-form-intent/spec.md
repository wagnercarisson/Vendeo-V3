# Campaign Form Intent

> Added by `fase-31-1-modelo-comercial-formulario`.

## Purpose

Define a lógica de inferência automática de intenção comercial, validação condicional por intent, e regras de estado do formulário relacionadas a `CampaignIntent` e `preserveImageContext`.

## Requirements

### Requirement: Intent inference from price fields

O sistema SHALL prover uma função `inferIntent(originalPriceCents: number, discountedPriceCents: number | undefined | null): CampaignIntent`. O valor `discountedPriceCents` vazio (undefined/null) representa campo não preenchido no formulário.

A inferência SHALL normalizar valores vazios para `0` antes da lógica de comparação, resultando em:

| Campos preenchidos | Intent inferida |
|---|---|
| `originalPriceCents > 0` AND `discountedPriceCents > 0` (após normalização) | `"offer"` |
| `originalPriceCents` vazio ou 0 AND `discountedPriceCents > 0` (após normalização) | `"spotlight"` |
| Ambos vazios ou 0 | `"exclusive"` |

#### Scenario: DE+POR infere offer

- **WHEN** `originalPriceCents > 0` e `discountedPriceCents > 0`
- **THEN** `inferIntent` retorna `"offer"`

#### Scenario: Só preço com desconto infere spotlight

- **WHEN** `originalPriceCents` é 0 e `discountedPriceCents > 0`
- **THEN** `inferIntent` retorna `"spotlight"`

#### Scenario: Nenhum preço (undefined) infere exclusive

- **WHEN** `originalPriceCents` é 0 e `discountedPriceCents` é `undefined` ou `null`
- **THEN** `inferIntent` retorna `"exclusive"`

#### Scenario: Ambos preços zerados (0) infere exclusive

- **WHEN** `originalPriceCents` é 0 e `discountedPriceCents` é 0
- **THEN** `inferIntent` retorna `"exclusive"`

### Requirement: Conditional validation by intent

O sistema SHALL modificar a validação para ser condicional à intent selecionada:

- `validateDiscountedPrice`: retorna erro apenas quando `campaignIntent === "offer"` e preço vazio/zero. Para spotlight/exclusive, sempre retorna null.
- `validateBadge`: usa `BADGE_OPTIONS_BY_INTENT[campaignIntent]` para validar o badge. Badge é obrigatório apenas para offer; para spotlight/exclusive, badge vazio é válido.
- `isValid`: retorna true quando a validação passa, independente da intent (todas as intents permitem submissão).

#### Scenario: Offer exige preço com desconto

- **WHEN** `campaignIntent === "offer"` e `discountedPriceCents` é 0 ou undefined
- **THEN** `validateDiscountedPrice` retorna mensagem de erro

#### Scenario: Spotlight não exige preço com desconto

- **WHEN** `campaignIntent === "spotlight"` e `discountedPriceCents` é 0
- **THEN** `validateDiscountedPrice` retorna null

#### Scenario: Offer exige badge obrigatório

- **WHEN** `campaignIntent === "offer"` e badge está vazio
- **THEN** `validateBadge` retorna mensagem de erro

#### Scenario: Spotlight/exclusive aceitam badge vazio

- **WHEN** `campaignIntent === "spotlight"` ou `"exclusive"` e badge está vazio
- **THEN** `validateBadge` retorna null

#### Scenario: isValid retorna true para spotlight

- **WHEN** `campaignIntent === "spotlight"` e validação passa
- **THEN** `isValid` retorna `true` (antes retornava `false` para non-offer)

### Requirement: Badge cleanup on intent change

O sistema SHALL, ao detectar mudança de intent, verificar se o badge atual pertence à lista da nova intent. Se não pertencer, SHALL resetar o badge para vazio. Se `preserveImageContext === true` e a nova intent for `"offer"`, SHALL resetar `preserveImageContext` para `false`.

#### Scenario: Trocar de offer para spotlight limpa badge inválido

- **WHEN** o usuário muda de `offer` para `spotlight` e o badge atual é "Promoção"
- **THEN** o badge é resetado para vazio

#### Scenario: preserveImageContext reset ao voltar para offer

- **WHEN** `campaignIntent` muda de `"spotlight"` para `"offer"` com `preserveImageContext: true`
- **THEN** `preserveImageContext` é resetado para `false`

### Requirement: discountedPriceCents opcional no CampaignFormFields

O sistema SHALL tornar `discountedPriceCents` opcional (`number | undefined`) em `CampaignFormFields`. O valor `undefined` representa campo vazio no formulário.

#### Scenario: discountedPriceCents vazio salva como undefined

- **WHEN** o campo "Preço com Desconto" está vazio
- **THEN** `CampaignFormFields.discountedPriceCents` é `undefined`
- **AND** nenhum erro de validação é disparado (desde que intent não seja offer)

### Requirement: Submit permitido para todas as intents

> Modified by `fase-31-2-diretores-por-intencao`.

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

### Requirement: discountedPriceCents fluido no submit body

> Added by `fase-31-2-diretores-por-intencao`.

O sistema SHALL incluir `discountedPriceCents` no body do submit apenas quando presente no form. Para exclusive, o campo é omitido.

#### Scenario: Submit exclusive omite discountedPriceCents

- **WHEN** o formulário envia com `campaignIntent: "exclusive"` e `discountedPriceCents: undefined`
- **THEN** o body NÃO contém `discountedPriceCents`

### Requirement: CampaignFormFields extended with intent fields

O sistema SHALL adicionar `campaignIntent: CampaignIntent` e `preserveImageContext: boolean` à interface `CampaignFormFields`, com valores iniciais `"offer"` e `false` respectivamente.

#### Scenario: CampaignFormFields inclui campos de intent

- **WHEN** `CampaignFormFields` é instanciado via `EMPTY_FIELDS`
- **THEN** `campaignIntent` é `"offer"` e `preserveImageContext` é `false`
