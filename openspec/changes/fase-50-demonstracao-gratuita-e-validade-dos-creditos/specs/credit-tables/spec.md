# Credit Tables

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D1/D2). Adiciona o bucket de demonstração (`demo_balance`/`demo_expires_at`) e os tipos `demo`/`expiration` ao ledger.

## MODIFIED Requirements

### Requirement: credit_balances table

O sistema SHALL manter `credit_balances` com `store_id` (PK), `balance` (soma bruta via trigger), `bonus_balance`, `purchased_balance`, `last_monthly_grant_at` (DEPRECATED) e `updated_at`, **adicionando** `demo_balance INTEGER NOT NULL DEFAULT 0 CHECK (demo_balance >= 0)`, `demo_expires_at TIMESTAMPTZ NULL`, `demo_cycle_id UUID NULL`, `origin_demo_grant_tx_id UUID NULL` e `demo_contributing_tx_ids UUID[] NOT NULL DEFAULT '{}'`.

> **Delta F50 (D1/D6):** novas colunas `demo_balance` (default 0), `demo_expires_at` (NULL = sem demo ativa), `demo_cycle_id` (episódio corrente), `origin_demo_grant_tx_id` (grant original, estável) e `demo_contributing_tx_ids` (**NOT NULL** DEFAULT '{}'). **CHECK composto:** `demo_balance > 0` implica `demo_expires_at`, `demo_cycle_id` e `origin_demo_grant_tx_id` não nulos. Backfill com default — **sem expiração retroativa**.

#### Scenario: credit_balances com colunas demo

- **WHEN** a migration é executada
- **THEN** `credit_balances` inclui `demo_balance` (DEFAULT 0, CHECK >=0), `demo_expires_at` (nullable), `demo_cycle_id` (nullable), `origin_demo_grant_tx_id` (nullable) e `demo_contributing_tx_ids` (NOT NULL DEFAULT '{}')
- **AND** o CHECK composto exige `demo_expires_at`/`demo_cycle_id`/`origin_demo_grant_tx_id` não nulos quando `demo_balance > 0`

#### Scenario: balance soma os três buckets

- **WHEN** `demo_balance`, `bonus_balance` ou `purchased_balance` muda
- **THEN** `balance = demo_balance + bonus_balance + purchased_balance` via `trg_credit_balances_sync_total`

### Requirement: credit_transactions type CHECK constraint (MODIFIED F29.3)

O sistema SHALL estender o CHECK de `type` para 9 valores, acrescentando `demo` e `expiration` aos 7 existentes.

#### Scenario: demo e expiration aceitos

- **WHEN** INSERT com `type = 'demo'` ou `type = 'expiration'`
- **THEN** o CHECK aceita

#### Scenario: tipos legados preservados

- **WHEN** INSERT com os 7 tipos anteriores
- **THEN** o CHECK continua aceitando

### Requirement: credit_transactions amount_sign CHECK constraint (MODIFIED F29.3)

O sistema SHALL estender `chk_credit_transactions_amount_sign` para `demo > 0` e `expiration < 0`.

#### Scenario: demo amount positivo

- **WHEN** INSERT `type='demo'` com `amount > 0`
- **THEN** aceito; com `amount <= 0` rejeitado

#### Scenario: expiration amount negativo

- **WHEN** INSERT `type='expiration'` com `amount < 0`
- **THEN** aceito; com `amount >= 0` rejeitado
