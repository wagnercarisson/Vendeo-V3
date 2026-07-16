# Phase 24: Créditos — Schema, Saldo e Transações — Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/2026-07-16-fase-24-wallet-ledger-idempotencia/`

<domain>
## Phase Boundary

Criar a camada financeira do Vendeo: wallet de saldo por loja, ledger imutável de transações, SQL functions atômicas com `SELECT ... FOR UPDATE` e idempotência desde a fundação. Sem gateway de pagamento, UI, checkout ou rotas HTTP — fundação pura para as fases seguintes (F25 integração no pipeline, F26 pagamento).

**Estado atual (pós-F23):**
- Copy Director com IA implementado (`TextProvider` + `CopyDirectorService`)
- Pipeline de geração sequencial (sem rate limit, sem saldo, sem proteção financeira)
- Cada geração custa dinheiro real (API OpenAI) sem barreira de entrada
- Nenhum conceito de crédito, saldo, ledger ou idempotência existe no sistema
- `store_id` é o eixo de domínio (não `user_id`) — relação 1:1 user→store

**Dependências:** Nenhuma — tabelas novas, código novo, sem acoplamento a fases anteriores.

</domain>

<decisions>
## Implementation Decisions

### D1 — Eixo do ledger: store_id (não user_id)

O saldo pertence à **loja**, não ao usuário. O produto é comercialmente por loja. A relação atual é 1:1 user→store, preparando para 1:N (times) no futuro.

Impacto: Toda operação do `CreditService` recebe `storeId`. O chamador (handler HTTP) resolve `userId` → `storeId` via `requireOwnership`.

### D2 — Ledger imutável (append-only)

`credit_transactions` é estritamente append-only. Proibido: UPDATE ou DELETE em qualquer transação. Reforço em duas camadas:
1. RLS + GRANTs — apenas SELECT para authenticated
2. Trigger `trg_credit_transactions_immutable` — `BEFORE UPDATE OR DELETE` com `RAISE EXCEPTION` (blinda até service_role)

Correções: INSERT de transação `adjustment`, nunca UPDATE/DELETE.

### D3 — Tipos de transação (enum fixo com CHECK)

| Tipo | Amount | Descrição |
|------|--------|-----------|
| `grant` | positivo (+N) | Concessão gratuita (onboarding, bônus) |
| `purchase` | positivo (+N) | Créditos comprados via gateway |
| `deduction` | negativo (-N) | Consumo por geração |
| `refund` | positivo (+N) | Estorno de deduction |
| `adjustment` | positivo ou negativo | Correção manual (invisível no extrato) |

CHECK constraint valida sinal do amount por tipo. `adjustment` é filtrado do extrato do usuário.

### D4 — Idempotência desde a fundação

`credit_transactions` nasce com `idempotency_key` + partial unique index por `(store_id, idempotency_key)` WHERE NOT NULL.

Contrato (3 cenários):
1. Encontrou com tipo esperado → retorna tx existente (no-op)
2. Encontrou com tipo diferente → `RAISE EXCEPTION 'idempotency_conflict'`
3. Não encontrou → executa normalmente

Chaves geradas por operação: `onboarding_{storeId}`, `purchase_{checkoutSessionId}`, `reserve_{campaignId}`, `refund_{originalTxId}`.

### D5 — balance_before + balance_after em toda transação

Toda transação registra saldo antes e depois. Permite reconciliação linear e auditoria. Calculado pela SQL function: lê saldo atual com `SELECT ... FOR UPDATE`, calcula `balance_after = balance_before + amount`.

### D6 — SQL functions para atomicidade (app-level NÃO)

Toda mutação de saldo ocorre dentro de SQL functions que executam em transação única com `SELECT ... FOR UPDATE`. App-level jamais usado para mutações.

A aplicação chama `supabaseAdmin.rpc('reserve_credit', {...})`. O handler HTTP:
- Valida ownership (`requireOwnership`)
- Chama a SQL function
- Trata `saldo_insuficiente` → 402 Payment Required
- Trata deadlock → retry com backoff

### D7 — Pagamento: Stripe preferencial, Mercado Pago fallback

Decisão final na F26. Na F24: `credit_transactions.type = 'purchase'` + `reference` + `metadata` são genéricos para qualquer provedor.

### D8 — credit_orders NÃO entra na F24

Diferido para F26. A F24 registra o contrato de integração: F26 adiciona `credit_orders` e usa `credit_transactions.reference` para vincular compra a ledger.

### D9 — CreditService como classe com injeção de supabaseAdmin

```typescript
class CreditService {
  constructor(private readonly adminClient = supabaseAdmin) {}
  // 6 métodos públicos
}
```

Mutações: `this.adminClient.rpc('function_name', params)`. SELECTs (`getBalance`, `getHistory`): `this.adminClient.from(...)` com queries diretas.

### the agent's Discretion
- Estrutura exata dos testes (quantidade, cenários) desde que 25+ testes com mock do supabaseAdmin
- Implementação do mock do supabaseAdmin para testes unitários (sem banco real)
- Ordem exata das tarefas dentro de cada plano
- Detalhes da migration SQL (nomes de constraint, formatação) desde que respeitem o schema especificado

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Service class pattern with adminClient injection
- `src/lib/image-generation/services/image-generation-service.ts` — ImageGenerationService pattern
- `src/lib/campaign/persistence.ts` — Campaign persistence using supabaseAdmin (rpc + from pattern)

### Store/ownership patterns
- `src/middleware.ts` — requireOwnership pattern
- `src/lib/auth/store-ownership.ts` — Ownership validation helpers

### Campaign types (referência)
- `src/lib/campaign/types.ts` — Campaign types for campaign_id FK reference

### Existing SQL migrations
- `supabase/migrations/` — Existing migration pattern (naming, RLS, triggers)

### OpenSpec Source of Truth
- `openspec/changes/2026-07-16-fase-24-wallet-ledger-idempotencia/proposal.md` — Why, What, Capabilities, Impact
- `openspec/changes/2026-07-16-fase-24-wallet-ledger-idempotencia/design.md` — 9 design decisions (D1-D9), goals/non-goals, risks, migration SQL, CreditService API, tests, invariants
- `openspec/changes/2026-07-16-fase-24-wallet-ledger-idempotencia/tasks.md` — 11 task groups, 58 steps
- `openspec/changes/2026-07-16-fase-24-wallet-ledger-idempotencia/specs/credit-tables/spec.md` — credit_balances e credit_transactions spec
- `openspec/changes/2026-07-16-fase-24-wallet-ledger-idempotencia/specs/credit-sql-functions/spec.md` — SQL functions spec (grant, reserve, refund)
- `openspec/changes/2026-07-16-fase-24-wallet-ledger-idempotencia/specs/credit-service/spec.md` — CreditService spec

### Project Requirements
- `.planning/REQUIREMENTS.md` — CRED-01, CRED-02, CRED-03, CRED-04, CRED-05 mapped to Phase 24

</canonical_refs>

<specifics>
## Specific Ideas

- Migration SQL em arquivo único: `supabase/migrations/20260716000001_create_credit_tables.sql` com DDL completo + SQL functions + triggers + RLS + índices + comandos REVERT
- `credit_balances` store_id PK, balance CHECK>=0, trigger updated_at, RLS owner_select
- `credit_transactions` append-only com 5 tipos, CHECK de sinal, idempotency_key partial unique index, balance_before/balance_after, RLS, trigger imutável
- 3 SQL functions atômicas: `grant_credits`, `reserve_credit`, `refund_credit` — todas com SELECT FOR UPDATE e idempotência
- `CreditService` com 6 métodos: getBalance, reserveCredit, confirmCredit (no-op), refundCredit, grantCredits, getHistory
- `CreditOperationOptions` para parâmetros opcionais (campaignId, idempotencyKey, metadata)
- `getHistory` filtra type != 'adjustment', default limit 50, max 100, ORDER BY created_at DESC
- Mapeamento snake_case → camelCase no getHistory
- Nenhum arquivo existente é modificado — F24 é 100% novo e autocontida

### Invariantes Financeiros
1. Saldo nunca negativo — CHECK constraint + SQL function validation
2. Ledger append-only — trigger blinda UPDATE/DELETE até service_role
3. Estorno = nova transação — nunca modifica transação original
4. balance_before + balance_after em toda transação — reconciliação linear
5. Idempotência por (store_id, idempotency_key) — partial unique index

### Verificação SQL/Integrada Obrigatória (I1–I7)
- I1: grant_credits real → saldo > 0
- I2: reserve_credit real → saldo deduzido
- I3: refund_credit real → saldo restaurado
- I4: reserve_credit com saldo insuficiente → exceção
- I5: refund_credit duplicado → no-op
- I6: mesma idempotency_key → mesma tx
- I7: duas chamadas simultâneas reserve_credit com saldo justo

### Contratos com Fases Futuras
- **F25**: chama `creditService.reserveCredit()` e `creditService.getBalance()` no pipeline de geração. Grant inicial de 5 créditos no onboarding (criação da loja) antes de ativar bloqueio 402.
- **F26**: adiciona `credit_orders`, vincula compra → ledger via `credit_transactions.reference = credit_order.id`.

</specifics>

<deferred>
## Deferred Ideas

- `credit_orders` — tabela, service, rota (F26)
- Checkout / compra de créditos (F26)
- Webhook Stripe / Mercado Pago (F26)
- Reembolso via provedor de pagamento (F26)
- UI de saldo na topbar (F27)
- UI de créditos em `/conta` (F27)
- Rate limit por usuário (F25)
- Bloqueio de geração sem crédito — 402 Payment Required (F25)
- Definição de custo por geração — `COST_PER_GENERATION` (F25)
- Observabilidade/logging/telemetria (F28)

</deferred>

---

*Phase: 24-creditos-schema-saldo-transacoes*
*Context gathered: 2026-07-16 via OpenSpec source of truth*
