# Alinhamento Fase 24 — Wallet + Ledger + Idempotência (v1.5)

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)
  ├── F23 — TextProvider + Copy Director (fundação IA de texto)                 ✓
  ├── F24 — Wallet + Ledger + Idempotência (fundação financeira)                ← esta fase
  ├── F25 — Integração no Pipeline (Copy Director + créditos + rate limit)
  ├── F26 — Pagamento (Stripe Checkout + Webhook + credit_orders)
  ├── F27 — Conta + Saldo Visível (UI de créditos no app shell e /conta)
  ├── F28 — Observabilidade + Deploy + Operação
  └── F29 — Refinamento Visual + Experiência Publicável + Launch Readiness
```

A F23 concluiu o Copy Director com IA. Agora o Vendeo precisa da camada financeira: saldo por loja, ledger imutável, transações atômicas e idempotência — sem gateway de pagamento, sem UI, sem checkout.

**Problema:** Hoje não existe conceito de crédito. O produto não controla consumo de IA, não tem barreira de entrada nem monetização. Cada geração custa dinheiro real (API OpenAI) e não há saldo, rate limit ou proteção financeira.

**Dependências:** Nenhuma — tabelas novas, código novo, sem acoplamento a fases anteriores. O eixo é store_id (não user_id), consistente com o modelo de domínio do Vendeo (campanhas, assets, geração, brand profile).

**Dependência gerada para F25:** A F25 integra créditos no pipeline de geração (rate limit, saldo check, reserva). Para que a cobrança real funcione, alguém precisa ter concedido créditos à loja antes. A F25 deve implementar o grant inicial de 5 créditos no onboarding (criação da loja) **antes** de ativar o bloqueio 402. Alternativa: flag de rollout que só ativa cobrança real quando o onboarding grant estiver em produção.

---

## Propósito

1. Criar wallet de saldo por loja (`credit_balances`)
2. Criar ledger imutável de transações (`credit_transactions`) com idempotência
3. Implementar SQL functions atômicas (`grant_credits`, `reserve_credit`, `refund_credit`) com `SELECT ... FOR UPDATE`
4. Implementar `CreditService` com 6 métodos públicos
5. Estabelecer invariantes financeiros: saldo nunca negativo, ledger append-only, estorno = nova transação
6. Projetar para compatibilidade futura com `credit_orders` (F26) — ledger puro sem dados de gateway

**Entrega verificável:**
- `credit_balances` por `store_id` com RLS (SELECT do owner) + service role para mutações
- `credit_transactions` append-only com `idempotency_key`, `balance_before`, `balance_after`
- SQL functions: `grant_credits`, `reserve_credit`, `refund_credit` — todas com `SELECT ... FOR UPDATE`
- `CreditService.getBalance(storeId)` → saldo atual
- `CreditService.reserveCredit(storeId, amount, opts?)` → txId (dedução)
- `CreditService.confirmCredit(txId)` → void (no-op na v1.5)
- `CreditService.refundCredit(txId, reason)` → void (estorno)
- `CreditService.grantCredits(storeId, amount, reason, opts?)` → txId (concessão)
- `CreditService.getHistory(storeId, limit, offset)` → transações paginadas
- 25+ testes (saldo, reserva, estorno, concorrência, idempotência, grant, histórico)
- `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F23)

```
                                    ANTES (F23)                        DEPOIS (F24)
═══════════════════════════════════════════════════════════════════════════════════════════

Wallet:
  Saldo por loja                   inexistente                        credit_balances (store_id PK)
  Atualização de saldo              inexistente                        SQL function com FOR UPDATE

Ledger:
  Transações                        inexistente                        credit_transactions (append-only)
  Tipos de transação                inexistente                        grant, purchase, deduction, refund
  Saldo por transação               inexistente                        balance_before + balance_after
  Idempotência                      inexistente                        idempotency_key + unique index

SQL Functions:
  grant_credits                     inexistente                        ✓ atômica com FOR UPDATE
  reserve_credit                    inexistente                        ✓ atômica com FOR UPDATE
  refund_credit                     inexistente                        ✓ atômica com FOR UPDATE

CreditService:
  getBalance                        inexistente                        ✓
  reserveCredit                     inexistente                        ✓
  confirmCredit                     inexistente                        ✓ (no-op)
  refundCredit                      inexistente                        ✓
  grantCredits                      inexistente                        ✓
  getHistory                        inexistente                        ✓

Invariantes:
  Saldo nunca negativo              inexistente                        CHECK constraint + SQL function guard
  Ledger imutável                   inexistente                        append-only, sem UPDATE/DELETE
  Estorno = nova transação          inexistente                        refund como novo INSERT

Dependências:
  credit_orders                     inexistente                        NÃO criada — diferida para F26
  Gateway de pagamento              inexistente                        fora do escopo (F26)
```

---

## Decisões de Arquitetura

### D1 — Eixo do ledger: store_id (não user_id)

`DECIDIDO`

O saldo pertence à **loja**, não ao usuário. O produto é comercialmente por loja. O código existente gira em torno de `store_id` (campanhas, assets, brand profile, geração, métricas). A relação atual é 1:1 user→store, então não há perda funcional — ganha-se preparação para 1:N (times, múltiplos usuários por loja) no futuro.

```sql
CREATE TABLE credit_balances (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE credit_transactions (
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- ...
);
```

**Impacto:** Toda operação do `CreditService` recebe `storeId` (não `userId`). O chamador (handler HTTP) é responsável por resolver `userId` → `storeId` via `requireOwnership` antes de chamar o serviço. Isso mantém a camada de ownership já consolidada.

---

### D2 — Ledger imutável (append-only)

`DECIDIDO`

`credit_transactions` é estritamente append-only. Nenhuma transação é alterada ou deletada após criada. O tipo `refund` insere uma nova transação com `amount` positivo e aponta para a transação original via `reference` ou `metadata`.

**O que é permitido:**
- INSERT de novas transações
- SELECT (leitura de histórico)

**O que é proibido:**
- UPDATE em qualquer coluna de qualquer transação existente
- DELETE de qualquer transação

**Reforço no banco:** duas camadas de proteção:

1. **RLS + GRANTs** — `credit_transactions` só expõe SELECT para authenticated. Nenhum GRANT de INSERT/UPDATE/DELETE.
2. **Trigger de blindagem** — `BEFORE UPDATE OR DELETE` que executa `RAISE EXCEPTION`. Isso impede alterações mesmo via service_role, que bypassa RLS. Manutenção excepcional (correção de dados, suporte sob runbook) exige migration controlada que desabilita ou remove temporariamente o trigger — nunca é feito via UPDATE/DELETE direto em produção sem trilha documentada.

Se uma correção for necessária (ex: transação tipo errado), o procedimento é INSERT de transação do tipo `adjustment`, não alterar a existente.

```sql
-- RLS: apenas SELECT para owner
CREATE POLICY "owner_select_credit_transactions" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON TABLE public.credit_transactions TO authenticated;

-- Trigger de blindagem: impede UPDATE/DELETE mesmo via service_role
CREATE OR REPLACE FUNCTION public.prevent_credit_transactions_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'credit_transactions é append-only. Nenhum UPDATE ou DELETE é permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_transactions_immutable
  BEFORE UPDATE OR DELETE ON public.credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_credit_transactions_mutation();

-- GRANT INSERT, UPDATE, DELETE são EXPLICITAMENTE OMITIDOS para authenticated.
```

---

### D3 — Tipos de transação (enum fixo)

`DECIDIDO`

Exatos 5 tipos, validados por CHECK constraint:

| Tipo | Amount | Descrição |
|------|--------|-----------|
| `grant` | positivo (+N) | Concessão gratuita (onboarding, bônus, cortesia) |
| `purchase` | positivo (+N) | Créditos comprados via gateway de pagamento |
| `deduction` | negativo (-N) | Consumo de crédito por geração de campanha |
| `refund` | positivo (+N) | Estorno de deduction (gera saldo positivo) |
| `adjustment` | positivo ou negativo | Correção manual administrativa (invisível no extrato do usuário) |

Nenhum outro tipo é aceito. Transações do tipo `adjustment` são filtradas do extrato do usuário (`CreditService.getHistory`).

---

### D3-A — Constraints de sinal e valor por tipo de transação

`DECIDIDO`

O sinal do `amount` é validado por CHECK constraint no banco, não apenas por convenção:

```sql
CONSTRAINT chk_credit_transactions_amount_sign CHECK (
  (type IN ('grant', 'purchase', 'refund') AND amount > 0)
  OR (type = 'deduction' AND amount < 0)
  OR (type = 'adjustment' AND amount <> 0)
)
```

Além disso:
- `balance_before >= 0` e `balance_after >= 0` — saldo nunca negativo em nenhum ponto da transação
- `amount <> 0` — nenhuma transação de valor zero
- As SQL functions validam `p_amount > 0` na entrada (positive amount, a função converte para negativo quando necessário)

---

### D4 — Idempotência desde a fundação

`DECIDIDO`

O ledger nasce com suporte a idempotência para evitar duplicidade em cenários de retry (timeout de rede, falha de handler, webhook duplicado).

```sql
CREATE TABLE credit_transactions (
  -- ...
  idempotency_key TEXT,
  -- ...
);

-- Partial unique index escopado por loja: só aplica quando idempotency_key é preenchido
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_idempotency
  ON public.credit_transactions (store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

**Contrato de idempotência (3 cenários):**

Busca sempre por `store_id + idempotency_key`, sem filtrar por tipo:
1. **Encontrou com o tipo esperado** → retorna transação existente (no-op)
2. **Encontrou com tipo diferente** → `RAISE EXCEPTION 'idempotency_conflict'` — erro claro, não deixa unique constraint estourar silenciosamente
3. **Não encontrou** → executa normalmente

Se `idempotency_key` não é fornecido → executa normalmente (sem proteção de idempotência).

**Uso por operação:**

| Operação | Gera idempotency_key? | Fonte |
|----------|----------------------|-------|
| `grantCredits` (onboarding) | Sim | `onboarding_{storeId}` |
| `grantCredits` (compra) | Sim | `purchase_{checkoutSessionId}` (na F26) |
| `reserveCredit` | Sim | `reserve_{campaignId}` |
| `refundCredit` | Sim | `refund_{originalTxId}` |
| `adjustment` | Opcional | Definição administrativa |

---

### D5 — balance_before + balance_after em toda transação

`DECIDIDO`

Toda transação registra o saldo antes e depois da operação. Isso permite reconciliação linear: o saldo atual de qualquer store_id pode ser verificado somando todas as transações.

```sql
balance_before INTEGER NOT NULL,
balance_after  INTEGER NOT NULL,
```

A SQL function calcula `balance_before` lendo o saldo atual com `SELECT ... FOR UPDATE`, e `balance_after` = `balance_before + amount`. A CHECK constraint `balance_after >= 0` no `credit_balances` é a barreira final.

**Motivo:** Auditoria. Em caso de bug, é possível rebuildar o saldo a partir do histórico. Suporte consegue responder "qual era o saldo em 1º de agosto?" sem depender de snapshot.

---

### D6 — SQL functions para atomicidade (app-level NÃO)

`DECIDIDO`

Toda mutação de saldo ocorre dentro de SQL functions que executam em transação única com `SELECT ... FOR UPDATE`:

```
grant_credits(store_id, amount, reason, idempotency_key?)
  Valida: IF amount <= 0 → RAISE EXCEPTION 'amount_invalido'
  1. IF idempotency_key IS NOT NULL → busca por store_id + idempotency_key (sem filtrar tipo)
     Se encontrou com type = 'grant' → RETURN tx existente (no-op)
     Se encontrou com type != 'grant' → RAISE EXCEPTION 'idempotency_conflict'
  2. INSERT INTO credit_balances (store_id, balance) VALUES (p_store_id, 0)
     ON CONFLICT (store_id) DO NOTHING  -- garante linha existente antes do lock
  3. SELECT balance FROM credit_balances WHERE store_id = id FOR UPDATE
  4. new_balance = balance + amount
  5. INSERT credit_transactions (store_id, type='grant', amount, balance_before=balance, balance_after=new_balance, idempotency_key, ...)
  6. UPDATE credit_balances SET balance = new_balance
  7. RETURN tx_id

reserve_credit(store_id, amount, campaign_id, idempotency_key?)
  Valida: IF amount <= 0 → RAISE EXCEPTION 'amount_invalido'
  1. IF idempotency_key IS NOT NULL → busca por store_id + idempotency_key (sem filtrar tipo)
     Se encontrou com type = 'deduction' → RETURN tx existente (no-op)
     Se encontrou com type != 'deduction' → RAISE EXCEPTION 'idempotency_conflict'
  2. SELECT balance FROM credit_balances WHERE store_id = id FOR UPDATE
  3. IF NOT FOUND → RAISE EXCEPTION 'saldo_inexistente'
  4. IF balance < amount → RAISE EXCEPTION 'saldo_insuficiente'
  5. new_balance = balance - amount
  6. INSERT credit_transactions (store_id, type='deduction', amount=-amount, balance_before=balance, balance_after=new_balance, campaign_id, idempotency_key, ...)
  7. UPDATE credit_balances SET balance = new_balance
  8. RETURN tx_id

refund_credit(tx_id, reason, idempotency_key?)
  1. SELECT tx original (type = 'deduction') com id = tx_id — verifica se existe
     IF NOT FOUND → RAISE EXCEPTION 'transacao_nao_encontrada'
  2. store_id = tx.store_id  -- extraído da tx original
  3. IF idempotency_key IS NOT NULL → busca por store_id + idempotency_key (sem filtrar tipo)
     Se encontrou com type = 'refund' → RETURN tx existente (no-op)
     Se encontrou com type != 'refund' → RAISE EXCEPTION 'idempotency_conflict'
  4. IF já existe refund com reference = tx_id → RETURN refund existente (idempotência interna)
  5. SELECT balance FROM credit_balances FOR UPDATE
  6. amount = ABS(original.amount)  -- positivo
  7. new_balance = balance + amount
  8. INSERT credit_transactions (store_id, type='refund', amount, balance_before=balance, balance_after=new_balance, reference=tx_id, ...)
  9. UPDATE credit_balances SET balance = new_balance
  10. RETURN tx_id
```

**App-level NÃO será usado** para mutações de saldo. A aplicação chama `supabaseAdmin.rpc('reserve_credit', {...})`. O handler HTTP é responsável por:
- Validar ownership (requireOwnership)
- Chamar a SQL function
- Tratar erro `saldo_insuficiente` → 402 Payment Required
- Tratar erro de concorrência (deadlock detectado pelo Postgres) → retry com backoff

---

### D7 — Pagamento: Stripe sim, mas D4 da milestone é ajustada

`AJUSTADO` (vs milestone original D4)

A milestone original decidia Stripe Checkout como provedor primário. Após validação de mercado, o cenário real é:

> **Público-alvo:** lojistas brasileiros pequenos. Pix é o meio de pagamento dominante no Brasil (mais de 40% das transações e-commerce em 2025–2026). Stripe aceita Pix desde 2025 via Stripe Payments Brasil, mas a disponibilidade depende da conta Stripe do Vendeo e do mercado configurado.

**Decisão ajustada:**
- **Provedor preferencial:** Stripe Checkout, desde que Stripe Pix esteja disponível e habilitável para a conta Stripe do Vendeo
- **Fallback:** Se Stripe Pix não estiver operacional antes da implementação da F26, **Mercado Pago** substitui Stripe como gateway inicial (Mercado Pago é o gateway mais usado por pequenos negócios brasileiros, com Pix nativo)
- **Impacto na F24:** Nenhum. A F24 não depende de gateway. `credit_transactions.type = 'purchase'` e `reference` são suficientes para qualquer provedor. Se o provedor mudar, o schema do ledger não muda — apenas a F26 (que cria `credit_orders` e o webhook) precisa se adaptar.
- **Decisão final:** será tomada durante o design da F26, após validação da conta Stripe.

**Registro no design:** A F24 captura esta decisão apenas como nota — não afeta implementação. O ledger aceita qualquer provedor via `type='purchase'` + `reference` + `metadata`.

---

### D8 — credit_orders NÃO entra na F24 (diferido para F26)

`DECIDIDO`

`credit_orders` é uma tabela de **intenção/estado de compra**, não de crédito. Ela responde "qual compra aconteceu no gateway, com qual checkout/payment/refund, status, valor e pacote?".

**Motivo da exclusão da F24:**
- Sem checkout e webhook na F24, a tabela ficaria como contrato morto — sem rota, sem service, sem comportamento testável
- Tabela vazia "pré-criada" em sistema financeiro tende a virar dívida sem guardião
- A F24 já entrega ledger funcional para debitar e creditar saldo — isso é suficiente para F25 testar o pipeline de geração

**Contrato entre F24 e F26:**

```
F24 (ledger)                              F26 (credit_orders)
─────────────                             ──────────────────────
credit_transactions:                      credit_orders (NOVO):
  id                                        id
  store_id                                  store_id
  type = 'purchase'                         package_id
  amount = +N                               credits
  balance_before                            amount_cents
  balance_after                             currency
  reference = credit_order.id               status (pending, paid, refunded, failed)
  metadata = {                              provider
    package_id, credits,                    provider_checkout_id
    amount_cents, currency                  provider_payment_id
  }                                         grant_transaction_id → credit_transactions.id
                                            paid_at, refunded_at, created_at, updated_at
```

A F24 inclui no `design.md` o contrato esperado: F26 adiciona `credit_orders` e usa `credit_transactions.reference` para vincular compra a ledger.

---

### D9 — CreditService como classe, acesso via supabaseAdmin

`DECIDIDO`

```typescript
export class CreditService {
  constructor(private readonly adminClient = supabaseAdmin) {}

  async getBalance(storeId: string): Promise<number> { ... }
  async reserveCredit(storeId: string, amount: number, opts?: CreditOperationOptions): Promise<string> { ... }
  async confirmCredit(txId: string): Promise<void> { ... }
  async refundCredit(txId: string, reason: string, opts?: CreditOperationOptions): Promise<string> { ... }
  async grantCredits(storeId: string, amount: number, reason: string, opts?: CreditOperationOptions): Promise<string> { ... }
  async getHistory(storeId: string, limit?: number, offset?: number): Promise<CreditTransaction[]> { ... }
}

export interface CreditOperationOptions {
  campaignId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}
```

**Padrão:** Classe com injeção de dependência (recebe `adminClient` no constructor), mesma abordagem de `CopyDirectorService` e `ImageGenerationService`. Toda mutação chama `this.adminClient.rpc('function_name', params)` — nunca faz INSERT/UPDATE diretamente via query builder para operações de saldo.

**SELECTs** (`getBalance`, `getHistory`): podem usar `this.adminClient.from(...)` com queries diretas, pois são leituras sem risco de race condition. Mas `getBalance` lê de `credit_balances` (tabela materializada), não soma transações.

---

## Migrations

A fase produz UMA migration SQL:

```
20260716000001_create_credit_tables.sql
```

### Tabela `credit_balances`

```sql
-- Wallet de saldo por loja.
-- Materializado para leitura rápida (evita SUM de transações a cada request).
-- CHECK (balance >= 0) é a barreira final — nenhuma operação pode tornar saldo negativo.
-- Mutado exclusivamente por SQL functions (reserve_credit, refund_credit, grant_credits).

CREATE TABLE IF NOT EXISTS public.credit_balances (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger scoped (padrão do repositório)
CREATE OR REPLACE FUNCTION public.update_credit_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_balances_updated_at
  BEFORE UPDATE ON public.credit_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_credit_balances_updated_at();

-- Row Level Security
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;

-- Apenas SELECT para o owner (UI de saldo no app shell e /conta)
CREATE POLICY "owner_select_credit_balances" ON public.credit_balances
  FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON TABLE public.credit_balances TO authenticated;

-- INSERT, UPDATE, DELETE são exclusivos de SQL functions via service_role
-- GRANT INSERT, UPDATE, DELETE são EXPLICITAMENTE OMITIDOS para authenticated.

-- REVERT:
-- REVOKE SELECT ON TABLE public.credit_balances FROM authenticated;
-- DROP POLICY IF EXISTS "owner_select_credit_balances" ON public.credit_balances;
-- ALTER TABLE public.credit_balances DISABLE ROW LEVEL SECURITY;
-- DROP TRIGGER IF EXISTS trg_credit_balances_updated_at ON public.credit_balances;
-- DROP FUNCTION IF EXISTS public.update_credit_balances_updated_at();
-- DROP TABLE IF EXISTS public.credit_balances;
```

### Tabela `credit_transactions`

```sql
-- Ledger imutável de transações de crédito.
-- Append-only: nenhum UPDATE ou DELETE é permitido (nem mesmo via service_role).
-- Estornos criam nova transação com type = 'refund'.
-- balance_before + balance_after permitem reconciliação linear.
-- idempotency_key com unique partial index protege contra duplicidade em retry.

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('grant', 'purchase', 'deduction', 'refund', 'adjustment')),
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  reason TEXT,
  reference TEXT,
  idempotency_key TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index composto: transações de uma loja em ordem cronológica reversa
CREATE INDEX IF NOT EXISTS idx_credit_transactions_store_id
  ON public.credit_transactions (store_id, created_at DESC);

-- Constraints de sinal: cada tipo de transação tem sinal obrigatório
-- grant/purchase/refund > 0, deduction < 0, adjustment <> 0
-- balance_before e balance_after nunca negativos (auditoria)
-- amount nunca zero
ALTER TABLE public.credit_transactions ADD CONSTRAINT chk_credit_transactions_amount_sign CHECK (
  (type IN ('grant', 'purchase', 'refund') AND amount > 0)
  OR (type = 'deduction' AND amount < 0)
  OR (type = 'adjustment' AND amount <> 0)
);

-- Partial unique index escopado por loja: só aplica quando idempotency_key é preenchido
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_idempotency
  ON public.credit_transactions (store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Row Level Security
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Apenas SELECT para o owner (extrato na página /conta)
CREATE POLICY "owner_select_credit_transactions" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON TABLE public.credit_transactions TO authenticated;

-- NOTA: INSERT, UPDATE, DELETE são exclusivos das SQL functions via service_role.
-- NENHUMA GRANT ou policy de INSERT/UPDATE/DELETE para authenticated.
-- Nem mesmo service_role deve ter UPDATE/DELETE (ledger imutável).

-- REVERT:
-- REVOKE SELECT ON TABLE public.credit_transactions FROM authenticated;
-- DROP POLICY IF EXISTS "owner_select_credit_transactions" ON public.credit_transactions;
-- ALTER TABLE public.credit_transactions DISABLE ROW LEVEL SECURITY;
-- DROP TRIGGER IF EXISTS trg_credit_transactions_immutable ON public.credit_transactions;
-- DROP FUNCTION IF EXISTS public.prevent_credit_transactions_mutation();
-- ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS chk_credit_transactions_amount_sign;
-- DROP INDEX IF EXISTS idx_credit_transactions_idempotency;
-- DROP INDEX IF EXISTS idx_credit_transactions_store_id;
-- DROP TABLE IF EXISTS public.credit_transactions;
```

### SQL Functions

As funções SQL são incluídas na MESMA migration (após as tabelas):

```sql
-- grant_credits: concede créditos a uma loja (onboarding, compra, bônus)
-- Se idempotency_key for fornecida e já existir, retorna a transação existente.
-- Se a loja não tem registro em credit_balances, cria com balance=0 primeiro.
CREATE OR REPLACE FUNCTION public.grant_credits(
  p_store_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_current_balance INTEGER;
  v_tx_id UUID;
  v_existing_id UUID;
  v_type TEXT;
BEGIN
  -- Validação: amount deve ser positivo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalido'
      USING HINT = 'Amount deve ser maior que zero';
  END IF;

  -- Idempotência: busca por store_id + chave (sem filtrar tipo)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, type INTO v_existing_id, v_type FROM public.credit_transactions
      WHERE store_id = p_store_id
        AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      IF v_type = 'grant' THEN
        RETURN v_existing_id;
      ELSE
        RAISE EXCEPTION 'idempotency_conflict'
          USING HINT = 'Chave já usada para transação do tipo ' || v_type;
      END IF;
    END IF;
  END IF;

  -- Garante linha em credit_balances antes do lock (evita race de INSERT concorrente)
  INSERT INTO public.credit_balances (store_id, balance)
  VALUES (p_store_id, 0)
  ON CONFLICT (store_id) DO NOTHING;

  -- Lock no saldo da loja
  SELECT balance INTO v_current_balance
  FROM public.credit_balances
  WHERE store_id = p_store_id
  FOR UPDATE;

  -- Insere transação
  INSERT INTO public.credit_transactions (
    store_id, type, amount,
    balance_before, balance_after,
    reason, idempotency_key, metadata
  ) VALUES (
    p_store_id, 'grant', p_amount,
    v_current_balance, v_current_balance + p_amount,
    p_reason, p_idempotency_key, p_metadata
  ) RETURNING id INTO v_tx_id;

  -- Atualiza saldo
  UPDATE public.credit_balances
  SET balance = v_current_balance + p_amount
  WHERE store_id = p_store_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;
```

```sql
-- reserve_credit: deduz créditos do saldo da loja (geração de campanha)
-- Se saldo < amount, lança exceção 'saldo_insuficiente' (código 402 no handler).
-- Se idempotency_key repetida, retorna transação existente.
CREATE OR REPLACE FUNCTION public.reserve_credit(
  p_store_id UUID,
  p_amount INTEGER,
  p_campaign_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_current_balance INTEGER;
  v_tx_id UUID;
  v_existing_id UUID;
  v_type TEXT;
BEGIN
  -- Validação: amount deve ser positivo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_invalido'
      USING HINT = 'Amount deve ser maior que zero';
  END IF;

  -- Idempotência: busca por store_id + chave (sem filtrar tipo)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, type INTO v_existing_id, v_type FROM public.credit_transactions
      WHERE store_id = p_store_id
        AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      IF v_type = 'deduction' THEN
        RETURN v_existing_id;
      ELSE
        RAISE EXCEPTION 'idempotency_conflict'
          USING HINT = 'Chave já usada para transação do tipo ' || v_type;
      END IF;
    END IF;
  END IF;

  -- Lock + leitura do saldo
  SELECT balance INTO v_current_balance
  FROM public.credit_balances
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'saldo_inexistente'
      USING HINT = 'Store sem registro de créditos';
  END IF;

  -- Verifica saldo suficiente
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'saldo_insuficiente'
      USING HINT = 'Saldo disponível: ' || v_current_balance;
  END IF;

  -- Insere transação de deduction
  INSERT INTO public.credit_transactions (
    store_id, type, amount,
    balance_before, balance_after,
    campaign_id, reason, idempotency_key, metadata
  ) VALUES (
    p_store_id, 'deduction', -p_amount,
    v_current_balance, v_current_balance - p_amount,
    p_campaign_id, 'geracao_campanha', p_idempotency_key, p_metadata
  ) RETURNING id INTO v_tx_id;

  -- Atualiza saldo
  UPDATE public.credit_balances
  SET balance = v_current_balance - p_amount
  WHERE store_id = p_store_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;
```

```sql
-- refund_credit: estorna uma transação de deduction anterior.
-- Se a deduction já foi estornada antes, retorna a transação de refund existente.
-- Se idempotency_key repetida, retorna transação existente.
CREATE OR REPLACE FUNCTION public.refund_credit(
  p_tx_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_tx public.credit_transactions;
  v_current_balance INTEGER;
  v_new_tx_id UUID;
  v_existing_id UUID;
  v_store_id UUID;
  v_type TEXT;
BEGIN
  -- Busca transação original (precisa do store_id para idempotência e refund)
  SELECT * INTO v_tx
  FROM public.credit_transactions
  WHERE id = p_tx_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transacao_nao_encontrada'
      USING HINT = 'Transaction ID: ' || p_tx_id;
  END IF;

  -- Só pode estornar deduction
  IF v_tx.type != 'deduction' THEN
    RAISE EXCEPTION 'tipo_invalido'
      USING HINT = 'Apenas transações do tipo deduction podem ser estornadas';
  END IF;

  v_store_id := v_tx.store_id;

  -- Idempotência: busca por store_id + chave (sem filtrar tipo)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, type INTO v_existing_id, v_type FROM public.credit_transactions
      WHERE store_id = v_store_id
        AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      IF v_type = 'refund' THEN
        RETURN v_existing_id;
      ELSE
        RAISE EXCEPTION 'idempotency_conflict'
          USING HINT = 'Chave já usada para transação do tipo ' || v_type;
      END IF;
    END IF;
  END IF;

  -- Verifica se já foi estornado (idempotência interna via reference)
  IF EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE store_id = v_store_id
      AND type = 'refund'
      AND reference = p_tx_id::text
  ) THEN
    SELECT id INTO v_existing_id FROM public.credit_transactions
      WHERE store_id = v_store_id
        AND type = 'refund'
        AND reference = p_tx_id::text
      LIMIT 1;
    RETURN v_existing_id;
  END IF;

  -- Lock no saldo
  SELECT balance INTO v_current_balance
  FROM public.credit_balances
  WHERE store_id = v_store_id
  FOR UPDATE;

  -- Insere transação de refund (amount positivo)
  INSERT INTO public.credit_transactions (
    store_id, type, amount,
    balance_before, balance_after,
    reference, reason, idempotency_key, metadata
  ) VALUES (
    v_store_id, 'refund', ABS(v_tx.amount),
    v_current_balance, v_current_balance + ABS(v_tx.amount),
    p_tx_id::text, p_reason, p_idempotency_key, p_metadata
  ) RETURNING id INTO v_new_tx_id;

  -- Atualiza saldo
  UPDATE public.credit_balances
  SET balance = v_current_balance + ABS(v_tx.amount)
  WHERE store_id = v_store_id;

  RETURN v_new_tx_id;
END;
$$ LANGUAGE plpgsql;
```

---

## Estrutura de Código

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

**Nenhum arquivo existente é modificado na F24.** O `CreditService` é novo e autocontido. A F25 consumirá este serviço, mas a F24 não altera nada existente.

---

## CreditService API

### Types (`src/lib/credit/types.ts`)

```typescript
import { z } from "zod";

export const CreditTransactionTypeSchema = z.enum([
  'grant', 'purchase', 'deduction', 'refund', 'adjustment'
]);

export const CreditTransactionSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  type: CreditTransactionTypeSchema,
  amount: z.number().int(),
  balanceBefore: z.number().int(),
  balanceAfter: z.number().int(),
  campaignId: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  reference: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});

export type CreditTransaction = z.infer<typeof CreditTransactionSchema>;

export interface CreditOperationOptions {
  campaignId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CreditBalance {
  storeId: string;
  balance: number;
  updatedAt: string;
}
```

### Service Methods

```typescript
export class CreditService {
  constructor(private readonly admin?: ReturnType<typeof createClient>) {}

  async getBalance(storeId: string): Promise<number>
  // Retorna saldo atual da loja. Se não existir registro, retorna 0.
  // Lê de credit_balances (tabela materializada).

  async reserveCredit(
    storeId: string,
    amount: number,
    opts?: CreditOperationOptions
  ): Promise<string>
  // Chama reserve_credit SQL function via RPC.
  // amount é positivo (a função converte para negativo internamente).
  // Retorna txId da transação criada.
  // Exceção 'saldo_insuficiente' → propagar como erro 402.

  async confirmCredit(txId: string): Promise<void>
  // No-op na v1.5. A reserva já é definitiva.
  // Existente para preparação de two-phase commit futuro.

  async refundCredit(
    txId: string,
    reason: string,
    opts?: CreditOperationOptions
  ): Promise<string>
  // Chama refund_credit SQL function via RPC.
  // Retorna txId do refund criado (ou existente, se já estornado).

  async grantCredits(
    storeId: string,
    amount: number,
    reason: string,
    opts?: CreditOperationOptions
  ): Promise<string>
  // Chama grant_credits SQL function via RPC.
  // Retorna txId da transação criada (ou existente, se idempotente).

  async getHistory(
    storeId: string,
    limit?: number,
    offset?: number
  ): Promise<CreditTransaction[]>
  // SELECT de credit_transactions para a loja.
  // Filtra type != 'adjustment' (ajustes administrativos são ocultos do usuário).
  // Ordenado por created_at DESC.
  // Default limit = 50, max limit = 100.
}
```

---

## Testes

25+ testes em `src/lib/credit/__tests__/credit-service.test.ts`:

### Saldo e Grant (6 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | `getBalance` retorna 0 para loja sem registro | Primeiro acesso, sem credit_balances |
| 2 | `grantCredits` adiciona saldo | Concessão básica |
| 3 | `grantCredits` múltiplas vezes acumula | 3 grants de 5 = saldo 15 |
| 4 | `grantCredits` com idempotency_key repetido retorna mesma tx | Não duplica |
| 5 | `getBalance` reflete grant | Saldo após grant |
| 6 | `grantCredits` com reason null funciona | Campo opcional |

### Reserva e Dedução (7 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 7 | `reserveCredit` deduz saldo | 10 créditos - 1 = 9 |
| 8 | `reserveCredit` com saldo insuficiente rejeita | Saldo 0, tenta reservar → erro |
| 9 | `reserveCredit` com campaignId registra referência | Transação tem campaign_id preenchido |
| 10 | `reserveCredit` com idempotency_key repetido retorna mesma tx | Não duplica dedução |
| 11 | Múltiplas reservas consecutivas | 3 reservas de 1, saldo correto |
| 12 | `getBalance` reflete deduções | Saldo após reservas |
| 13 | `reserveCredit` amount > saldo → erro `saldo_insuficiente` | Proteção de gasto excessivo |

### Estorno (5 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 14 | `refundCredit` restaura saldo | Dedução de 5 → estorno → saldo volta |
| 15 | `refundCredit` com deduction inexistente → erro | txId inválido |
| 16 | `refundCredit` duplicado é no-op (retorna mesmo refund) | Idempotência interna |
| 17 | `refundCredit` com idempotency_key repetido retorna mesmo refund | Idempotência externa |
| 18 | `refundCredit` em transação que não é deduction → erro | Apenas deduction é estornável |

### Histórico (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 19 | `getHistory` retorna transações da loja (sem adjustment) | Filtro correto |
| 20 | `getHistory` paginado (limit/offset) | 5 transações, limit=2, offset=1 |
| 21 | `getHistory` loja sem transações → array vazio | Loja recém-criada |
| 22 | `getHistory` default limit = 50 | Sem parâmetros, retorna até 50 |

### Concorrência (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 23 | Duas reservas simultâneas com saldo justo | Saldo = 2, 2 reserves de 1 → ambas OK |
| 24 | Duas reservas simultâneas com saldo insuficiente | Saldo = 1, 2 reserves de 1 → uma OK, outra erro |
| 25 | Grant + Reserve simultâneos | Grant e reserve em paralelo não corrompem saldo |

### Verificação de invariantes (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 26 | Saldo nunca negativo após operações encadeadas | Grant 5, reserve 3, reserve 2, reserve 1 → erro no último |
| 27 | Transações são imutáveis (nenhum UPDATE ou DELETE) | Query direta no banco verifica ausência de permissões |
| 28 | `adjustment` não aparece no extrato público | Filtro `getHistory` exclui type=adjustment |

### Verificação SQL/Integrada (obrigatória — coração da F24)

Os testes unitários com `vi.mock` provam que o TypeScript chama RPC com parâmetros corretos. Para validar o **coração da F24** (atomicidade, idempotência, FOR UPDATE), é necessária verificação contra banco real:

| # | Verificação | O que prova |
|---|-------------|-------------|
| I1 | `grant_credits` real contra banco → saldo > 0 | SQL function executa corretamente |
| I2 | `reserve_credit` real → saldo deduzido | Dedução atômica |
| I3 | `refund_credit` real → saldo restaurado | Estorno atômico |
| I4 | `reserve_credit` com saldo insuficiente → exceção | Guard `saldo_insuficiente` funciona |
| I5 | `refund_credit` duplicado → no-op (não dobra saldo) | Idempotência interna via reference |
| I6 | Mesma `idempotency_key` em duas chamadas → mesma tx retornada | Idempotência real via unique index |
| I7 | Duas chamadas simultâneas de `reserve_credit` com saldo justo | Concorrência com FOR UPDATE |

**Execução:** via script SQL direto (conectado ao Supabase local) ou teste Jest/Vitest com `supabaseAdmin.rpc()` real contra banco de teste. A verificação I1–I7 pode ser automatizada ou manual (UAT técnico), mas é **obrigatória** — a F24 não está completa sem ela.

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Race condition em reserva simultânea** — dois requests do mesmo usuário chegam juntos | SQL function com `SELECT ... FOR UPDATE` serializa. Postgres gerencia deadlock detection automaticamente. App layer faz retry com backoff |
| **Idempotency_key collision** — mesma chave em operações de tipos diferentes (ex: reserve e refund) | SQL function busca por `store_id + idempotency_key` sem filtrar tipo. Se encontrou com tipo diferente do esperado, retorna `idempotency_conflict` com erro claro — nunca deixa unique constraint estourar silenciosamente. Cada operação também prefixa a chave (`reserve_{campaignId}`, `refund_{txId}`, `onboarding_{storeId}`) como proteção adicional |
| **Refund de transação já estornada** — duplicação de saldo | SQL function verifica se já existe refund com `reference = tx_id`. Se sim, retorna o refund existente |
| **Saldo inconsistente entre ledger e wallet** — bug na SQL function corrompe `balance_after` | CHECK `balance >= 0` é a barreira final. `balance_before` + `balance_after` permitem reconciliação. Teste #25 valida concorrência |
| **Mudança de gateway (Stripe → Mercado Pago)** — ledger precisa se adaptar | `credit_transactions` não tem provider/payment_id como coluna. `type='purchase'` + `reference` + `metadata` são genéricos. `credit_orders` (F26) isola detalhes do gateway |
| **SQL functions sem verificação real** — `vi.mock` do RPC só prova que o TypeScript chama com parâmetros certos; não prova `FOR UPDATE`, idempotência real, nem concorrência | Exigir verificação SQL/integrada mínima contra banco real (Supabase local ou PG efêmero) para: grant + reserve + refund reais, idempotency real, saldo insuficiente, duplo refund. Os testes unitários do `CreditService` (mock) cobrem contrato TypeScript; a verificação integrada cobre o coração da F24 |
| **Loja sem registro em credit_balances** — primeira operação precisa criar registro | `grant_credits` cria registro com balance=0 se não existir. `getBalance` retorna 0 se não existir. `reserve_credit` lança erro se não existir (loja sem grant inicial é estado inválido) |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| `credit_orders` (tabela, service, rota) | Diferido para F26. A F24 registra o contrato de integração no design |
| Checkout / compra de créditos | F26 — depende de gateway |
| Webhook Stripe / Mercado Pago | F26 — depende de gateway |
| Reembolso via provedor de pagamento | F26 — operação administrativa no gateway |
| UI de saldo na topbar | F27 — app shell |
| UI de créditos em `/conta` (saldo, comprar, extrato) | F27 — página de conta |
| Rate limit por usuário (10/hora, 30/dia) | F25 — integração no pipeline |
| Timeout de geração (120s) | F25 — integração no pipeline |
| Bloqueio de geração sem crédito | F25 — integração no pipeline (402 Payment Required) |
| Definição de custo por geração (`COST_PER_GENERATION`) | F25 — pricing de geração, não de wallet. `CreditService` aceita `amount` genérico |
| Provider de texto Anthropic/Gemini | F23 já definiu: fora do escopo da v1.5 |
| `mandatoryArtworkText` | F25 — separação copy × arte |
| Observabilidade (logging, telemetria) | F28 |
| Refinamento visual da experiência | F29 |

---

## Decisões de Alinhamento

- [ ] D1 — Eixo do ledger: `store_id` (não `user_id`)
- [ ] D2 — Ledger imutável (append-only). Nenhum UPDATE/DELETE em transações
- [ ] D3 — Tipos de transação: `grant`, `purchase`, `deduction`, `refund`, `adjustment`
- [ ] D4 — Idempotência desde a fundação (`idempotency_key` + partial unique index por store_id)
- [ ] D5 — `balance_before` + `balance_after` em toda transação (reconciliação linear)
- [ ] D6 — SQL functions para atomicidade com `SELECT ... FOR UPDATE`. App-level NÃO
- [ ] D7 — Pagamento: Stripe preferencial com Pix; Mercado Pago como fallback. Decisão final na F26. F24 não depende
- [ ] D8 — `credit_orders` NÃO entra na F24. Diferido para F26 com contrato de integração
- [ ] D9 — `CreditService` como classe com injeção de `supabaseAdmin`

---

## Checklist de Revisão

### Migration — Tabelas + SQL Functions
- [ ] `credit_balances` criada com `store_id PK`, `balance CHECK>=0`, `updated_at`
- [ ] Trigger `trg_credit_balances_updated_at` (scoped, padrão do repositório)
- [ ] RLS habilitado em `credit_balances`
- [ ] Policy `owner_select_credit_balances` (subquery `stores.user_id = auth.uid()`)
- [ ] `GRANT SELECT TO authenticated` executado (INSERT/UPDATE/DELETE omitidos)
- [ ] `credit_transactions` criada com todos os campos, tipos, defaults
- [ ] CHECK constraint `type IN ('grant','purchase','deduction','refund','adjustment')`
- [ ] CHECK constraint `chk_credit_transactions_amount_sign` — sinal do amount por tipo
- [ ] CHECK constraints `balance_before >= 0` e `balance_after >= 0`
- [ ] CHECK constraint `amount <> 0`
- [ ] Índice `idx_credit_transactions_store_id` (store_id, created_at DESC)
- [ ] Partial unique index `idx_credit_transactions_idempotency` (store_id, idempotency_key WHERE NOT NULL)
- [ ] RLS habilitado em `credit_transactions`
- [ ] Policy `owner_select_credit_transactions` (subquery stores.user_id)
- [ ] `GRANT SELECT TO authenticated` executado (INSERT/UPDATE/DELETE omitidos)
- [ ] Trigger `trg_credit_transactions_immutable` — BEFORE UPDATE OR DELETE com RAISE EXCEPTION
- [ ] SQL function `grant_credits` com idempotência, FOR UPDATE, INSERT ON CONFLICT
- [ ] SQL function `reserve_credit` com idempotência, FOR UPDATE, saldo insuficiente → exceção
- [ ] SQL function `refund_credit` com idempotência, verificação de tipo, bloqueio de duplo estorno
- [ ] Revert commands documentados no final da migration

### CreditService
- [ ] `src/lib/credit/types.ts` — schemas Zod + interfaces
- [ ] `src/lib/credit/credit-service.ts` — classe com 6 métodos
- [ ] `getBalance` retorna 0 para loja sem registro
- [ ] `reserveCredit` chama RPC `reserve_credit` com parâmetros corretos
- [ ] `refundCredit` chama RPC `refund_credit` com parâmetros corretos
- [ ] `grantCredits` chama RPC `grant_credits` com parâmetros corretos
- [ ] `getHistory` filtra `type != 'adjustment'`
- [ ] `getHistory` paginação com limit/offset, default 50

### Testes (25+)
- [ ] Saldo inicial zero (#1)
- [ ] Grant adiciona saldo (#2)
- [ ] Grant idempotente não duplica (#4)
- [ ] Reserve deduz saldo (#7)
- [ ] Reserve com saldo insuficiente → erro (#8, #13)
- [ ] Reserve idempotente não duplica (#10)
- [ ] Refund restaura saldo (#14)
- [ ] Refund duplicado é no-op (#16, #17)
- [ ] Refund de não-deduction → erro (#18)
- [ ] Histórico paginado (#20)
- [ ] Histórico vazio para loja sem transações (#21)
- [ ] Concorrência: duas reservas simultâneas (#23, #24)
- [ ] Saldo nunca negativo (#26)
- [ ] `adjustment` não aparece no extrato (#28)

### Verificação final
- [ ] `npx vitest run src/lib/credit/__tests__/credit-service.test.ts` — 25+ testes passando
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — novos + 740 existentes passando
- [ ] `npm run build` — build bem-sucedido
- [ ] Nenhum arquivo existente foi modificado (F24 é autocontida)
- [ ] I1 — `grant_credits` real contra banco → saldo > 0
- [ ] I2 — `reserve_credit` real → saldo deduzido
- [ ] I3 — `refund_credit` real → saldo restaurado
- [ ] I4 — `reserve_credit` com saldo insuficiente → exceção `saldo_insuficiente`
- [ ] I5 — `refund_credit` duplicado → no-op (não dobra saldo)
- [ ] I6 — Mesma `idempotency_key` em duas chamadas → mesma tx retornada
- [ ] I7 — Duas chamadas simultâneas de `reserve_credit` com saldo justo

---

## Nota de Design para F26

Este artefato registra o contrato esperado entre F24 (ledger) e F26 (pagamento):

> **F26 deve adicionar:**
> 1. Tabela `credit_orders` — pedido de compra no gateway (checkout_id, payment_id, status, pacote, valor, grant_transaction_id FK → credit_transactions.id)
> 2. Vincular compra ao ledger via `credit_transactions.reference = credit_order.id`
> 3. Provider/payment data **não entra como coluna no ledger** — fica em `credit_orders` e opcionalmente em `credit_transactions.metadata` como snapshot

---

*Documento criado: 2026-07-16*
*Baseado no alinhamento da milestone v1.5 (D1–D12), exploração do estado atual do código (pós-F23), discussão entre dois agentes com decisões registradas.*
*Próximo passo: sua revisão e aprovação.*
