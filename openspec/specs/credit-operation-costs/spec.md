# Credit Operation Costs

> Synced from `fase-38-credit-operation-costs` (ADDED).

## Purpose

Fonte única de custo por operação em créditos no banco: tabela `credit_operation_costs` (D2/D3), tabela append-only `credit_operation_cost_audit` (D8) e RPC transacional idempotente `admin_update_operation_cost` (D8) — com RLS service_role, sem GRANT para `authenticated` (o cliente recebe custos via `GET /api/operation-costs`, D11).

## Requirements

### Requirement: Tabela credit_operation_costs

O sistema SHALL criar a tabela `credit_operation_costs` como fonte única de custo por operação (D2), com:

```
credit_operation_costs
  operation_key    TEXT PRIMARY KEY          -- enum TS versionado (D7)
  cost_credits     INTEGER NOT NULL CHECK (cost_credits > 0)   -- D3
  enabled          BOOLEAN NOT NULL DEFAULT true
  updated_by       UUID REFERENCES auth.users(id)              -- NULL p/ seeds de sistema
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
```

- **RLS habilitado; acesso somente `service_role`** (mutações via RPC; leituras de admin via API sob `requireAdmin`). Sem GRANT para `authenticated` — o cliente não lê a tabela diretamente (recebe via `GET /api/operation-costs`, D11)
- **Trigger scoped** para `updated_at` (padrão do repositório, ex.: `credit_balances`)
- **Sem CHECK enum no banco** — o conjunto de chaves é versionado no TS (`OperationKey`, D7) e validado nos schemas Zod das rotas admin. Evita migration churn quando F37/temas adicionarem chaves
- **Seeds (migration):**
  ```sql
  INSERT INTO credit_operation_costs (operation_key, cost_credits, enabled) VALUES
    ('campaign_generation', 1, true),
    ('visual_signature_generation', 1, true)
  ON CONFLICT (operation_key) DO NOTHING;
  ```
- **`updated_by` NULL nas seeds** (criadas por sistema); todo UPDATE via admin preenche o ator (RPC exige `p_actor_id`)

#### Scenario: credit_operation_costs com schema correto

- **WHEN** a migration é executada
- **THEN** `credit_operation_costs` existe com colunas `operation_key` (TEXT PK), `cost_credits` (INTEGER NOT NULL CHECK > 0), `enabled` (BOOLEAN NOT NULL DEFAULT true), `updated_by` (UUID nullable), `updated_at` (TIMESTAMPTZ DEFAULT now()), `created_at` (TIMESTAMPTZ DEFAULT now())

#### Scenario: seeds aplicadas com custo 1 e habilitadas

- **WHEN** a migration é executada
- **THEN** existem as linhas `campaign_generation` (cost_credits=1, enabled=true) e `visual_signature_generation` (cost_credits=1, enabled=true)

#### Scenario: seeds são idempotentes

- **WHEN** a migration é executada em banco que já contém as linhas
- **THEN** nenhuma linha é duplicada (ON CONFLICT DO NOTHING)

#### Scenario: CHECK rejeita cost_credits zero ou negativo

- **WHEN** uma operação tenta inserir/atualizar `cost_credits = 0` (ou negativo)
- **THEN** o CHECK constraint `cost_credits > 0` rejeita

#### Scenario: RLS não permite acesso autenticado direto

- **WHEN** um usuário `authenticated` tenta SELECT ou UPDATE em `credit_operation_costs`
- **THEN** a operação é negada (RLS service_role)

### Requirement: Tabela credit_operation_cost_audit (append-only)

O sistema SHALL criar a tabela `credit_operation_cost_audit` para auditoria de mudanças de custo/habilitação (D8), append-only com trigger imutável (padrão `admin_audit_log`):

```
credit_operation_cost_audit
  id              UUID PK default gen_random_uuid()
  operation_key   TEXT NOT NULL
  action          TEXT NOT NULL CHECK (action IN ('update_cost','toggle_enabled'))
  old_cost_credits INTEGER
  new_cost_credits INTEGER
  old_enabled     BOOLEAN
  new_enabled     BOOLEAN
  actor_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  reason          TEXT NOT NULL
  operation_id    UUID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  ▸ idempotência: UNIQUE (operation_id) WHERE operation_id IS NOT NULL
```

- **Trigger imutável** bloqueia UPDATE e DELETE nas linhas da audit (append-only)
- **RLS service_role** em ambas as tabelas (sem GRANT para `authenticated`)

**Por que tabela própria (não `admin_audit_log`):** `admin_audit_log.target_id` é `UUID NOT NULL` e `target_type` tem CHECK apenas em `store`/`user`/`campaign`. Uma operação (`campaign_generation`) é texto. Evitar a evolução de `admin_audit_log` com `target_key` nesta fase mantém a tabela existente estável.

#### Scenario: audit armazena old/new de custo

- **WHEN** um UPDATE de `cost_credits` de 1 para 2 é executado via RPC
- **THEN** a audit ganha linha com `action='update_cost'`, `old_cost_credits=1`, `new_cost_credits=2`

#### Scenario: audit armazena old/new de habilitação

- **WHEN** um toggle de `enabled` de true para false é executado via RPC
- **THEN** a audit ganha linha com `action='toggle_enabled'`, `old_enabled=true`, `new_enabled=false`

#### Scenario: actor e reason obrigatórios

- **WHEN** a RPC é chamada sem `actor_id` ou com `reason` vazio
- **THEN** a transação falha (constraints `actor_id NOT NULL` e `reason NOT NULL`)

#### Scenario: idempotência por operation_id

- **WHEN** duas chamadas da RPC usam o mesmo `operation_id`
- **THEN** apenas uma linha de audit é inserida (UNIQUE parcial)

#### Scenario: audit imutável bloqueia UPDATE/DELETE

- **WHEN** um UPDATE ou DELETE é tentado em linha da audit
- **THEN** o trigger imutável bloqueia a operação

### Requirement: RPC admin_update_operation_cost

O sistema SHALL criar a SQL function `public.admin_update_operation_cost` (SECURITY DEFINER, `SET search_path=''`, padrão `admin_grant_credits`) que atualiza custo/habilitação de uma operação **e** escreve na audit **na mesma transação** (D8):

```
admin_update_operation_cost(
  p_actor_id UUID, p_operation_key TEXT,
  p_cost_credits INTEGER DEFAULT NULL,   -- omite p/ não alterar custo
  p_enabled BOOLEAN DEFAULT NULL,        -- omite p/ não alterar habilitação
  p_reason TEXT DEFAULT NULL,
  p_operation_id UUID DEFAULT NULL
) RETURNS JSONB { operation_key, cost_credits, enabled, audit_id, updated_at, idempotent }
```

- **Transacional:** exige **exatamente um** campo mutável por chamada (XOR — ou `cost_credits`, ou `enabled`, nunca ambos); se `operation_id` repetido → retorna audit existente (`idempotent: true`); captura old values; UPDATE na tabela; INSERT na audit — tudo numa transação
- `cost_credits` validado `> 0`; `operation_key` validado contra as chaves conhecidas no zod da rota (D7)
- **Regra de negócio:** toda mudança de custo/habilitação exige `reason` (rastreabilidade), consistente com `admin_grant_credits`

#### Scenario: RPC atualiza custo e escreve audit

- **WHEN** `admin_update_operation_cost` é chamado com `p_actor_id`, `p_operation_key='campaign_generation'`, `p_cost_credits=2`, `p_reason='Calibragem'`, `p_operation_id`
- **THEN** a tabela `credit_operation_costs` passa a `cost_credits=2`
- **AND** a audit ganha linha com old=1/new=2 e `actor_id`/`reason` preenchidos
- **AND** retorna `{ operation_key, cost_credits: 2, enabled, audit_id, updated_at, idempotent: false }`

#### Scenario: RPC toggle de habilitação

- **WHEN** `admin_update_operation_cost` é chamado com `p_enabled=false` (sem `p_cost_credits`)
- **THEN** `enabled` vira `false` na tabela
- **AND** a audit ganha linha `toggle_enabled` com old/new

#### Scenario: RPC idempotente em retry

- **WHEN** `admin_update_operation_cost` é chamado duas vezes com o mesmo `p_operation_id`
- **THEN** a segunda chamada retorna os dados da primeira com `idempotent: true` sem executar UPDATE nem INSERT

#### Scenario: RPC rejeita sem campo mutável

- **WHEN** `admin_update_operation_cost` é chamado com `p_cost_credits` e `p_enabled` ambos NULL
- **THEN** a transação falha (nada a atualizar)

#### Scenario: RPC rejeita custo e habilitação juntos

- **WHEN** `admin_update_operation_cost` é chamado com `p_cost_credits` E `p_enabled` no mesmo request
- **THEN** a transação falha (exatamente um campo mutável por chamada — XOR; a audit guarda uma ação por linha: `update_cost` ou `toggle_enabled`)

#### Scenario: RPC rejeita cost_credits inválido

- **WHEN** `admin_update_operation_cost` é chamado com `p_cost_credits=0` ou negativo
- **THEN** a transação falha

#### Scenario: RPC rollback em falha

- **WHEN** qualquer passo falha (ex.: `operation_key` inexistente na tabela)
- **THEN** nenhum UPDATE é persistido e nenhuma linha de audit é inserida (ROLLBACK)
