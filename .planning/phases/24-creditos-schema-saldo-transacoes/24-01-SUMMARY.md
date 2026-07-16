---
phase: 24
plan: 01
title: Migration SQL + CreditService
subsystem: credit
tags:
  - migration
  - sql
  - credit-service
  - types
  - schema
requires: []
provides:
  - credit_balances table
  - credit_transactions table
  - grant_credits SQL function
  - reserve_credit SQL function
  - refund_credit SQL function
  - CreditService class (6 methods)
  - Zod schemas + TypeScript types
affects: []
tech-stack:
  added:
    - Zod (existing dependency, new schemas)
    - "@supabase/supabase-js" (existing, new usage)
  patterns:
    - CreditService class with adminClient injection
    - Per-table scoped trigger functions
    - Append-only ledger with immutable trigger
    - Atomic SQL functions with SELECT FOR UPDATE
    - Idempotency via partial unique index
key-files:
  created:
    - supabase/migrations/20260716000001_create_credit_tables.sql (403 lines)
    - src/lib/credit/types.ts (38 lines)
    - src/lib/credit/credit-service.ts (150 lines)
  modified: []
decisions:
  - "D1: Ledger axis is store_id, not user_id — consistent with domain model"
  - "D2: credit_transactions strictly append-only (trigger blocks UPDATE/DELETE)"
  - "D3: 5 transaction types with CHECK constraint enforcing amount sign"
  - "D4: Idempotency from foundation — partial unique index on (store_id, idempotency_key) WHERE NOT NULL"
  - "D5: balance_before + balance_after in every transaction for linear reconciliation"
  - "D6: All mutations via SQL functions with SELECT FOR UPDATE — app-level never used for writes"
  - "D9: CreditService as class with adminClient injection (constructor param)"
metrics:
  duration: "~30 min"
  tasks: 8
  files: 3
  commits: 9
completed: "2026-07-16T19:42:00Z"
---

# Phase 24 Plan 01: Migration SQL + CreditService Summary

Migration SQL completa com DDL de `credit_balances` e `credit_transactions` (append-only), 3 SQL functions atômicas com `SELECT FOR UPDATE` e idempotência, tipos TypeScript/Zod, e classe `CreditService` com 6 métodos públicos.

## Files Created

### 1. `supabase/migrations/20260716000001_create_credit_tables.sql` (403 lines)

Migration SQL única com DDL completo:

**credit_balances table:**
- `store_id UUID PK REFERENCES stores(id) ON DELETE CASCADE`
- `balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Trigger `trg_credit_balances_updated_at` com função `update_credit_balances_updated_at()` (per-table scoped)
- RLS: policy `owner_select_credit_balances` (subquery `stores.user_id = auth.uid()`)
- GRANT SELECT TO authenticated only

**credit_transactions table:**
- Schema completo: `id PK`, `store_id FK`, `type`, `amount`, `balance_before`, `balance_after`, `campaign_id FK`, `reason`, `reference`, `idempotency_key`, `metadata JSONB`, `created_at`
- CHECK constraints: `type IN (5 valores)`, `chk_credit_transactions_amount_sign` (sinal por tipo), `balance >= 0`, `amount <> 0`
- Partial unique index `idx_credit_transactions_idempotency`: `(store_id, idempotency_key) WHERE NOT NULL`
- B-tree index `idx_credit_transactions_store_id`: `(store_id, created_at DESC)`
- Immutable trigger `trg_credit_transactions_immutable`: bloqueia UPDATE/DELETE com `RAISE EXCEPTION`
- RLS: policy `owner_select_credit_transactions`
- GRANT SELECT TO authenticated only

**SQL functions (atomic, SECURITY DEFINER, empty search_path):**
- `grant_credits(p_store_id, p_amount, p_reason, p_idempotency_key, p_metadata) → UUID`: INSERT ON CONFLICT para garantir linha, SELECT FOR UPDATE, valida amount > 0, idempotência
- `reserve_credit(p_store_id, p_amount, p_campaign_id, p_idempotency_key, p_metadata) → UUID`: SELECT FOR UPDATE, valida saldo_insuficiente/saldo_inexistente, registra campaign_id
- `refund_credit(p_tx_id, p_reason, p_idempotency_key, p_metadata) → UUID`: busca tx original, valida tipo deduction, verifica duplo estorno via reference, idempotência

**REVERT section:** 17 comandos comentados em ordem reversa de criação.

### 2. `src/lib/credit/types.ts` (38 lines)

- `CreditTransactionTypeSchema` — z.enum(['grant','purchase','deduction','refund','adjustment'])
- `CreditTransactionSchema` — Zod object completo (camelCase, nullable fields, uuid validation)
- `CreditTransaction` — inferred type
- `CreditOperationOptions` — interface com campaignId?, idempotencyKey?, metadata?
- `CreditBalance` — interface com storeId, balance, updatedAt

### 3. `src/lib/credit/credit-service.ts` (150 lines)

- **Constructor:** `adminClient` default `supabaseAdmin` com tipo inferido
- `getBalance(storeId)`: SELECT credit_balances, retorna 0 se não existir
- `reserveCredit(storeId, amount, opts?)`: RPC `reserve_credit`, propaga erro (402)
- `confirmCredit(txId)`: no-op v1.5
- `refundCredit(txId, reason, opts?)`: RPC `refund_credit`
- `grantCredits(storeId, amount, reason, opts?)`: RPC `grant_credits`
- `getHistory(storeId, limit?, offset?)`: SELECT com filter type!=adjustment, ORDER created_at DESC, default limit 50 max 100, range-based pagination, snake_case → camelCase mapper

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- ✅ `npm run typecheck` — zero errors
- ✅ `npm run lint` — zero warnings/errors
- ✅ `npx vitest run` — 740 passing (91 files), existing tests unaffected
- ✅ No existing files modified (3 new files only)

## Self-Check: PASSED

All files confirmed created with expected content. All commits verified. TypeScript, lint, and existing tests all pass.

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | Migration — credit_balances table | `14136e8` |
| 2 | Migration — credit_transactions table | `8251b7b` |
| 3 | Migration — grant_credits SQL function | `db7f1fe` |
| 4 | Migration — reserve_credit SQL function | `1cc492d` |
| 5 | Migration — refund_credit SQL function | `9361b96` |
| 6 | Migration — complete REVERT section | `f925d56` |
| 7 | CreditService types (Zod + TypeScript) | `d2b3526` |
| 8 | CreditService class (6 methods) | `eee8fba` |
