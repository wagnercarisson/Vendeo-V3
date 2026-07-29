> Synced from `fase-33-verificacao-cnpj-freemium` (ADDED).

## Purpose

Fila de revisão cadastral em `/admin/reviews` com abas (Pendentes/Adiados/Recusados/Aprovados), paginação, filtro por motivo, ações Aprovar/Recusar/Exceção, revelação auditada de CNPJ e consulta externa. Endpoints REST em `/api/admin/reviews`.

## Requirements

### Requirement: Página /admin/reviews — fila de revisão cadastral

O sistema SHALL prover uma página `/admin/reviews` com a fila de revisão cadastral, exibindo lojas que aguardam decisão manual (REVIEW), além de lojas adiadas (DEFER) e rejeitadas (REJECTED).

#### Scenario: Abas por status

- **WHEN** admin acessa `/admin/reviews`
- **THEN** exibe abas: "Pendentes" (REVIEW) | "Adiados" (DEFER) | "Recusados" (REJECTED) | "Aprovados" (APPROVED)
- **AND** aba "Pendentes" (REVIEW) é selecionada por padrão

#### Scenario: CNPJ inexistente não entra na fila

- **WHEN** CNPJ é inexistente na Receita (not_found)
- **THEN** criação é bloqueada
- **AND** não há store para entrar na fila de revisão

#### Scenario: Listagem com CNPJ mascarado

- **WHEN** admin visualiza listagem de revisões
- **THEN** cada item mostra CNPJ no formato `**.***.***/0001-**` (mascarado)
- **AND** não há opção de revelar CNPJ na listagem

#### Scenario: Paginação funcional

- **WHEN** há mais itens que o limite por página
- **THEN** navegação de páginas é exibida ([<] [1] [2] [3] [>])

#### Scenario: Cada item mostra dados completos

- **WHEN** admin visualiza a listagem
- **THEN** cada item exibe:
  - Nome da loja
  - CNPJ mascarado
  - Email do usuário
  - Data de criação
  - Motivos (tags: nome_divergente, cidade_divergente, cnpj_inativo, etc.)
  - Decisão do sistema (automática)
  - Dados oficiais expansíveis

#### Scenario: Dados oficiais expansíveis

- **WHEN** admin clica para expandir dados oficiais
- **THEN** exibe: razão social, nome fantasia, situação cadastral, endereço completo, CNAE, data de abertura

### Requirement: API /api/admin/reviews

O sistema SHALL prover endpoints REST para gerenciamento da fila de revisão.

#### Scenario: GET /api/admin/reviews lista lojas por status

- **WHEN** `GET /api/admin/reviews?status=review` é chamado
- **THEN** retorna lista paginada de lojas no status especificado
- **AND** cada item inclui: id, nome, CNPJ mascarado, email, data, motivos, decisão, dados oficiais

#### Scenario: GET /api/admin/reviews/[id] retorna detalhe

- **WHEN** `GET /api/admin/reviews/[id]` é chamado
- **THEN** retorna detalhe completo: dados oficiais, sinais de avaliação, motivos, histórico de ações

### Requirement: Ação "Aprovar"

O sistema SHALL prover ação "Aprovar" que tenta conceder onboarding normal e registra no audit log.

#### Scenario: Aprovar concede onboarding se raiz elegível

- **WHEN** admin clica "Aprovar" em uma loja em REVIEW
- **THEN** `verification_status` muda para `approved`
- **AND** tenta conceder `onboarding` normal (INSERT em freemium_entitlements)
- **AND** se raiz ainda elegível, grant de 10 créditos é concedido
- **AND** registra em `admin_audit_log` com `action = 'approve_verification'`

#### Scenario: Aprovar não concede se raiz já usou

- **WHEN** admin clica "Aprovar"
- **AND** raiz já consumiu onboarding (entitlement existe)
- **THEN** loja fica `approved` sem créditos
- **AND** registra em `admin_audit_log` com `onboarding_granted = false`

### Requirement: Ação "Recusar"

O sistema SHALL prover ação "Recusar" que mantém loja rejeitada sem créditos.

#### Scenario: Recusar mantém rejected

- **WHEN** admin clica "Recusar"
- **THEN** `verification_status` muda para `rejected`
- **AND** nenhum grant é concedido
- **AND** registra em `admin_audit_log` com `action = 'reject_verification'`

### Requirement: Ação "Conceder Exceção"

O sistema SHALL prover ação "Exceção" que concede créditos via `admin_exception` (bypassa regras de elegibilidade).

#### Scenario: Exceção concede independente do status

- **WHEN** admin clica "Conceder Exceção"
- **AND** informa reason obrigatório
- **THEN** concede grant com `benefit_type = 'admin_exception'`
- **AND** `verification_status` permanece ou muda para `approved`
- **AND** registra em `admin_audit_log` com `action = 'admin_exception'`

#### Scenario: Exceção funciona mesmo para CNPJ baixado/nulo

- **WHEN** admin clica "Conceder Exceção" em loja com CNPJ baixado
- **THEN** grant é concedido (bypassa regra de elegibilidade)
- **AND** registra em `admin_audit_log`

### Requirement: Botão "Revelar CNPJ"

O sistema SHALL prover botão "Revelar CNPJ" na página de detalhe que exibe CNPJ completo com registro em audit log.

#### Scenario: Revelar CNPJ mostra completo e audita

- **WHEN** admin clica "Revelar CNPJ" na página de detalhe
- **THEN** CNPJ completo (14 dígitos) é exibido
- **AND** registra em `admin_audit_log`: `action = 'reveal_cnpj', target = store_id`
- **AND** CNPJ permanece visível até admin navegar para outra página

#### Scenario: Revelar CNPJ exige permissão admin

- **WHEN** usuário sem permissão admin tenta revelar CNPJ
- **THEN** ação é bloqueada (requireAdmin)

#### Scenario: CNPJ permanece mascarado na listagem após revelação

- **WHEN** admin revela CNPJ na página de detalhe
- **AND** volta para listagem
- **THEN** listagem continua mostrando CNPJ mascarado

### Requirement: Botão "Consultar na Receita"

O sistema SHALL prover botão "Consultar na Receita" que abre BrasilAPI ou CNPJá em nova aba.

#### Scenario: Consultar na Receita abre API externa

- **WHEN** admin clica "Consultar na Receita"
- **THEN** abre URL da BrasilAPI ou CNPJá em nova aba com CNPJ normalizado
- **AND** não registra em audit log (é ação de navegação, não decisão)

### Requirement: Filtro por motivo de revisão

O sistema SHALL prover filtro por motivo de revisão na página `/admin/reviews`.

#### Scenario: Filtrar por motivo

- **WHEN** admin seleciona filtro `nome_divergente`
- **THEN** lista apenas lojas com `nome_divergente` em `verification_reasons`
