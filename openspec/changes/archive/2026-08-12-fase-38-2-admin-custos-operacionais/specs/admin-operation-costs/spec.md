## MODIFIED Requirements

### Requirement: Página /admin/operation-costs

O sistema SHALL prover a página `/admin/operation-costs` (D10/D2) seguindo o padrão das páginas existentes (`/admin/users`, `/admin/metrics`):

- **Título visual "Configurações Econômicas"** — a **rota `/admin/operation-costs` é mantida** (não quebra bookmarks/testes/links existentes — D2); muda apenas o título/heading da página
- **Tabela de operações:** cada linha mostra `operation_key`, `cost_credits` (input numérico ≥1), toggle `enabled`, `updated_by` (email), `updated_at`, e badge `source` (`tabela`/`fallback`)
- **Editar custo:** campo numérico + **motivo obrigatório** + botão salvar → `PUT /api/admin/operation-costs`
- **Toggle habilitação:** switch com **motivo obrigatório** (mesmo RPC)
- **Seção "Parâmetros Econômicos" (F38.2 D2):** `usd_brl_rate` ("Taxa de conversão USD→BRL") e `credit_value_brl` ("Valor operacional do crédito em BRL"), cada um com input numérico, **motivo obrigatório**, badge `source` (`tabela`/`fallback`), e feedback `audit_id` após salvar via `PUT /api/admin/economic-parameters`
- **Feedback:** audit_id retornado e indicador de "não altera em produção até salvar"; estado de erro/load da chamada
- **Acesso:** apenas admin (guard da rota + nav admin). Link adicionado à navegação admin (`src/app/(app)/admin/layout.tsx`)

#### Scenario: Título visual "Configurações Econômicas" mantendo rota

- **WHEN** um admin acessa `/admin/operation-costs`
- **THEN** a página exibe o título "Configurações Econômicas" (heading) sem mudar a rota `/admin/operation-costs`

#### Scenario: Página lista operações com badge source

- **WHEN** um admin acessa `/admin/operation-costs`
- **THEN** a página exibe uma linha por operação com `operation_key`, custo, toggle, `updated_by`, `updated_at` e badge `source` (`tabela` ou `fallback`)

#### Scenario: Seção de Parâmetros Econômicos renderiza

- **WHEN** a página é renderizada
- **THEN** exibe a seção "Parâmetros Econômicos" com `usd_brl_rate` e `credit_value_brl`, cada um com badge `source` (`tabela` ou `fallback`) e descrição ("Taxa de conversão USD→BRL" / "Valor operacional do crédito em BRL")

#### Scenario: Editar parâmetro exige motivo

- **WHEN** um admin altera `usd_brl_rate` (ou `credit_value_brl`) e clica em salvar sem preencher o motivo
- **THEN** a página bloqueia o save e pede o motivo

#### Scenario: Salvar parâmetro chama PUT e mostra audit_id

- **WHEN** um admin altera `usd_brl_rate` com motivo válido e salva
- **THEN** a página chama `PUT /api/admin/economic-parameters`
- **AND** exibe feedback com o `audit_id` retornado

#### Scenario: Editar custo exige motivo

- **WHEN** um admin altera `cost_credits` e clica em salvar sem preencher o motivo
- **THEN** a página bloqueia o save e pede o motivo

#### Scenario: Salvar custo chama PUT e mostra audit_id

- **WHEN** um admin altera `cost_credits` com motivo válido e salva
- **THEN** a página chama `PUT /api/admin/operation-costs`
- **AND** exibe feedback com o `audit_id` retornado

#### Scenario: Toggle habilitação exige motivo

- **WHEN** um admin alterna o toggle `enabled` sem preencher o motivo
- **THEN** a página bloqueia o save e pede o motivo

#### Scenario: Link na navegação admin

- **WHEN** um admin abre a navegação admin
- **THEN** há um link para `/admin/operation-costs`
