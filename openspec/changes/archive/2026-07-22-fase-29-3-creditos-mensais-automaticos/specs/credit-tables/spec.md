## MODIFIED Requirements

### Requirement: credit_balances table

**Changes**: 3 novas colunas adicionadas.

O sistema SHALL criar a tabela `credit_balances` com `store_id UUID PK REFERENCES stores(id) ON DELETE CASCADE`, `balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)`, `bonus_balance INTEGER NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0)`, `purchased_balance INTEGER NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0)`, `last_monthly_grant_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

#### Scenario: credit_balances has correct schema with buckets

- **WHEN** a migration é executada
- **THEN** `credit_balances` existe com colunas `store_id` (UUID PK), `balance` (INTEGER, DEFAULT 0, CHECK >=0), `bonus_balance` (INTEGER, DEFAULT 0, CHECK >=0), `purchased_balance` (INTEGER, DEFAULT 0, CHECK >=0), `last_monthly_grant_at` (TIMESTAMPTZ, nullable), `updated_at` (TIMESTAMPTZ, DEFAULT now())

#### Scenario: credit_balances rejects negative bonus_balance

- **WHEN** uma operação tenta definir `bonus_balance < 0`
- **THEN** o CHECK constraint `bonus_balance >= 0` rejeita

#### Scenario: credit_balances rejects negative purchased_balance

- **WHEN** uma operação tenta definir `purchased_balance < 0`
- **THEN** o CHECK constraint `purchased_balance >= 0` rejeita

#### Scenario: balance is always bonus_balance + purchased_balance

- **WHEN** `bonus_balance` ou `purchased_balance` é atualizado
- **THEN** `balance` é automaticamente sincronizado para `bonus_balance + purchased_balance` via trigger

### Requirement: credit_balances sync_balances trigger (NEW)

O sistema SHALL criar trigger `trg_credit_balances_sync_total` (BEFORE INSERT OR UPDATE) que executa `public.sync_credit_balances_total()` definindo `NEW.balance = NEW.bonus_balance + NEW.purchased_balance`.

#### Scenario: trigger updates balance on INSERT

- **WHEN** um novo registro é inserido em `credit_balances` com `bonus_balance = 5` e `purchased_balance = 3`
- **THEN** `balance` é automaticamente definido para `8`

#### Scenario: trigger updates balance on UPDATE

- **WHEN** `bonus_balance` é atualizado de `5` para `10` em um registro existente
- **THEN** `balance` é automaticamente atualizado para `10 + purchased_balance`

### Requirement: credit_balances monthly_grant index (NEW)

O sistema SHALL criar índice parcial `idx_credit_balances_monthly_grant` em `public.credit_balances (last_monthly_grant_at)` WHERE `last_monthly_grant_at IS NOT NULL`.

#### Scenario: monthly_grant index exists

- **WHEN** a migration é executada
- **THEN** o índice `idx_credit_balances_monthly_grant` existe em `credit_balances(last_monthly_grant_at)` com condição `WHERE last_monthly_grant_at IS NOT NULL`

### Requirement: credit_transactions type CHECK constraint (MODIFIED)

O sistema SHALL ter CHECK constraint que limita `type` a exatamente 7 valores: `'bonus_onboarding'`, `'bonus_monthly'`, `'admin_grant'`, `'purchase'`, `'deduction'`, `'refund'`, `'adjustment'`.

#### Scenario: new types are accepted

- **WHEN** INSERT com `type IN ('bonus_onboarding','bonus_monthly','admin_grant','purchase')`
- **THEN** o INSERT é aceito

#### Scenario: old grant type is rejected

- **WHEN** INSERT com `type = 'grant'`
- **THEN** o CHECK constraint rejeita

### Requirement: credit_transactions amount_sign CHECK constraint (MODIFIED)

O sistema SHALL ter CHECK constraint `chk_credit_transactions_amount_sign` que valida sinal do amount por tipo: `bonus_onboarding/bonus_monthly/admin_grant/purchase/refund > 0`, `deduction < 0`, `adjustment <> 0`.

#### Scenario: bonus_onboarding amount must be positive

- **WHEN** INSERT com `type = 'bonus_onboarding'` e `amount > 0`
- **THEN** INSERT é aceito
- **WHEN** INSERT com `type = 'bonus_onboarding'` e `amount <= 0`
- **THEN** CHECK constraint rejeita

#### Scenario: bonus_monthly amount must be positive

- **WHEN** INSERT com `type = 'bonus_monthly'` e `amount > 0`
- **THEN** INSERT é aceito
- **WHEN** INSERT com `type = 'bonus_monthly'` e `amount <= 0`
- **THEN** CHECK constraint rejeita

#### Scenario: admin_grant amount must be positive

- **WHEN** INSERT com `type = 'admin_grant'` e `amount > 0`
- **THEN** INSERT é aceito
- **WHEN** INSERT com `type = 'admin_grant'` e `amount <= 0`
- **THEN** CHECK constraint rejeita

#### Scenario: purchase amount must be positive

- **WHEN** INSERT com `type = 'purchase'` e `amount > 0`
- **THEN** INSERT é aceito
- **WHEN** INSERT com `type = 'purchase'` e `amount <= 0`
- **THEN** CHECK constraint rejeita

## ADDED Requirements

### Requirement: Immutable trigger desabilitado durante backfill

O sistema SHALL desabilitar temporariamente o trigger `trg_credit_transactions_immutable` em `credit_transactions` antes do backfill de `type`, e reabilitá-lo imediatamente após.

#### Scenario: trigger is dropped before backfill

- **WHEN** a migration executa o backfill de `credit_transactions.type`
- **THEN** o trigger `trg_credit_transactions_immutable` está desabilitado/droppado antes do UPDATE
- **AND** é recriado/reabilitado após o UPDATE

### Requirement: Backfill de transações existentes

A migration SHALL fazer backfill dos dados existentes em `credit_transactions` e `credit_balances`:

- `credit_transactions.type` = `'grant'` AND `reason` = `'onboarding'` → `'bonus_onboarding'`
- `credit_transactions.type` = `'grant'` AND `reason` != `'onboarding'` → `'admin_grant'`
- `credit_balances.bonus_balance` populado com o saldo atual (`balance`) de cada store
- `credit_balances.purchased_balance` = 0 para todas as stores existentes

#### Scenario: onboarding transactions are backfilled

- **WHEN** a migration é executada
- **THEN** toda transação com `type = 'grant'` e `reason = 'onboarding'` tem `type` alterado para `'bonus_onboarding'`

#### Scenario: admin grant transactions are backfilled

- **WHEN** a migration é executada
- **THEN** toda transação com `type = 'grant'` e `reason != 'onboarding'` tem `type` alterado para `'admin_grant'`

#### Scenario: bonus_balance is populated from existing balance

- **WHEN** a migration é executada
- **THEN** `credit_balances.bonus_balance` é populado com o valor atual de `balance` para cada store

#### Scenario: purchased_balance starts at zero

- **WHEN** a migration é executada
- **THEN** `credit_balances.purchased_balance` é 0 para todas as stores existentes
