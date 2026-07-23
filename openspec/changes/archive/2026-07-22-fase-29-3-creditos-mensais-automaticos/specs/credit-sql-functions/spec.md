## MODIFIED Requirements

### Requirement: grant_credits SQL function

**Changes**: Novo parâmetro `p_type TEXT DEFAULT 'admin_grant'` (6º parâmetro). Overload antigo de 5 parâmetros droppado. Função direciona ao bucket correto conforme `p_type`.

O sistema SHALL criar a SQL function `public.grant_credits(p_store_id UUID, p_amount INTEGER, p_reason TEXT DEFAULT NULL, p_idempotency_key TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}', p_type TEXT DEFAULT 'admin_grant') RETURNS UUID`.

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

#### Scenario: grant_credits idempotency accepts new types

- **WHEN** `grant_credits` é chamado duas vezes com mesmo `p_idempotency_key` e `p_type = 'bonus_monthly'`
- **THEN** a segunda chamada retorna o mesmo UUID da primeira
- **AND** não insere nova transação

### Requirement: reserve_credit SQL function (MODIFIED)

**Changes**: Lógica de dedução alterada para consumir de `bonus_balance` primeiro, `purchased_balance` por último. Metadata da transação registra `bonus_amount` e `purchased_amount`. Assinatura inalterada.

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

### Requirement: refund_credit SQL function (MODIFIED)

**Changes**: Lógica alterada para restaurar buckets exatos. Lê `metadata.bonus_amount` e `metadata.purchased_amount` da deduction original e restaura cada bucket individualmente. Fallback para deductions antigas: trata valor total como `bonus_amount`.

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

