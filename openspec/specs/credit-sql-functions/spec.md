# Credit SQL Functions

> Synced from `fase-24-wallet-ledger-idempotencia` (ADDED), then `fase-26-admin-operacional` (ADDED). Added `admin_grant_credits`. Then `fase-29-3-creditos-mensais-automaticos` (MODIFIED) — `grant_credits` ganhou 6º parâmetro `p_type`, `reserve_credit` e `refund_credit` reescritas com lógica bucket-aware (bônus primeiro, metadata com bonus_amount/purchased_amount).

## Purpose

SQL functions atômicas para mutações de saldo no ledger financeiro: `grant_credits`, `reserve_credit`, `refund_credit`, e `admin_grant_credits`. Todas usam `SELECT ... FOR UPDATE` para atomicidade e possuem idempotência via partial unique index.

## Requirements

### Requirement: grant_credits SQL function (MODIFIED F29.3)

**F29.3 Changes**: Novo parâmetro `p_type TEXT DEFAULT 'admin_grant'` (6º parâmetro). Overload antigo de 5 parâmetros droppado. Função direciona ao bucket correto conforme `p_type`.

O sistema SHALL criar a SQL function `public.grant_credits(p_store_id UUID, p_amount INTEGER, p_reason TEXT DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb, p_type TEXT DEFAULT 'admin_grant') RETURNS UUID`.

- Overload antigo `public.grant_credits(UUID, INTEGER, TEXT, TEXT, JSONB)` deve ser droppado com `DROP FUNCTION IF EXISTS` antes do `CREATE OR REPLACE`
- `p_type` aceita: `'bonus_onboarding'`, `'bonus_monthly'`, `'admin_grant'`, `'purchase'`
- Quando `p_type IN ('bonus_onboarding','bonus_monthly','admin_grant')`: incrementa `bonus_balance`
- Quando `p_type = 'purchase'`: incrementa `purchased_balance`
- Chamadores existentes (sem `p_type`) usam default `'admin_grant'` e funcionam sem alteração

#### Scenario: grant_credits with bonus_onboarding increments bonus_balance

- **WHEN** `grant_credits(store_id, 10, 'onboarding', NULL, '{}', 'bonus_onboarding')` é chamado
- **THEN** insere transação `type = 'bonus_onboarding'`, `amount = 10` em `credit_transactions`
- **AND** `balance_before` é igual ao saldo lido antes do lock
- **AND** `balance_after` é igual a `balance_before + 10`
- **AND** atualiza `credit_balances.bonus_balance` incrementando em 10
- **AND** `credit_balances.purchased_balance` não é alterado

#### Scenario: grant_credits with purchase increments purchased_balance

- **WHEN** `grant_credits(store_id, 50, 'compra', NULL, '{}', 'purchase')` é chamado
- **THEN** insere transação `type = 'purchase'`
- **AND** atualiza `credit_balances.purchased_balance` incrementando em 50
- **AND** `credit_balances.bonus_balance` não é alterado

#### Scenario: grant_credits with default p_type uses admin_grant

- **WHEN** `grant_credits(store_id, 10, 'crédito beta')` é chamado (sem `p_type`)
- **THEN** insere transação `type = 'admin_grant'`
- **AND** atualiza `credit_balances.bonus_balance` incrementando em 10

#### Scenario: grant_credits creates credit_balances row if not exists

- **WHEN** `grant_credits` é chamado para store sem registro em `credit_balances`
- **THEN** insere `credit_balances(store_id, balance=0, bonus_balance=0, purchased_balance=0)` via `INSERT ON CONFLICT DO NOTHING`
- **AND** a transação prossegue normalmente

#### Scenario: grant_credits uses SELECT FOR UPDATE

- **WHEN** `grant_credits` é chamado
- **THEN** faz `SELECT balance, bonus_balance, purchased_balance FROM credit_balances WHERE store_id = id FOR UPDATE`
- **AND** a transação completa com lock no registro

#### Scenario: grant_credits rejects non-positive amount

- **WHEN** `grant_credits` é chamado com `p_amount <= 0`
- **THEN** lança `RAISE EXCEPTION 'amount_invalido'`

#### Scenario: grant_credits idempotency accepts new types

- **WHEN** `grant_credits` é chamado duas vezes com mesmo `p_idempotency_key` e `p_type = 'bonus_monthly'`
- **THEN** a segunda chamada retorna o mesmo UUID da primeira
- **AND** não insere nova transação

#### Scenario: grant_credits idempotency conflict raises exception

- **WHEN** `grant_credits` é chamado com `p_idempotency_key` já usado por transação de tipo diferente
- **THEN** lança `RAISE EXCEPTION 'idempotency_conflict'`

### Requirement: reserve_credit SQL function (MODIFIED F29.3)

**F29.3 Changes**: Lógica de dedução alterada para consumir de `bonus_balance` primeiro, `purchased_balance` por último. Metadata da transação registra `bonus_amount` e `purchased_amount`. Assinatura inalterada.

O sistema SHALL manter a SQL function `public.reserve_credit(p_store_id UUID, p_amount INTEGER, p_campaign_id UUID DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}') RETURNS UUID` com lógica bucket-aware:

```
amount_restante := p_amount;
deduct_from_bonus := LEAST(bonus_balance, amount_restante);
bonus_balance := bonus_balance - deduct_from_bonus;
amount_restante := amount_restante - deduct_from_bonus;
deduct_from_purchased := LEAST(purchased_balance, amount_restante);
purchased_balance := purchased_balance - deduct_from_purchased;
amount_restante := amount_restante - deduct_from_purchased;
IF amount_restante > 0 THEN RAISE EXCEPTION 'saldo_insuficiente'; END IF;
p_metadata := p_metadata || jsonb_build_object('bonus_amount', deduct_from_bonus, 'purchased_amount', deduct_from_purchased);
```

#### Scenario: reserve_credit deducts from bonus first

- **WHEN** `reserve_credit(store_id, 3)` é chamado com `bonus_balance = 5` e `purchased_balance = 10`
- **THEN** deduz 3 de `bonus_balance`
- **AND** `purchased_balance` permanece 10
- **AND** metadata contém `bonus_amount: 3, purchased_amount: 0`

#### Scenario: reserve_credit deducts from purchased after bonus exhausted

- **WHEN** `reserve_credit(store_id, 8)` é chamado com `bonus_balance = 5` e `purchased_balance = 10`
- **THEN** deduz 5 de `bonus_balance` (zera)
- **AND** deduz 3 de `purchased_balance`
- **AND** metadata contém `bonus_amount: 5, purchased_amount: 3`

#### Scenario: reserve_credit with insufficient total balance rolls back

- **WHEN** `reserve_credit(store_id, 20)` é chamado com `bonus_balance = 5` e `purchased_balance = 10`
- **THEN** a função calcula `deduct_from_bonus = 5`, `deduct_from_purchased = 10`, `amount_restante = 5`
- **AND** lança `RAISE EXCEPTION 'saldo_insuficiente'` — a transação inteira é revertida
- **AND** nenhuma alteração persiste em `credit_balances` (ROLLBACK desfaz as deduções)
- **AND** nenhuma transação `deduction` é inserida em `credit_transactions`

#### Scenario: reserve_credit without credit_balances raises exception

- **WHEN** `reserve_credit(store_id, amount)` é chamado para store sem registro em `credit_balances`
- **THEN** lança `RAISE EXCEPTION 'saldo_inexistente'`

#### Scenario: reserve_credit uses SELECT FOR UPDATE

- **WHEN** `reserve_credit` é chamado
- **THEN** faz `SELECT balance, bonus_balance, purchased_balance FROM credit_balances WHERE store_id = id FOR UPDATE`

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

### Requirement: refund_credit SQL function (MODIFIED F29.3)

**F29.3 Changes**: Lógica alterada para restaurar buckets exatos. Lê `metadata.bonus_amount` e `metadata.purchased_amount` da deduction original e restaura cada bucket individualmente. Fallback para deductions antigas: trata valor total como `bonus_amount`.

O sistema SHALL manter a função `public.refund_credit(p_tx_id UUID, p_reason TEXT DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}') RETURNS UUID` com lógica bucket-aware: lê `metadata.bonus_amount` e `metadata.purchased_amount` da transação original e restaura cada bucket. Para deductions sem metadata (pré-F29.3), fallback trata `ABS(original.amount)` como `bonus_amount`.

#### Scenario: refund_credit restores buckets from metadata

- **WHEN** `refund_credit(tx_id)` é chamado para uma deduction com `metadata = {"bonus_amount": 5, "purchased_amount": 3}`
- **THEN** insere transação `type = 'refund'` com `amount = 8`
- **AND** incrementa `bonus_balance` em 5
- **AND** incrementa `purchased_balance` em 3

#### Scenario: refund_credit legacy deduction fallback to bonus

- **WHEN** `refund_credit(tx_id)` é chamado para uma deduction criada antes de F29.3 (sem bonus_amount/purchased_amount no metadata)
- **THEN** trata valor total como `bonus_amount` via `ABS(original.amount)`
- **AND** incrementa `bonus_balance` pelo valor total
- **AND** `purchased_balance` não é alterado

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

- Passo 1: Idempotência — SELECT `operation_id` existente em `admin_audit_log`. Se encontrado, retorna dados sem executar nada
- Passo 2: Chama `public.grant_credits(p_store_id, p_amount, p_reason, 'admin_grant_' || p_operation_id, p_metadata)` — o `p_type` default (`admin_grant`) direciona ao `bonus_balance`
- Passo 3: INSERT em `admin_audit_log` com `action='credit_grant'`, metadata incluindo `amount, transaction_id, grant_type: 'admin_grant'`
- SECURITY DEFINER com SET search_path = ''
- Se qualquer passo falhar → ROLLBACK (atomicidade real)

#### Scenario: admin_grant_credits increments bonus_balance

- **WHEN** `admin_grant_credits(uuid, uuid, 10, 'crédito beta', gen_random_uuid())` é chamado
- **THEN** executa `grant_credits` com `p_type = 'admin_grant'`
- **AND** incrementa `bonus_balance` (não `purchased_balance`)
- **AND** insere entry em `admin_audit_log` com `action='credit_grant'`
- **AND** retorna JSON com `transaction_id` e `audit_id`

#### Scenario: admin_grant_credits returns existing data on duplicate operation_id

- **WHEN** `admin_grant_credits` é chamado duas vezes com mesmo `p_operation_id`
- **THEN** segunda chamada retorna mesmo `transaction_id` e `audit_id`
- **AND** não executa novo grant nem INSERT

#### Scenario: admin_grant_credits rollback on failure

- **WHEN** `grant_credits` falha (ex.: store inexistente)
- **THEN** nenhuma entry em `admin_audit_log` é criada
- **AND** exceção é propagada
