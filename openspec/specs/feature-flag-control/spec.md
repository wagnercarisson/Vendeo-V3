# Feature Flag Control

> Synced from `fase-43-revisao-brief-pre-geracao` (ADDED), then `fase-37-1-approval-gate-candidata-unica` (ADDED — flag `campaign_approval_enabled`, D1).

## Purpose

Infraestrutura de flags administrativas na tabela **`feature_flags`** (NÃO env var como decisão principal). A primeira flag (`force_brief_vision_check`, F43 D5) reativa a validação IA produto×imagem mesmo com a revisão humana do brief confirmada. A **fatia 37.1 (F37 D1)** adiciona a flag **`campaign_approval_enabled`** — quando ligada, campanhas novas entram no fluxo de revisão/aprovação da arte antes da entrega (download + Kit de Publicação); campanhas antigas (sem versões de arte) continuam entregues como hoje. Leitura via serviço dedicado com **fail-closed** (`isCampaignApprovalEnabled()` → `readFlag(key, false)`); mutação via RPC/admin route com **motivo obrigatório** + auditoria (`admin_audit_log`: action `feature_flag_update`, target_type `feature_flag`); tela no admin ("Controles operacionais") sem redeploy; reuso do `ALL_FEATURE_FLAG_KEYS` sem novo RPC/CHECK.

## Requirements

### Requirement: Flag campaign_approval_enabled

> Added by `fase-37-1-approval-gate-candidata-unica` (D1, padrão F43/QCW).

O sistema SHALL adicionar a flag **`campaign_approval_enabled`** à infraestrutura `feature_flags` (F37 D1, padrão F43/QCW):

- Constante `CAMPAIGN_APPROVAL_ENABLED_KEY = "campaign_approval_enabled"` em `feature-flag-service.ts`.
- Inclusão em `ALL_FEATURE_FLAG_KEYS` — a tela admin "Controles operacionais" (`admin/feature-flags`) e o `GET /api/admin/feature-flags` passam a listá-la automaticamente.
- Método `isCampaignApprovalEnabled(): Promise<boolean>` → `readFlag(CAMPAIGN_APPROVAL_ENABLED_KEY, false)` — **fail-closed**: falha de leitura/not-found → `false` (comportamento atual, entrega livre); **sem `envOverride`** para esta flag (a decisão principal é a tabela, não env var).
- Seed na migration da fatia: `campaign_approval_enabled = false` (padrão recomendado — Desligada), descrição administrativa clara; `ON CONFLICT (key) DO NOTHING`.
- **Sem novo RPC e sem novo CHECK:** `admin_update_feature_flag` é genérico por `key` e os CHECKs `feature_flag_update`/`feature_flag` já existem (F43) — a mutação com motivo obrigatório + auditoria funciona para a nova flag sem mudança.

#### Scenario: Flag seed desligada

- **WHEN** a migration da fatia 37.1 é aplicada
- **THEN** existe uma linha `campaign_approval_enabled` com `enabled = false` (padrão recomendado) e a descrição administrativa

#### Scenario: Leitura fail-closed (flag desligada / falha)

- **WHEN** a flag `campaign_approval_enabled` está desligada (ou a leitura falha) durante um fluxo de campanha
- **THEN** `isCampaignApprovalEnabled()` retorna `false`
- **AND** o comportamento atual é preservado (entrega imediata, download livre, copy visível) — a flag nunca derruba o fluxo

#### Scenario: Flag ligada habilita o fluxo de aprovação

- **WHEN** a flag `campaign_approval_enabled` está `enabled = true` na tabela
- **THEN** `isCampaignApprovalEnabled()` retorna `true`
- **AND** campanhas novas entram no fluxo de revisão/aprovação

#### Scenario: Tela Controles operacionais exibe a nova flag

- **WHEN** um admin abre "Controles operacionais"
- **THEN** a flag `campaign_approval_enabled` é exibida com descrição e estado atual
- **AND** a alteração com **motivo obrigatório** é persistida e auditada (`feature_flag_update`) — sem nova action/target_type

### Requirement: Tabela feature_flags com colunas mínimas

O sistema SHALL prover a tabela `feature_flags` com colunas mínimas para a flag administrativa de reativação (D5):

- `id` UUID PRIMARY KEY `DEFAULT gen_random_uuid()` — **obrigatório** para o `admin_audit_log.target_id UUID NOT NULL` (constraint existente — a auditoria referencia o `id`, não a `key`).
- `key` TEXT UNIQUE NOT NULL — chave da flag (ex.: `force_brief_vision_check`).
- `enabled` BOOLEAN NOT NULL DEFAULT false — `false` é o padrão recomendado (Desligada); `true` força a validação IA.
- `description` TEXT — texto administrativo exibido na tela.
- `updated_by` UUID — autor da última alteração.
- `updated_at` TIMESTAMPTZ — momento da última alteração.

- **NÃO é um sistema universal de flags:** sem segmentação por loja, sem rollout %, sem agendamento, sem cache complexo, sem UI elaborada.
- A migration SHALL ser idempotente e não destrutiva.
- A primeira (e única, nesta fase) flag SHALL ser `force_brief_vision_check` com `enabled = false`.
- A auditoria (`admin_audit_log`) SHALL usar `target_type = "feature_flag"` e `target_id = feature_flags.id` (UUID — atendendo ao `target_id UUID NOT NULL`); a `key` vai no `metadata.key` para identificação da flag.

#### Scenario: Tabela criada com colunas e flag seed

- **WHEN** a migration da F43 é aplicada
- **THEN** a tabela `feature_flags` existe com `id` UUID PRIMARY KEY, `key` (única), `enabled`, `description`, `updated_by`, `updated_at`
- **AND** há uma linha `force_brief_vision_check` com `enabled = false` (padrão recomendado)

#### Scenario: Migration idempotente

- **WHEN** a migration da F43 é aplicada novamente
- **THEN** nenhum erro ocorre (idempotente)

#### Scenario: feature_flags.id alimenta o target_id da auditoria

- **WHEN** uma alteração da flag é auditada
- **THEN** `admin_audit_log.target_id` recebe o `id` UUID da linha `feature_flags` (não a `key` — o `target_id` é UUID NOT NULL)
- **AND** `metadata.key` identifica a flag (`"force_brief_vision_check"`)

### Requirement: Mutação da flag com motivo obrigatório e auditoria

O sistema SHALL prover mutação da flag via RPC/admin route com **motivo obrigatório** (D5), de forma idempotente e atômica (precedente `admin_review_access_request`):

- O corpo da alteração SHALL conter `key`, `enabled` (novo valor) e `reason` (obrigatório, não vazio).
- A mutação SHALL persistir `enabled`, `updated_by` (autor) e `updated_at` na mesma transação.
- A auditoria SHALL ser registrada na **mesma transação** em `admin_audit_log` com:
  - `action: "feature_flag_update"` (nova action — exige estender o CHECK).
  - `target_type: "feature_flag"` (novo target_type — exige estender o CHECK).
  - `target_id: feature_flags.id` (UUID — atende ao `target_id UUID NOT NULL` existente; a `key` vai no metadata).
  - `metadata` contendo `key`, `old_value`, `new_value` e `reason`.
- Os CHECKs de `admin_audit_log` (action/target_type) SHALL ser estendidos sem quebrar valores existentes (padrão F33/F42 — `ALTER TABLE ... DROP/ADD CONSTRAINT`).

#### Scenario: Alteração com motivo persiste e audita

- **WHEN** um admin altera `force_brief_vision_check` de `false` para `true` com motivo
- **THEN** a linha é persistida com `enabled = true`, `updated_by` = autor, `updated_at` = agora
- **AND** um registro em `admin_audit_log` é criado com `action: "feature_flag_update"`, `target_type: "feature_flag"`, `target_id` = `feature_flags.id` (UUID), `metadata { key: "force_brief_vision_check", old_value: false, new_value: true, reason }`

#### Scenario: Motivo ausente bloqueia a alteração

- **WHEN** um admin tenta alterar a flag sem motivo
- **THEN** a alteração é rejeitada (motivo obrigatório)
- **AND** nenhum registro de auditoria é criado

#### Scenario: Valores existentes de auditoria não quebram

- **WHEN** os CHECKs de `admin_audit_log` são estendidos
- **THEN** as actions/target_types existentes continuam válidos (sem quebra)

### Requirement: Leitura da flag com fallback que não derruba geração

O sistema SHALL prover um serviço de leitura da flag `force_brief_vision_check` para o backend de geração (D5) com **fallback seguro**:

- Leitura normal: `enabled` retornado da tabela `feature_flags`.
- **Fallback de leitura:** falha na leitura do banco durante uma geração → `enabled = false` (fluxo padrão: revisão humana + pular vision), **NÃO bloqueia a geração**, log de warning/erro operacional.
- **Env var emergencial opcional:** `VENDEO_FORCE_BRIEF_VISION_CHECK=true` pode forçar `enabled = true` se existir (trava de emergência infra) — nunca é a decisão principal.
- A leitura é via **serviço dedicado** (padrão `OperationCostService`/`EconomicParameterService`), NÃO via `getLaunchConfig()`/env var como decisão principal.

#### Scenario: Leitura normal retorna o valor da tabela

- **WHEN** `force_brief_vision_check` está `enabled = true` na tabela e a leitura não falha
- **THEN** o serviço retorna `true`

#### Scenario: Falha de leitura não bloqueia a geração

- **WHEN** a leitura da flag falha (banco indisponível) durante uma geração
- **THEN** o serviço retorna `false` (fallback seguro)
- **AND** a geração segue normalmente (validação vision pulada no caminho `brief_review_confirmed`)
- **AND** um warning/erro operacional é logado

#### Scenario: Env var emergencial pode forçar true

- **WHEN** `VENDEO_FORCE_BRIEF_VISION_CHECK=true` existe e a leitura da tabela falha
- **THEN** o serviço pode retornar `true` (fail-safe emergencial)

### Requirement: Tela admin de controle operacional da flag

O sistema SHALL prover uma tela no admin ("Controles operacionais") para operar a flag `force_brief_vision_check` sem redeploy (D5):

- Exibe o nome/chave da flag, a descrição administrativa e o estado atual (ligada/desligada).
- Descrição clara: *"Quando ligada, o Vendeo executa novamente a validação por IA das imagens mesmo depois da revisão humana do brief. Use apenas para diagnóstico, auditoria ou se houver suspeita de que campanhas problemáticas estão passando pela revisão humana."*
- Estados: **Desligada — padrão recomendado** / **Ligada — força validação IA além da revisão humana**.
- Alteração exige **motivo obrigatório** (persistido + auditado).
- Acesso protegido por `requireAdmin` (padrão existente).
- A tela SHALL refletir a alteração após salvar (recarregar estado da flag).

#### Scenario: Tela exibe a flag com descrição e estados

- **WHEN** um admin abre "Controles operacionais"
- **THEN** a flag `force_brief_vision_check` é exibida com a descrição administrativa e o estado atual
- **AND** os estados "Desligada — padrão recomendado" e "Ligada — força validação IA além da revisão humana" são apresentados

#### Scenario: Alteração na tela exige motivo e persiste

- **WHEN** um admin altera o estado da flag na tela e informa motivo
- **THEN** a alteração é persistida (com `updated_by`/`updated_at`) e auditada (`feature_flag_update`)
- **AND** a tela reflete o novo estado

#### Scenario: Alteração sem motivo é bloqueada na tela

- **WHEN** um admin tenta alterar o estado da flag sem motivo
- **THEN** a tela bloqueia a alteração ("Motivo obrigatório")

#### Scenario: Acesso não-admin é negado

- **WHEN** um usuário sem privilégio admin tenta acessar a tela
- **THEN** o acesso é negado (padrão `requireAdmin`)