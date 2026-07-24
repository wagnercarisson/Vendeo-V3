## ADDED Requirements

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

### Requirement: Intent selector in campaign form

O sistema SHALL exibir um seletor de intent (radio group) no formulário de campanha, posicionado entre o badge select e o botão "Criar Campanha". O seletor SHALL vir pré-selecionado com a intent inferida automaticamente.

As opções disponíveis SHALL ser filtradas conforme a intent inferida:

| Intent inferida | Opções no seletor |
|---|---|
| `offer` | Apenas "Oferta" (offer) |
| `spotlight` | "Oferta" (offer) e "Destaque" (spotlight) |
| `exclusive` | "Destaque" (spotlight) e "Exclusivo" (exclusive) |

#### Scenario: Seletor aparece após preenchimento de preços

- **WHEN** o usuário preenche campos de preço
- **THEN** o seletor de intent aparece entre badge e botão "Criar"
- **AND** vem pré-selecionado com a intent inferida

#### Scenario: Apenas offer disponível quando DE+POR

- **WHEN** `originalPriceCents > 0` e `discountedPriceCents > 0`
- **THEN** apenas a opção "Oferta" está disponível no seletor

### Requirement: Spotlight e Exclusive exibem "Em breve"

O sistema SHALL exibir indicador "Em breve" ao lado das opções `spotlight` e `exclusive` no seletor de intent. A submissão do formulário SHALL ser bloqueada quando qualquer intent diferente de `offer` estiver selecionada.

#### Scenario: Spotlight exibe "Em breve" e bloqueia submit

- **WHEN** a intent selecionada é `"spotlight"`
- **THEN** exibe "Em breve" ao lado de "Destaque"
- **AND** o botão "Criar Campanha" está desabilitado
- **AND** exibe tooltip: "Disponível em breve"

#### Scenario: Exclusive exibe "Em breve" e bloqueia submit

- **WHEN** a intent selecionada é `"exclusive"`
- **THEN** exibe "Em breve" ao lado de "Exclusivo"
- **AND** o botão "Criar Campanha" está desabilitado
- **AND** exibe tooltip: "Disponível em breve"

#### Scenario: Offer com dados completos permite submit

- **WHEN** a intent selecionada é `"offer"` e todos os campos obrigatórios estão preenchidos
- **THEN** o botão "Criar Campanha" está habilitado

### Requirement: Badge validation condicional por intent

O sistema SHALL validar badge como obrigatório apenas para intent `offer`. Para `spotlight` e `exclusive`, badge SHALL ser opcional.

#### Scenario: Offer exige badge obrigatório

- **WHEN** `campaignIntent === "offer"` e badge está vazio
- **THEN** a validação SHALL falhar com "Selecione um badge promocional"

#### Scenario: Spotlight aceita badge vazio

- **WHEN** `campaignIntent === "spotlight"` e badge está vazio
- **THEN** a validação SHALL passar sem erro de badge

#### Scenario: Exclusive aceita badge vazio

- **WHEN** `campaignIntent === "exclusive"` e badge está vazio
- **THEN** a validação SHALL passar sem erro de badge

### Requirement: Troca de intent limpa badge inválido

O sistema SHALL, ao detectar mudança de intent, verificar se o badge atual pertence à lista da nova intent. Se não pertencer, SHALL resetar o badge para vazio.

#### Scenario: Trocar de offer para spotlight limpa badge

- **WHEN** o usuário muda de `offer` para `spotlight` e o badge atual é "Promoção"
- **THEN** o badge é resetado para vazio
- **AND** o select exibe a lista de badges de spotlight

#### Scenario: Trocar de spotlight para exclusive mantém badge compatível

- **WHEN** o usuário muda de `spotlight` para `exclusive` e o badge atual é "Destaque da Semana"
- **THEN** o badge é resetado para vazio (não pertence à lista de exclusive)
- **AND** o select exibe a lista de badges de exclusive

### Requirement: preserveImageContext checkbox

O sistema SHALL exibir um checkbox "Preservar imagem original" no formulário:
- **Sempre invisível** quando `campaignIntent === "offer"`
- **Visível e opcional** quando `campaignIntent === "spotlight"` ou `"exclusive"`

#### Scenario: preserveImageContext invisível em offer

- **WHEN** `campaignIntent === "offer"`
- **THEN** o checkbox "Preservar imagem original" NÃO está visível no formulário

#### Scenario: preserveImageContext visível em spotlight

- **WHEN** `campaignIntent === "spotlight"`
- **THEN** o checkbox "Preservar imagem original" está visível
- **AND** não é obrigatório

#### Scenario: preserveImageContext reset ao voltar para offer

- **WHEN** `campaignIntent` muda de `"spotlight"` para `"offer"`
- **THEN** `preserveImageContext` é resetado para `false`
- **AND** o checkbox desaparece do formulário

### Requirement: discountedPriceCents opcional no CampaignFormFields

O sistema SHALL tornar `discountedPriceCents` opcional (`number | undefined`) em `CampaignFormFields`. O valor `undefined` representa campo vazio no formulário.

#### Scenario: discountedPriceCents vazio salva como undefined

- **WHEN** o campo "Preço com Desconto" está vazio
- **THEN** `CampaignFormFields.discountedPriceCents` é `undefined`
- **AND** nenhum erro de validação é disparado (desde que intent não seja offer)
