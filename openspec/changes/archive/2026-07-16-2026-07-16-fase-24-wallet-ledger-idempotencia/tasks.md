## 1. Migration SQL — Tabelas + SQL Functions

- [x] 1.1 Criar `supabase/migrations/20260716000001_create_credit_tables.sql` com DDL de `credit_balances` (store_id PK, balance CHECK>=0, updated_at, trigger scoped, RLS, policy owner_select)
- [x] 1.2 Adicionar DDL de `credit_transactions` (id PK, store_id FK, type CHECK, amount, balance_before, balance_after, campaign_id FK, reason, reference, idempotency_key, metadata, created_at) com CHECK constraint de sinal, índices, RLS, trigger de blindagem imutável
- [x] 1.3 Adicionar SQL function `grant_credits` com idempotência, INSERT ON CONFLICT, SELECT FOR UPDATE, INSERT tx + UPDATE balance, RETURN tx_id
- [x] 1.4 Adicionar SQL function `reserve_credit` com idempotência, SELECT FOR UPDATE, validação saldo_insuficiente, INSERT tx + UPDATE balance, RETURN tx_id
- [x] 1.5 Adicionar SQL function `refund_credit` com validação de tipo deduction, idempotência, verificação de duplo estorno via reference, SELECT FOR UPDATE, INSERT refund + UPDATE balance, RETURN tx_id
- [x] 1.6 Documentar comandos REVERT no final da migration

## 2. CreditService — Types

- [x] 2.1 Criar `src/lib/credit/types.ts` com `CreditTransactionTypeSchema` (z.enum), `CreditTransactionSchema` (Zod), `CreditTransaction` type
- [x] 2.2 Adicionar `CreditOperationOptions` interface (campaignId?, idempotencyKey?, metadata?)
- [x] 2.3 Adicionar `CreditBalance` interface (storeId, balance, updatedAt)

## 3. CreditService — Service

- [x] 3.1 Criar `src/lib/credit/credit-service.ts` com classe `CreditService` (constructor recebe adminClient opcional, default supabaseAdmin)
- [x] 3.2 Implementar `getBalance(storeId): Promise<number>` — lê de credit_balances, retorna 0 se não existir
- [x] 3.3 Implementar `reserveCredit(storeId, amount, opts?): Promise<string>` — chama RPC reserve_credit, amount positivo, propagar saldo_insuficiente como erro 402
- [x] 3.4 Implementar `confirmCredit(txId): Promise<void>` — no-op na v1.5
- [x] 3.5 Implementar `refundCredit(txId, reason, opts?): Promise<string>` — chama RPC refund_credit
- [x] 3.6 Implementar `grantCredits(storeId, amount, reason, opts?): Promise<string>` — chama RPC grant_credits
- [x] 3.7 Implementar `getHistory(storeId, limit?, offset?): Promise<CreditTransaction[]>` — SELECT filtrando type != 'adjustment', ORDER BY created_at DESC, default limit 50, max 100

## 4. Testes — Saldo e Grant

- [x] 4.1 Criar `src/lib/credit/__tests__/credit-service.test.ts` com setup de mock do supabaseAdmin
- [x] 4.2 Teste: `getBalance` retorna 0 para loja sem registro em credit_balances
- [x] 4.3 Teste: `grantCredits` adiciona saldo (grant de 5 → saldo 5)
- [x] 4.4 Teste: `grantCredits` múltiplas vezes acumula (3 grants de 5 → saldo 15)
- [x] 4.5 Teste: `grantCredits` com idempotency_key repetido retorna mesma tx (não duplica)
- [x] 4.6 Teste: `getBalance` reflete grant após chamada
- [x] 4.7 Teste: `grantCredits` com reason null funciona

## 5. Testes — Reserva e Dedução

- [x] 5.1 Teste: `reserveCredit` deduz saldo (10 créditos - 1 = 9)
- [x] 5.2 Teste: `reserveCredit` com saldo insuficiente rejeita com erro
- [x] 5.3 Teste: `reserveCredit` com campaignId registra referência na transação
- [x] 5.4 Teste: `reserveCredit` com idempotency_key repetido retorna mesma tx (não duplica)
- [x] 5.5 Teste: múltiplas reservas consecutivas mantêm saldo correto
- [x] 5.6 Teste: `getBalance` reflete deduções após reservas
- [x] 5.7 Teste: `reserveCredit` amount > saldo → erro saldo_insuficiente

## 6. Testes — Estorno

- [x] 6.1 Teste: `refundCredit` restaura saldo (dedução de 5 → estorno → saldo volta)
- [x] 6.2 Teste: `refundCredit` com deduction inexistente → erro
- [x] 6.3 Teste: `refundCredit` duplicado é no-op (retorna mesmo refund)
- [x] 6.4 Teste: `refundCredit` com idempotency_key repetido retorna mesmo refund
- [x] 6.5 Teste: `refundCredit` em transação que não é deduction → erro

## 7. Testes — Histórico

- [x] 7.1 Teste: `getHistory` retorna transações da loja filtrando type != 'adjustment'
- [x] 7.2 Teste: `getHistory` paginado com limit/offset (5 transações, limit=2, offset=1)
- [x] 7.3 Teste: `getHistory` loja sem transações → array vazio
- [x] 7.4 Teste: `getHistory` default limit = 50

## 8. Testes — Concorrência

- [x] 8.1 Teste: duas reservas simultâneas com saldo justo (saldo=2, 2 reserves de 1 → ambas OK)
- [x] 8.2 Teste: duas reservas simultâneas com saldo insuficiente (saldo=1, 2 reserves de 1 → uma OK, outra erro)
- [x] 8.3 Teste: grant + reserve simultâneos não corrompem saldo

## 9. Testes — Invariantes

- [x] 9.1 Teste: saldo nunca negativo após operações encadeadas (grant 5, reserve 3, reserve 2, reserve 1 → erro no último)
- [x] 9.2 Teste: transações são imutáveis — verificar ausência de permissões de UPDATE/DELETE e que `trg_credit_transactions_immutable` bloqueia UPDATE/DELETE, inclusive via client admin/service_role
- [x] 9.3 Teste: `adjustment` não aparece no extrato público (getHistory filtra)

## 10. Verificação SQL/Integrada (obrigatória)

- [x] 10.1 Executar I1: `grant_credits` real contra banco → saldo > 0
- [x] 10.2 Executar I2: `reserve_credit` real → saldo deduzido
- [x] 10.3 Executar I3: `refund_credit` real → saldo restaurado
- [x] 10.4 Executar I4: `reserve_credit` com saldo insuficiente → exceção saldo_insuficiente
- [x] 10.5 Executar I5: `refund_credit` duplicado → no-op (não dobra saldo)
- [x] 10.6 Executar I6: mesma `idempotency_key` em duas chamadas → mesma tx retornada
- [x] 10.7 Executar I7: duas chamadas simultâneas de `reserve_credit` com saldo justo

## 11. Verificação final

- [x] 11.1 Executar `npx vitest run src/lib/credit/__tests__/credit-service.test.ts` — 28 testes passando (25+)
- [x] 11.2 Executar `npm run typecheck` — zero erros
- [x] 11.3 Executar `npm run lint` — zero erros
- [x] 11.4 Executar `npx vitest run` — 768 testes passando (92 files)
- [x] 11.5 Executar `npm run build` — build bem-sucedido
- [x] 11.6 Verificar que nenhum arquivo existente foi modificado (F24 é autocontida)
