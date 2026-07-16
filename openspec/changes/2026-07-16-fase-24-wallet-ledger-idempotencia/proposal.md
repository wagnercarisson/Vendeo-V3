## Why

O Vendeo hoje não tem conceito de crédito. Cada geração de campanha custa dinheiro real (API OpenAI) e não há saldo, rate limit, barreira de entrada ou proteção financeira. A F24 cria a fundação financeira do produto: wallet de saldo por loja, ledger imutável de transações, SQL functions atômicas com `SELECT ... FOR UPDATE` e idempotência desde a fundação — sem gateway de pagamento, sem UI, sem checkout. Isso é pré-requisito para a F25 (integração no pipeline com rate limit e bloqueio 402) e a F26 (pagamento via Stripe/Mercado Pago).

## What Changes

- Criar tabela `credit_balances` (store_id PK, balance CHECK>=0) com RLS e trigger de updated_at
- Criar tabela `credit_transactions` (append-only, 5 tipos: grant/purchase/deduction/refund/adjustment) com CHECK constraints de sinal, balance_before/balance_after, idempotency_key com partial unique index, RLS e trigger de blindagem imutável
- Criar 3 SQL functions atômicas: `grant_credits`, `reserve_credit`, `refund_credit` — todas com `SELECT ... FOR UPDATE` e idempotência
- Criar `CreditService` com 6 métodos públicos: `getBalance`, `reserveCredit`, `confirmCredit` (no-op), `refundCredit`, `grantCredits`, `getHistory`
- Estabelecer invariantes financeiros: saldo nunca negativo, ledger append-only, estorno = nova transação
- Projetar para compatibilidade futura com `credit_orders` (F26) — ledger puro sem dados de gateway
- 25+ testes unitários + verificação SQL/integrada contra banco real (I1–I7)

## Capabilities

### New Capabilities
- `credit-wallet`: Tabela `credit_balances` por store_id com saldo materializado, RLS (SELECT do owner), mutações exclusivas via SQL functions com service_role
- `credit-ledger`: Tabela `credit_transactions` append-only com 5 tipos, CHECK constraints, idempotency_key, balance_before/balance_after, trigger de blindagem imutável
- `credit-sql-functions`: 3 funções atômicas (`grant_credits`, `reserve_credit`, `refund_credit`) com `SELECT ... FOR UPDATE`, idempotência com unique partial index, validação de saldo insuficiente
- `credit-service`: `CreditService` como classe com injeção de `supabaseAdmin` — 6 métodos públicos prontos para consumo pela F25

### Modified Capabilities
- Nenhuma — F24 é 100% novo, sem modificar arquivos existentes

## Impact

- **Novos diretórios:** `src/lib/credit/` com `credit-service.ts`, `types.ts`, `__tests__/credit-service.test.ts`
- **Nova migration:** `supabase/migrations/20260716000001_create_credit_tables.sql` (DDL das tabelas + SQL functions + triggers + RLS + índices)
- **Nova classe:** `CreditService` — consumida via `supabaseAdmin.rpc()` para mutações, queries diretas para leituras
- **Novas interfaces:** `CreditTransaction`, `CreditOperationOptions`, `CreditBalance` com schemas Zod
- **Nenhum arquivo existente é modificado** — F24 é autocontida
- **Nenhuma UI nova** — F24 é fundação financeira pura, sem rotas HTTP ou componentes
- **F25 depende da F24:** a F25 precisará chamar `creditService.reserveCredit()` e `creditService.getBalance()` no pipeline de geração
