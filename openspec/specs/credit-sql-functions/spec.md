# Credit SQL Functions

> Synced from `fase-24-wallet-ledger-idempotencia` (ADDED), then `fase-26-admin-operacional` (ADDED). Added `admin_grant_credits` — RPC atômica que combina `grant_credits` + INSERT em `admin_audit_log` na mesma transação, com idempotência via `operation_id`.

## Purpose

SQL functions atômicas para mutações de saldo no ledger financeiro: `grant_credits`, `reserve_credit`, `refund_credit`, e `admin_grant_credits`. Todas usam `SELECT ... FOR UPDATE` para atomicidade e possuem idempotência via partial unique index.

## Requirements

### Requirement: grant_credits SQL function

O sistema SHALL criar a SQL function `public.grant_credits(p_store_id UUID, p_amount INTEGER, p_reason TEXT DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}') RETURNS UUID`.

#### Scenario: grant_credits with valid parameters creates transaction

- **WHEN** `grant_credits(store_id, 10, 'onboarding')` é chamado
- **THEN** insere transação `type = 'grant'`, `amount = 10` em `credit_transactions`
- **AND** `balance_before` é igual ao saldo lido antes do lock
- **AND** `balance_after` é igual a `balance_before + 10`
- **AND** atualiza `credit_balances.balance` incrementando em 10
- **AND** retorna UUID da transação criada

#### Scenario: grant_credits creates credit_balances row if not exists

- **WHEN** `grant_credits` é chamado para store sem registro em `credit_balances`
- **THEN** insere `credit_balances(store_id, balance=0)` via `INSERT ON CONFLICT DO NOTHING`
- **AND** a transação prossegue normalmente

#### Scenario: grant_credits uses SELECT FOR UPDATE

- **WHEN** `grant_credits` é chamado
- **THEN** faz `SELECT balance FROM credit_balances WHERE store_id = id FOR UPDATE`
- **AND** a transação completa com lock no registro

#### Scenario: grant_credits rejects non-positive amount

- **WHEN** `grant_credits` é chamado com `p_amount <= 0`
- **THEN** lança `RAISE EXCEPTION 'amount_invalido'`

#### Scenario: grant_credits idempotency returns existing transaction

- **WHEN** `grant_credits` é chamado duas vezes com mesmo `p_idempotency_key`
- **THEN** a segunda chamada retorna o mesmo UUID da primeira
- **AND** não insere nova transação

#### Scenario: grant_credits idempotency conflict raises exception

- **WHEN** `grant_credits` é chamado com `p_idempotency_key` já usado por transação de tipo diferente
- **THEN** lança `RAISE EXCEPTION 'idempotency_conflict'`

### Requirement: reserve_credit SQL function

O sistema SHALL criar a SQL function `public.reserve_credit(p_store_id UUID, p_amount INTEGER, p_campaign_id UUID DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}') RETURNS UUID`.

#### Scenario: reserve_credit with sufficient balance creates deduction

- **WHEN** `reserve_credit(store_id, 3)` é chamado com saldo >= 3
- **THEN** insere transação `type = 'deduction'`, `amount = -3` em `credit_transactions`
- **AND** `balance_before` é igual ao saldo lido antes do lock
- **AND** `balance_after` é igual a `balance_before - 3`
- **AND** atualiza `credit_balances.balance` decrementando em 3
- **AND** retorna UUID da transação criada

#### Scenario: reserve_credit with insufficient balance raises exception

- **WHEN** `reserve_credit(store_id, amount)` é chamado com `balance < amount`
- **THEN** lança `RAISE EXCEPTION 'saldo_insuficiente'`

#### Scenario: reserve_credit without credit_balances raises exception

- **WHEN** `reserve_credit(store_id, amount)` é chamado para store sem registro em `credit_balances`
- **THEN** lança `RAISE EXCEPTION 'saldo_inexistente'`

#### Scenario: reserve_credit uses SELECT FOR UPDATE

- **WHEN** `reserve_credit` é chamado
- **THEN** faz `SELECT balance FROM credit_balances WHERE store_id = id FOR UPDATE`

#### Scenario: reserve_credit rejects non-positive amount

- **WHEN** `reserve_credit` é chamado com `p_amount <= 0`
- **THEN** lança `RAISE EXCEPTION 'amount_invalido'`

#### Scenario: reserve_credit records campaign_id

- **WHEN** `reserve_credit` é chamado com `p_campaign_id` fornecido
- **THEN** a transação criada tem `campaign_id` preenchido

#### Scenario: reserve_credit idempotency returns existing deduction

- **WHEN** `reserve_credit` é chamado duas vezes com mesmo `p_idempotency_key`
- **THEN** a segunda chamada retorna o mesmo UUID da primeira
- **AND** não insere nova transação
- **AND** não deduz saldo novamente

#### Scenario: reserve_credit idempotency conflict raises exception

- **WHEN** `reserve_credit` é chamado com `p_idempotency_key` já usado por transação de tipo diferente
- **THEN** lança `RAISE EXCEPTION 'idempotency_conflict'`

### Requirement: refund_credit SQL function

O sistema SHALL criar a SQL function `public.refund_credit(p_tx_id UUID, p_reason TEXT DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}') RETURNS UUID`.

#### Scenario: refund_credit restores balance

- **WHEN** `refund_credit(tx_id, 'geracao_falhou')` é chamado para uma transação `type = 'deduction'`
- **THEN** insere transação `type = 'refund'` com `amount = ABS(original.amount)` em `credit_transactions`
- **AND** `reference = tx_id::text`
- **AND** `balance_before` é igual ao saldo lido antes do lock
- **AND** `balance_after` é igual a `balance_before + ABS(original.amount)`
- **AND** atualiza `credit_balances.balance` incrementando
- **AND** retorna UUID da transação de refund

#### Scenario: refund_credit with non-existent transaction raises exception

- **WHEN** `refund_credit` é chamado com `p_tx_id` que não existe
- **THEN** lança `RAISE EXCEPTION 'transacao_nao_encontrada'`

#### Scenario: refund_credit with non-deduction transaction raises exception

- **WHEN** `refund_credit` é chamado para transação que não é `type = 'deduction'`
- **THEN** lança `RAISE EXCEPTION 'tipo_invalido'`

#### Scenario: refund_credit duplicate is no-op (internal idempotency)

- **WHEN** `refund_credit(tx_id)` é chamado duas vezes para mesma deduction
- **THEN** a segunda chamada retorna UUID do refund existente
- **AND** não insere nova transação
- **AND** não dobra o saldo

#### Scenario: refund_credit idempotency returns existing refund

- **WHEN** `refund_credit` é chamado duas vezes com mesmo `p_idempotency_key`
- **THEN** a segunda chamada retorna o mesmo UUID da primeira
- **AND** não insere nova transação

#### Scenario: refund_credit idempotency conflict raises exception

- **WHEN** `refund_credit` é chamado com `p_idempotency_key` já usado por transação de tipo diferente
- **THEN** lança `RAISE EXCEPTION 'idempotency_conflict'`

#### Scenario: refund_credit uses SELECT FOR UPDATE

- **WHEN** `refund_credit` é chamado
- **THEN** faz `SELECT FROM credit_balances WHERE store_id = id FOR UPDATE`

### Requirement: admin_grant_credits SQL function

O sistema SHALL criar a SQL function `public.admin_grant_credits(p_actor_id UUID, p_store_id UUID, p_amount INTEGER, p_reason TEXT, p_operation_id UUID, p_metadata JSONB DEFAULT '{}'::jsonb) RETURNS JSONB`.

- Combina `grant_credits` + INSERT em `admin_audit_log` na mesma transação
- Idempotência via `operation_id`: SELECT existente → se encontrado, retorna sem executar
- IdempotencyKey do grant: `'admin_grant_' || p_operation_id`
- SECURITY DEFINER com SET search_path = ''
- Se qualquer passo falhar → ROLLBACK (atomicidade real)

#### Scenario: admin_grant_credits creates transaction and audit entry

- **WHEN** `admin_grant_credits(uuid, uuid, 10, 'crédito beta', gen_random_uuid())` é chamado
- **THEN** executa `grant_credits` criando transação em `credit_transactions`
- **AND** insere entry em `admin_audit_log` com `action='credit_grant'`
- **AND** retorna JSON com `{ transaction_id, audit_id }`

#### Scenario: admin_grant_credits returns existing data on duplicate operation_id

- **WHEN** `admin_grant_credits` é chamado duas vezes com mesmo `p_operation_id`
- **THEN** segunda chamada retorna mesmo `transaction_id` e `audit_id`
- **AND** não executa novo grant nem INSERT

#### Scenario: admin_grant_credits rollback on failure

- **WHEN** `grant_credits` falha (ex.: store inexistente)
- **THEN** nenhuma entry em `admin_audit_log` é criada
- **AND** exceção é propagada
