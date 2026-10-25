# Admin AI Model Selection

> Synced from `fase-47-catalogo-e-selecao-de-modelos-admin` (ADDED).

## Purpose

Tela administrativa e API para escolher e versionar os modelos por capacidade, controlando primary e fallback somente onde há caller real, agrupados por Texto/Visual/Imagem.

## Requirements

### Requirement: Tela administrativa de modelos de IA

O sistema SHALL prover a tela `/admin/ai-model-selection` (acesso admin) que lista as capacidades **agrupadas por Texto, Visual e Imagem** e permite escolher, para cada capacidade, o modelo primary a partir do catálogo ativo. Somente `campaign_copy` SHALL oferecer o fallback genérico opcional; `campaign_image_edit` SHALL ser apresentado como capacidade primária independente para o caminho de edição de imagem. A tela SHALL exibir o modelo atual, o default do registry e a origem (seleção × default).

#### Scenario: Agrupamento por segmento

- **WHEN** um admin abre a tela
- **THEN** as capacidades aparecem agrupadas em Texto, Visual e Imagem
- **AND** cada capacidade mostra o primary atual, o fallback atual (quando houver) e o default do registry

#### Scenario: Seleção de primary e fallback de campaign_copy com motivo

- **WHEN** o admin escolhe primary e/ou fallback de `campaign_copy` e informa o motivo
- **THEN** a seleção é salva via RPC auditada
- **AND** a tela reflete a nova configuração como seleção vigente

#### Scenario: Fallback pode ser desabilitado

- **WHEN** o admin escolhe "sem fallback" para uma capacidade
- **THEN** a seleção é salva sem alvo de fallback
- **AND** a tela indica que a capacidade não usa fallback

#### Scenario: Acesso restrito a admin

- **WHEN** um usuário não-admin acessa a tela
- **THEN** o acesso é negado (redirect/forbidden conforme padrão admin)

#### Scenario: Motivo obrigatório na UI

- **WHEN** o admin tenta salvar sem informar o motivo
- **THEN** a UI impede o envio com feedback claro

### Requirement: Distinção entre capacidade de edição e fallback genérico

A tela SHALL apresentar `campaign_image_edit` como uma **capacidade própria** no grupo Imagem e SHALL NOT representá-la como fallback genérico de `campaign_image`. O fallback genérico configurável SHALL existir somente em `campaign_copy`, refletindo os callers reais da F46.

#### Scenario: Capacidade de edição é independente

- **WHEN** o admin visualiza o grupo Imagem
- **THEN** `campaign_image_edit` aparece como capacidade própria
- **AND** nenhum fallback genérico é oferecido para `campaign_image`; a edição usa a capacidade própria `campaign_image_edit`

### Requirement: API administrativa de seleção

O sistema SHALL expor `GET`, `PUT` e `DELETE /api/admin/ai-model-selection` (padrão `apiHandler` + `requireAdmin` + validação Zod). `GET` retorna o catálogo ativo, as seleções vigentes e os defaults do registry. O view model SHALL separar `current` (configuração efetivamente resolvida pelo `PersistedModelResolver`), `configured` (seleção persistida para diagnóstico, mesmo `deprecated`, `missing` ou inválida) e `default` (registry). Cada alvo exposto nesses blocos inclui `catalogStatus: active | deprecated | missing`, calculado pela tupla completa `(capability, provider, model, protocol)`; uma seleção configurada `missing` faz `current` voltar ao default e permanece diagnosticada em `configured`. `PUT` grava a seleção (primary + fallback opcional onde permitido) via RPC auditada; `DELETE` remove a seleção via RPC de reset auditada.

#### Scenario: GET retorna catálogo, seleções e defaults

- **WHEN** um admin chama `GET /api/admin/ai-model-selection`
- **THEN** retorna o catálogo ativo, as seleções vigentes por capacidade e os defaults do registry
- **AND** cada alvo efetivo (`primary` e `fallback`, quando houver) inclui `catalogStatus` com `active`, `deprecated` ou `missing`

#### Scenario: GET diferencia configuração efetiva e seleção diagnosticada

- **WHEN** uma seleção vigente aponta para uma linha deprecated, ou para uma tupla que não existe no catálogo
- **THEN** o GET retorna `catalogStatus = deprecated` no primeiro caso
- **AND** retorna `catalogStatus = missing` no segundo caso
- **AND** `current` usa o default quando a seleção configurada está `missing`, enquanto `configured` preserva o diagnóstico
- **AND** uma seleção `deprecated` válida permanece em `current` e tem origem `selection`
- **AND** a UI não trata `current`, `configured` e `default` como equivalentes

#### Scenario: PUT grava seleção auditada

- **WHEN** um admin chama `PUT` com capacidade, primary, fallback opcional e motivo válidos
- **THEN** a seleção é gravada e auditada
- **AND** o cache de resolução é invalidado

#### Scenario: DELETE restaura o padrão de forma auditada

- **WHEN** um admin chama `DELETE` com capacidade e motivo válidos
- **THEN** a seleção é removida via RPC de reset auditada
- **AND** o cache de resolução é invalidado

#### Scenario: Payload inválido é rejeitado

- **WHEN** o `PUT` recebe payload inválido (fallback incompleto, primary igual ao fallback, campos ausentes ou motivo ausente)
- **THEN** retorna 400 com detalhes de validação

### Requirement: UI segue o design system

A tela SHALL seguir `openspec/design-system/MASTER.md`: tema dark OLED (`#020617`/`#F8FAFC`/`#22C55E`), tipografia Poppins/Open Sans, ícones `lucide-react`, sem emojis e sem light mode.

#### Scenario: Consistência visual

- **WHEN** a tela é renderizada
- **THEN** usa os tokens/componentes do design system
- **AND** não introduz emojis como ícones nem estilos de light mode

### Requirement: Visibilidade do default, da origem e do pricing

A tela SHALL indicar, por capacidade, qual é o **default do registry**, qual a **origem** efetiva (seleção persistida × default) e se o pricing exigido pela capacidade está configurado. O admin SHALL poder **restaurar o padrão** de uma capacidade.

#### Scenario: Restaurar ao default

- **WHEN** o admin escolhe restaurar uma capacidade ao default
- **THEN** a seleção persistida é removida via RPC de reset auditada
- **AND** a capacidade volta a usar o default do registry

#### Scenario: Pricing faltante é visível

- **WHEN** o modelo selecionado não tem o pricing exigido pela capacidade
- **THEN** a tela sinaliza o pricing faltante
- **AND** a seleção não é bloqueada
