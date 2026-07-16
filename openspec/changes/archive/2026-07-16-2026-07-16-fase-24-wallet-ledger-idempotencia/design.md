## Context

O Vendeo não controla consumo de IA, não tem barreira de entrada nem monetização. A F24 cria a camada financeira: saldo por loja, ledger imutável, transações atômicas e idempotência. Não há gateway de pagamento, UI ou checkout — é fundação pura para as fases seguintes (F25 integração no pipeline, F26 pagamento).

**Dependências:** Nenhuma — tabelas novas, código novo, sem acoplamento a fases anteriores. O eixo é `store_id` (não `user_id`), consistente com o modelo de domínio do Vendeo.

## Goals / Non-Goals

**Goals:**
- `credit_balances` por `store_id` com RLS (SELECT do owner) + service_role para mutações
- `credit_transactions` append-only com `idempotency_key`, `balance_before`, `balance_after`
- SQL functions: `grant_credits`, `reserve_credit`, `refund_credit` — todas com `SELECT ... FOR UPDATE`
- `CreditService.getBalance(storeId)` → saldo atual
- `CreditService.reserveCredit(storeId, amount, opts?)` → txId (dedução)
- `CreditService.confirmCredit(txId)` → void (no-op na v1.5)
- `CreditService.refundCredit(txId, reason)` → void (estorno)
- `CreditService.grantCredits(storeId, amount, reason, opts?)` → txId (concessão)
- `CreditService.getHistory(storeId, limit, offset)` → transações paginadas (sem adjustment)
- 25+ testes (saldo, reserva, estorno, concorrência, idempotência, grant, histórico)
- Verificação SQL/integrada contra banco real (I1–I7)

**Non-Goals:**
- `credit_orders` — tabela, service, rota (diferido para F26)
- Checkout / compra de créditos (F26)
- Webhook Stripe / Mercado Pago (F26)
- Reembolso via provedor de pagamento (F26)
- UI de saldo na topbar (F27)
- UI de créditos em `/conta` (F27)
- Rate limit por usuário (F25)
- Bloqueio de geração sem crédito — 402 Payment Required (F25)
- Definição de custo por geração — `COST_PER_GENERATION` (F25)
- Observabilidade/logging/telemetria (F28)

## Decisions

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

## Estrutura de diretórios

```
src/lib/credit/                          ← NOVO
├── credit-service.ts                    # CreditService (6 métodos)
├── types.ts                             # Zod schemas + TypeScript types
└── __tests__/
    └── credit-service.test.ts           # 25+ testes

supabase/
└── migrations/
    └── 20260716000001_create_credit_tables.sql   # DDL + SQL functions
```

Nenhum arquivo existente é modificado.

## Migration SQL

### credit_balances
- `store_id UUID PK REFERENCES stores(id) ON DELETE CASCADE`
- `balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Trigger `trg_credit_balances_updated_at`
- RLS: policy `owner_select_credit_balances` (subquery stores.user_id = auth.uid())
- GRANT SELECT TO authenticated; INSERT/UPDATE/DELETE omitidos

### credit_transactions
- `id UUID PK DEFAULT gen_random_uuid()`
- `store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE`
- `type TEXT NOT NULL CHECK (type IN ('grant','purchase','deduction','refund','adjustment'))`
- `amount INTEGER NOT NULL`
- `balance_before INTEGER NOT NULL`
- `balance_after INTEGER NOT NULL`
- `campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL`
- `reason TEXT`, `reference TEXT`, `idempotency_key TEXT`, `metadata JSONB DEFAULT '{}'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- CHECK `chk_credit_transactions_amount_sign` (sinal por tipo)
- Partial unique index `idx_credit_transactions_idempotency` (store_id, idempotency_key) WHERE NOT NULL
- Index `idx_credit_transactions_store_id` (store_id, created_at DESC)
- RLS: policy `owner_select_credit_transactions`
- GRANT SELECT TO authenticated; INSERT/UPDATE/DELETE omitidos
- Trigger `trg_credit_transactions_immutable` — BEFORE UPDATE OR DELETE com RAISE EXCEPTION

### SQL functions
- `grant_credits(p_store_id, p_amount, p_reason, p_idempotency_key, p_metadata)` → UUID
  - Valida amount > 0, idempotência, INSERT ON CONFLICT para garantir linha, FOR UPDATE, INSERT tx + UPDATE balance
- `reserve_credit(p_store_id, p_amount, p_campaign_id, p_idempotency_key, p_metadata)` → UUID
  - Valida amount > 0, idempotência, FOR UPDATE, saldo_insuficiente → RAISE, INSERT tx + UPDATE balance
- `refund_credit(p_tx_id, p_reason, p_idempotency_key, p_metadata)` → UUID
  - Busca tx original, valida tipo deduction, idempotência, verifica duplo estorno via reference, FOR UPDATE, INSERT refund + UPDATE balance

## CreditService API

### Types (`types.ts`)

```typescript
export const CreditTransactionTypeSchema = z.enum(['grant','purchase','deduction','refund','adjustment']);
export const CreditTransactionSchema = z.object({ ... });
export type CreditTransaction = z.infer<typeof CreditTransactionSchema>;
export interface CreditOperationOptions { campaignId?: string; idempotencyKey?: string; metadata?: Record<string, unknown>; }
export interface CreditBalance { storeId: string; balance: number; updatedAt: string; }
```

### Service (`credit-service.ts`)

| Método | Descrição |
|--------|-----------|
| `getBalance(storeId)` | Retorna saldo de `credit_balances`. Se não existir, retorna 0 |
| `reserveCredit(storeId, amount, opts?)` | Chama RPC `reserve_credit`. amount positivo (converte p/ negativo). Propag `saldo_insuficiente` como 402 |
| `confirmCredit(txId)` | No-op v1.5. Preparação para two-phase commit futuro |
| `refundCredit(txId, reason, opts?)` | Chama RPC `refund_credit`. Retorna txId do refund |
| `grantCredits(storeId, amount, reason, opts?)` | Chama RPC `grant_credits`. Retorna txId |
| `getHistory(storeId, limit?, offset?)` | SELECT credit_transactions filtrando type != 'adjustment', ORDER BY created_at DESC, default limit 50, max 100 |

## Testes

### Unitários (25+ testes)

1. **Saldo e Grant** (6): getBalance retorna 0 sem registro, grant adiciona saldo, grants acumulam, grant idempotente, getBalance reflete grant, grant com reason null
2. **Reserva e Dedução** (7): reserve deduz saldo, saldo insuficiente rejeita, campaignId registrado, reserve idempotente, reservas consecutivas, getBalance reflete deduções, amount > saldo → erro
3. **Estorno** (5): refund restaura saldo, deduction inexistente → erro, refund duplicado no-op, refund com idempotency_key repetido, refund em não-deduction → erro
4. **Histórico** (4): getHistory retorna transações sem adjustment, paginado, loja sem transações → vazio, default limit
5. **Concorrência** (3): duas reservas simultâneas com saldo justo, com saldo insuficiente, grant + reserve simultâneos
6. **Invariantes** (3): saldo nunca negativo, transações imutáveis, adjustment não aparece no extrato

### Verificação SQL/Integrada (I1–I7 — obrigatória)

Testes contra banco real (Supabase local) para validar atomicidade:
- I1: grant_credits real → saldo > 0
- I2: reserve_credit real → saldo deduzido
- I3: refund_credit real → saldo restaurado
- I4: reserve_credit com saldo insuficiente → exceção
- I5: refund_credit duplicado → no-op
- I6: Mesma idempotency_key → mesma tx
- I7: Duas chamadas simultâneas reserve_credit com saldo justo

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Race condition em reserva simultânea | SQL function com SELECT ... FOR UPDATE serializa. Postgres gerencia deadlock. App layer faz retry com backoff |
| Idempotency_key collision entre tipos diferentes | SQL function busca sem filtrar tipo. Se tipo diferente, `idempotency_conflict`. Operações prefixam chave |
| Refund de transação já estornada | SQL function verifica `reference = tx_id`. Se já existe refund, retorna o existente |
| Saldo inconsistente entre ledger e wallet | CHECK balance >= 0 é barreira final. balance_before/balance_after permitem reconciliação |
| Mudança de gateway (Stripe → Mercado Pago) | ledger genérico: type='purchase' + reference + metadata. credit_orders (F26) isola detalhes |
| SQL functions sem verificação real | I1–I7 obrigatórios contra banco real (Supabase local) |
| Loja sem registro em credit_balances | grant_credits cria registro com balance=0. getBalance retorna 0. reserve_credit lança erro se não existir |

## Contrato com F25

A F25 integra créditos no pipeline de geração. Pré-requisito: grant inicial de 5 créditos no onboarding (criação da loja) **antes** de ativar o bloqueio 402. Alternativa: flag de rollout que só ativa cobrança real quando o onboarding grant estiver em produção.

## Contrato com F26

F26 adiciona:
1. Tabela `credit_orders` — pedido de compra no gateway
2. Vinculação compra → ledger via `credit_transactions.reference = credit_order.id`
3. Provider/payment data em `credit_orders`, não como coluna no ledger
