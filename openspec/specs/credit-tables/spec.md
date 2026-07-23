# Credit Tables

> Synced from `fase-24-wallet-ledger-idempotencia` (ADDED), then `fase-29-3-creditos-mensais-automaticos` (MODIFIED). Added bucket columns (`bonus_balance`, `purchased_balance`, `last_monthly_grant_at`), sync trigger `trg_credit_balances_sync_total`, partial index, expanded CHECK constraints to 7 transaction types, and backfill logic.

## Purpose

Schema das tabelas de ledger financeiro: `credit_balances` (saldo materializado por loja com buckets bônus/compra) e `credit_transactions` (ledger append-only com idempotência, RLS e trigger de blindagem imutável).

## Requirements

### Requirement: credit_balances table

O sistema SHALL criar a tabela `credit_balances` com `store_id UUID PK REFERENCES stores(id) ON DELETE CASCADE`, `balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)`, `bonus_balance INTEGER NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0)`, `purchased_balance INTEGER NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0)`, `last_monthly_grant_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

#### Scenario: credit_balances has correct schema

- **WHEN** a migration é executada
- **THEN** `credit_balances` existe com colunas `store_id` (UUID PK), `balance` (INTEGER, DEFAULT 0, CHECK >=0), `bonus_balance` (INTEGER, DEFAULT 0, CHECK >=0), `purchased_balance` (INTEGER, DEFAULT 0, CHECK >=0), `last_monthly_grant_at` (TIMESTAMPTZ, nullable), `updated_at` (TIMESTAMPTZ, DEFAULT now())

#### Scenario: credit_balances has correct schema with buckets (F29.3)

- **WHEN** a migration é executada
- **THEN** `credit_balances` existe com colunas `store_id` (UUID PK), `balance` (INTEGER, DEFAULT 0, CHECK >=0), `bonus_balance` (INTEGER, DEFAULT 0, CHECK >=0), `purchased_balance` (INTEGER, DEFAULT 0, CHECK >=0), `last_monthly_grant_at` (TIMESTAMPTZ, nullable), `updated_at` (TIMESTAMPTZ, DEFAULT now())

#### Scenario: credit_balances cascade delete

- **WHEN** uma store é deletada
- **THEN** seu registro em `credit_balances` é deletado em cascata

#### Scenario: credit_balances rejects negative balance

- **WHEN** uma operação tenta definir `balance < 0`
- **THEN** o CHECK constraint `balance >= 0` rejeita

#### Scenario: credit_balances rejects negative bonus_balance

- **WHEN** uma operação tenta definir `bonus_balance < 0`
- **THEN** o CHECK constraint `bonus_balance >= 0` rejeita

#### Scenario: credit_balances rejects negative purchased_balance

- **WHEN** uma operação tenta definir `purchased_balance < 0`
- **THEN** o CHECK constraint `purchased_balance >= 0` rejeita

#### Scenario: balance is always bonus_balance + purchased_balance

- **WHEN** `bonus_balance` ou `purchased_balance` é atualizado
- **THEN** `balance` é automaticamente sincronizado para `bonus_balance + purchased_balance` via trigger

### Requirement: credit_balances sync_balances trigger (ADDED F29.3)

O sistema SHALL criar trigger `trg_credit_balances_sync_total` (BEFORE INSERT OR UPDATE) que executa `public.sync_credit_balances_total()` definindo `NEW.balance = NEW.bonus_balance + NEW.purchased_balance`.

#### Scenario: trigger updates balance on INSERT

- **WHEN** um novo registro é inserido em `credit_balances` com `bonus_balance = 5` e `purchased_balance = 3`
- **THEN** `balance` é automaticamente definido para `8`

#### Scenario: trigger updates balance on UPDATE

- **WHEN** `bonus_balance` é atualizado de `5` para `10` em um registro existente
- **THEN** `balance` é automaticamente atualizado para `10 + purchased_balance`

### Requirement: credit_balances updated_at trigger

O sistema SHALL criar trigger `trg_credit_balances_updated_at` que atualiza `updated_at` para `now()` antes de cada UPDATE.

#### Scenario: trigger updates updated_at on UPDATE

- **WHEN** `credit_balances` é atualizada
- **THEN** `updated_at` é automaticamente atualizado para `now()`

### Requirement: credit_balances monthly_grant index (ADDED F29.3)

O sistema SHALL criar índice parcial `idx_credit_balances_monthly_grant` em `public.credit_balances (last_monthly_grant_at)` WHERE `last_monthly_grant_at IS NOT NULL`.

#### Scenario: monthly_grant index exists

- **WHEN** a migration é executada
- **THEN** o índice `idx_credit_balances_monthly_grant` existe em `credit_balances(last_monthly_grant_at)` com condição `WHERE last_monthly_grant_at IS NOT NULL`

### Requirement: credit_balances RLS

O sistema SHALL habilitar RLS em `credit_balances` e criar policy `owner_select_credit_balances` que permite SELECT apenas para o owner (store cujo `user_id = auth.uid()`).

#### Scenario: owner can SELECT their balance

- **WHEN** usuário autenticado faz SELECT em `credit_balances` para sua própria store
- **THEN** o SELECT retorna o registro

#### Scenario: other users cannot SELECT balance

- **WHEN** usuário autenticado faz SELECT em `credit_balances` para store de outro usuário
- **THEN** o SELECT retorna vazio

#### Scenario: GRANT SELECT only to authenticated

- **WHEN** `GRANT` commands são analisados
- **THEN** apenas `GRANT SELECT TO authenticated` existe para `credit_balances`
- **AND** `GRANT INSERT`, `GRANT UPDATE`, `GRANT DELETE` estão explicitamente omitidos

### Requirement: credit_transactions table

O sistema SHALL criar a tabela `credit_transactions` com campos: `id UUID PK DEFAULT gen_random_uuid()`, `store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE`, `type TEXT NOT NULL CHECK (type IN ('bonus_onboarding','bonus_monthly','admin_grant','purchase','deduction','refund','adjustment'))`, `amount INTEGER NOT NULL`, `balance_before INTEGER NOT NULL`, `balance_after INTEGER NOT NULL`, `campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL`, `reason TEXT`, `reference TEXT`, `idempotency_key TEXT`, `metadata JSONB DEFAULT '{}'`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

#### Scenario: credit_transactions has correct schema

- **WHEN** a migration é executada
- **THEN** `credit_transactions` existe com todas as colunas especificadas

### Requirement: credit_transactions type CHECK constraint (MODIFIED F29.3)

O sistema SHALL ter CHECK constraint que limita `type` a exatamente 7 valores: `'bonus_onboarding'`, `'bonus_monthly'`, `'admin_grant'`, `'purchase'`, `'deduction'`, `'refund'`, `'adjustment'`.

#### Scenario: valid types are accepted

- **WHEN** INSERT com `type IN ('bonus_onboarding','bonus_monthly','admin_grant','purchase','deduction','refund','adjustment')`
- **THEN** o INSERT é aceito

#### Scenario: invalid type is rejected

- **WHEN** INSERT com `type` diferente dos 7 permitidos
- **THEN** o CHECK constraint rejeita

#### Scenario: new types are accepted (F29.3)

- **WHEN** INSERT com `type IN ('bonus_onboarding','bonus_monthly','admin_grant','purchase')`
- **THEN** o INSERT é aceito

#### Scenario: old grant type is rejected (F29.3)

- **WHEN** INSERT com `type = 'grant'`
- **THEN** o CHECK constraint rejeita

### Requirement: credit_transactions amount_sign CHECK constraint (MODIFIED F29.3)

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

#### Scenario: deduction amount must be negative

- **WHEN** INSERT com `type = 'deduction'` e `amount < 0`
- **THEN** INSERT é aceito
- **WHEN** INSERT com `type = 'deduction'` e `amount >= 0`
- **THEN** CHECK constraint rejeita

#### Scenario: refund amount must be positive

- **WHEN** INSERT com `type = 'refund'` e `amount > 0`
- **THEN** INSERT é aceito
- **WHEN** INSERT com `type = 'refund'` e `amount <= 0`
- **THEN** CHECK constraint rejeita

#### Scenario: adjustment amount cannot be zero

- **WHEN** INSERT com `type = 'adjustment'` e `amount <> 0`
- **THEN** INSERT é aceito
- **WHEN** INSERT com `type = 'adjustment'` e `amount = 0`
- **THEN** CHECK constraint rejeita

### Requirement: credit_transactions balance_before and balance_after

O sistema SHALL garantir que `balance_before` e `balance_after` nunca sejam negativos em nenhuma transação.

#### Scenario: balance_before and balance_after are non-negative

- **WHEN** qualquer transação é inserida
- **THEN** `balance_before >= 0` e `balance_after >= 0`

### Requirement: credit_transactions amount not zero

O sistema SHALL garantir que `amount` nunca seja zero em nenhuma transação.

#### Scenario: amount cannot be zero

- **WHEN** INSERT com `amount = 0`
- **THEN** CHECK constraint rejeita

### Requirement: credit_transactions store_id index

O sistema SHALL criar índice `idx_credit_transactions_store_id` em `(store_id, created_at DESC)`.

#### Scenario: index exists for store_id ordering

- **WHEN** a migration é executada
- **THEN** o índice `idx_credit_transactions_store_id` existe em `credit_transactions(store_id, created_at DESC)`

### Requirement: credit_transactions idempotency unique index

O sistema SHALL criar partial unique index `idx_credit_transactions_idempotency` em `(store_id, idempotency_key)` WHERE `idempotency_key IS NOT NULL`.

#### Scenario: idempotency unique index exists

- **WHEN** a migration é executada
- **THEN** o partial unique index `idx_credit_transactions_idempotency` existe

#### Scenario: duplicate idempotency_key per store is rejected

- **WHEN** INSERT de duas transações com mesmo `store_id` e `idempotency_key`
- **THEN** a segunda INSERT falha com unique constraint violation

#### Scenario: same idempotency_key in different stores is allowed

- **WHEN** INSERT com mesmo `idempotency_key` em `store_id` diferentes
- **THEN** ambos os INSERTs são aceitos

#### Scenario: NULL idempotency_key is not indexed

- **WHEN** INSERT com `idempotency_key IS NULL`
- **THEN** o partial index não se aplica e INSERT é aceito

### Requirement: credit_transactions RLS

O sistema SHALL habilitar RLS em `credit_transactions` e criar policy `owner_select_credit_transactions` que permite SELECT apenas para o owner (store cujo `user_id = auth.uid()`).

#### Scenario: owner can SELECT their transactions

- **WHEN** usuário autenticado faz SELECT em `credit_transactions` para sua própria store
- **THEN** o SELECT retorna as transações

#### Scenario: other users cannot SELECT transactions

- **WHEN** usuário autenticado faz SELECT em `credit_transactions` para store de outro usuário
- **THEN** o SELECT retorna vazio

#### Scenario: GRANT SELECT only for credit_transactions

- **WHEN** `GRANT` commands são analisados
- **THEN** apenas `GRANT SELECT TO authenticated` existe para `credit_transactions`
- **AND** `GRANT INSERT`, `GRANT UPDATE`, `GRANT DELETE` estão explicitamente omitidos

### Requirement: credit_transactions immutable trigger

O sistema SHALL criar trigger `trg_credit_transactions_immutable` que executa `BEFORE UPDATE OR DELETE` e lança `RAISE EXCEPTION 'credit_transactions é append-only'`.

#### Scenario: UPDATE on credit_transactions is blocked

- **WHEN** qualquer tentativa de UPDATE em `credit_transactions`
- **THEN** o trigger lança exceção e bloqueia a operação
- **AND** a exceção ocorre mesmo via `service_role`

#### Scenario: DELETE on credit_transactions is blocked

- **WHEN** qualquer tentativa de DELETE em `credit_transactions`
- **THEN** o trigger lança exceção e bloqueia a operação
- **AND** a exceção ocorre mesmo via `service_role`

#### Scenario: INSERT on credit_transactions is allowed

- **WHEN** INSERT em `credit_transactions`
- **THEN** o trigger não interfere e o INSERT é aceito

### Requirement: Immutable trigger desabilitado durante backfill (ADDED F29.3)

O sistema SHALL desabilitar temporariamente o trigger `trg_credit_transactions_immutable` em `credit_transactions` antes do backfill de `type`, e reabilitá-lo imediatamente após.

#### Scenario: trigger is dropped before backfill

- **WHEN** a migration executa o backfill de `credit_transactions.type`
- **THEN** o trigger `trg_credit_transactions_immutable` está desabilitado/droppado antes do UPDATE
- **AND** é recriado/reabilitado após o UPDATE

### Requirement: Backfill de transações existentes (ADDED F29.3)

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
