# Alinhamento Fase 29.3 — Créditos Mensais Automáticos (v1.5)

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)
  ├── F23 — TextProvider + Copy Director (fundação IA de texto)                    ✓
  ├── F24 — Wallet + Ledger + Idempotência (fundação financeira)                   ✓
  ├── F25 — Integração Transacional do Pipeline (créditos + copy + rate limit)      ✓
  ├── F26 — Admin Operacional + Convites + Créditos Manuais                        ✓
  ├── F27 — Conta + Saldo Visível + Extrato                                        ✓
  ├── F28 — Observabilidade + Operação + Launch Controls                            ✓
  ├── F29.1 — Assinatura Visual com Créditos + Histórico Curto                      ✓
  ├── F29.2 — Refinamento Visual + UAT + Launch Readiness                          ✓
  ├── F29.3 — Créditos Mensais Automáticos                                           ← esta fase
  └── F30/v1.6 — Stripe / Monetização Pública (adiado para pós-beta)
```

A F24 entregou `credit_balances`, `credit_transactions` e as funções atômicas (`grant_credits`, `reserve_credit`, `refund_credit`) — a fundação financeira do produto. A F25 integrou créditos no pipeline de geração. A F26 adicionou admin operacional com grant manual. A F27 trouxe saldo visível e extrato para o usuário. A F29.1 fez a assinatura visual consumir créditos.

**O que ainda não existe:**

- Créditos mensais recorrentes — o único grant automático é o onboarding (10 créditos, uma vez)
- Distinção entre créditos bônus (concedidos) e créditos comprados — o saldo é único
- Política de consumo que prioriza bônus sobre compra
- Teto de acúmulo de bônus
- Execução agendada (cron) para concessão recorrente
- Configuração admin para política de bônus mensal

**Esta fase implementa o ciclo de créditos mensais automáticos com distinção contábil entre bônus e compra, teto de acúmulo, consumo prioritário de bônus e execução via Vercel Cron.**

---

## Realinhamento de Escopo

O escopo original ("conceder 5 créditos a cada 30 dias por loja") evoluiu durante a discussão para incluir:

| Item | Escopo original | Escopo realinhado |
|------|----------------|-------------------|
| **Saldo** | Saldo único (`credit_balances.balance`) | Dois buckets (`bonus_balance` + `purchased_balance`) + total derivado (`balance` via trigger) |
| **Concessão** | 5 créditos fixos a cada 30 dias | Configurável via Launch Config: `monthlyCreditsAmount`, `monthlyBonusCap`, `monthlyCreditsMinStoreAgeDays` |
| **Elegibilidade** | Baseada em `stores.created_at` | `created_at >= 30 dias` + `bonus_balance < monthlyBonusCap` |
| **Teto de bônus** | Inexistente | `monthlyBonusCap` (default 10) — impede acúmulo infinito de bônus |
| **Consumo** | Saldo único (FIFO implícito) | Bônus primeiro, comprado por último |
| **Executor** | Indefinido | Vercel Cron (primário), fallback admin manual |
| **Idempotência** | Já existe em `grant_credits` | Reforçada com `idempotency_key` por ciclo + store |

### Justificativa

1. **Saldo único sem bucket é insuficiente** — a pergunta "quanto do saldo atual é bônus?" fica impossível de responder depois que o usuário começa a consumir créditos. Sem distinção, o teto de bônus (`monthlyBonusCap`) não pode ser aplicado corretamente.

2. **Consumir bônus primeiro é a regra correta para o usuário** — créditos comprados representam valor pago. Preservá-los para o usuário é justo e evita que a compra seja "perdida" enquanto bônus gratuitos são usados primeiro.

3. **Vercel Cron como executor primário** — já está habilitado no projeto, encaixa no Next.js App Router, é simples de testar manualmente e evita configurar extensão pg_cron no Supabase neste momento. pg_cron fica como alternativa futura.

4. **Launch Config para política de bônus** — a quantidade, o teto e a elegibilidade devem ser configuráveis sem deploy, consistentes com o padrão F28.

---

## Propósito

1. **Modelo contábil com buckets** — `credit_balances` ganha `bonus_balance` e `purchased_balance`; `balance` mantido como soma automática via trigger
2. **Categorias de transação expandidas** — `bonus_onboarding`, `bonus_monthly`, `admin_grant`, `purchase` substituem `grant` genérico
3. **Consumo prioritário de bônus** — `reserve_credit()` desconta de `bonus_balance` primeiro, `purchased_balance` por último
4. **Concessão mensal automática** — Vercel Cron diário executa RPC que concede créditos bônus a lojas elegíveis
5. **Elegibilidade por idade da loja** — `stores.created_at` deve ser anterior a `NOW() - monthlyCreditsMinStoreAgeDays` (default 30 dias)
6. **Teto de bônus configurável** — `monthlyBonusCap` (default 10) impede acúmulo além do limite
7. **Grant parcial** — se `bonus_balance + monthlyCreditsAmount > monthlyBonusCap`, concede apenas o necessário para atingir o cap
8. **Idempotência por ciclo efetivo** — `idempotency_key` baseada no número de ciclos de 30 dias desde `stores.created_at`
9. **Launch Config para política** — 4 novas flags no módulo existente
10. **Executor Vercel Cron** — rota `GET /api/cron/monthly-credits` com proteção `CRON_SECRET`
11. **Fallback admin** — botão de execução manual no admin

---

## Estado Atual (pós-F29.2)

```
                                    ANTES (F29.2)                        DEPOIS (F29.3)
═══════════════════════════════════════════════════════════════════════════════════════════

Modelo contábil:
  Saldo                          balance único (INTEGER)                  bonus_balance + purchased_balance
                                                                           balance = soma automática via trigger
  Origem dos créditos            indistinguível após consumo              rastreável por bucket + categoria
  Categorias de transação        grant, purchase, deduction,              bonus_onboarding, bonus_monthly,
                                 refund, adjustment                        admin_grant, purchase, deduction,
                                                                           refund, adjustment
  Consumo                        FIFO implícito (saldo total)              bônus primeiro, comprado por último

Concessão mensal:
  Mecanismo                      inexistente                              Vercel Cron → RPC grant_monthly_credits()
  Elegibilidade                  inexistente                              store age >= 30 dias
  Quantidade                     inexistente                              configurável (default 5)
  Teto de bônus                  inexistente                              configurável (default 10)
  Grant parcial                  inexistente                              se bonus_balance + amount > cap, concede parcial
  Idempotência                   inexistente                              idempotency_key por ciclo efetivo

Launch Config (novas flags):
  monthlyCreditsEnabled          inexistente                              boolean, default true
  monthlyCreditsAmount           inexistente                              number, default 5
  monthlyBonusCap                inexistente                              number, default 10
  monthlyCreditsMinStoreAgeDays  inexistente                              number, default 30

Executor:
  Mecanismo                      inexistente                              Vercel Cron (diário, 06:00 UTC)
  Rota cron                      inexistente                              GET /api/cron/monthly-credits
  Proteção                       inexistente                              CRON_SECRET (Authorization header)
  Fallback admin                 inexistente                              botão de execução manual

Consumo:
  Ordem                          saldo único (FIFO implícito)              bônus primeiro, comprado por último
  reserve_credit                 decrementa balance total                   decrementa bonus_balance, depois purchased_balance

Transações:
  Categorias de grant            grant (genérico)                          bonus_onboarding, bonus_monthly,
                                                                           admin_grant, purchase
  Rastreabilidade                reason + metadata                         categoria explícita + bucket afetado
```

---

## Decisões de Arquitetura

### D1 — Buckets de saldo: bonus_balance + purchased_balance

`DECIDIDO`

`credit_balances` ganha três adições. `balance` mantido como coluna real sincronizada por trigger.

```sql
ALTER TABLE public.credit_balances
ADD COLUMN bonus_balance INTEGER NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0),
ADD COLUMN purchased_balance INTEGER NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0),
ADD COLUMN last_monthly_grant_at TIMESTAMPTZ;

CREATE INDEX idx_credit_balances_monthly_grant
  ON public.credit_balances (last_monthly_grant_at)
  WHERE last_monthly_grant_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_credit_balances_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance = NEW.bonus_balance + NEW.purchased_balance;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_credit_balances_sync_total
BEFORE INSERT OR UPDATE ON public.credit_balances
FOR EACH ROW
EXECUTE FUNCTION public.sync_credit_balances_total();
```

**Impacto:** Leituras existentes de `balance` continuam funcionando. `balance` é sempre a soma dos dois buckets. Nenhuma query existente precisa ser alterada.

**Alternativa considerada:** Saldo único com metadados de origem. Rejeitado porque a pergunta "quanto do saldo atual é bônus?" fica impossível de responder com segurança após consumo.

**Alternativa considerada:** Tabela separada `credit_buckets`. Rejeitado porque duas colunas na mesma tabela resolvem sem JOIN.

---

### D2 — Categorias de transação expandidas

`DECIDIDO`

CHECK constraint `chk_credit_transactions_type` expandido para:

```
bonus_onboarding, bonus_monthly, admin_grant, purchase, deduction, refund, adjustment
```

CHECK constraint `chk_credit_transactions_amount_sign` expandido para reconhecer `bonus_onboarding`, `bonus_monthly`, `admin_grant`, `purchase` como tipos de amount positivo.

`grant_credits()` ganha parâmetro `p_type` e é reescrita para ser bucket-aware. A migration deve explicitar o **DROP** da assinatura antiga de 5 parâmetros antes do `CREATE OR REPLACE` para evitar ambiguidade de overload:

```sql
-- Passo 1: Remover overload antigo (5 parâmetros) para evitar ambiguidade
DROP FUNCTION IF EXISTS public.grant_credits(UUID, INTEGER, TEXT, TEXT, JSONB);

-- Passo 2: Recriar com p_type (6 parâmetros)
CREATE OR REPLACE FUNCTION public.grant_credits(
  p_store_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_type TEXT DEFAULT 'admin_grant'
)
```

O novo parâmetro `p_type` (default `'admin_grant'`) preserva chamadores existentes que não passam tipo — admin grants pela UI continuam funcionando sem alteração. O onboarding (F25) e `grant_monthly_credits()` (F29.3) passam tipo explícito (`bonus_onboarding`, `bonus_monthly`).

A função direciona ao bucket correto:

| Categoria | Bucket afetado | Origem |
|-----------|---------------|--------|
| `bonus_onboarding` | `bonus_balance` | Grant inicial de 10 créditos na criação da loja |
| `bonus_monthly` | `bonus_balance` | Grant mensal automático (Vercel Cron) |
| `admin_grant` | `bonus_balance` | Grant manual via admin (entra no cap de bônus) |
| `purchase` | `purchased_balance` | Compra via gateway de pagamento (F30) |

A verificação de idempotência em `grant_credits()` é atualizada para aceitar os novos tipos (`bonus_onboarding`, `bonus_monthly`, `admin_grant`, `purchase`) como retorno válido — não apenas `grant`.

**Migração de dados (backfill via migration com trigger de blindagem temporariamente suspenso):**
- `type = 'grant' AND reason = 'onboarding'` → `bonus_onboarding`
- `type = 'grant' AND reason != 'onboarding'` → `admin_grant`
- `bonus_balance` populado com saldo atual de cada store (todo saldo existente é considerado bônus)
- `purchased_balance` = 0 para todas as stores existentes (não há compras antes de F30)

---

### D3 — Consumo: bônus primeiro, comprado por último

`DECIDIDO`

`reserve_credit()` reescrita:

```sql
amount_restante := p_amount;

deduct_from_bonus := LEAST(bonus_balance, amount_restante);
bonus_balance := bonus_balance - deduct_from_bonus;
amount_restante := amount_restante - deduct_from_bonus;

deduct_from_purchased := LEAST(purchased_balance, amount_restante);
purchased_balance := purchased_balance - deduct_from_purchased;
amount_restante := amount_restante - deduct_from_purchased;

IF amount_restante > 0 THEN
  RAISE EXCEPTION 'saldo_insuficiente';
END IF;

p_metadata := p_metadata || jsonb_build_object(
  'bonus_amount', deduct_from_bonus,
  'purchased_amount', deduct_from_purchased
);
```

**Impacto:** Assinatura da função não muda. Chamadores existentes (`generate-image`, `generate-without-logo`) continuam funcionando sem alteração.

---

### D3.1 — refund_credit() bucket-aware

`DECIDIDO`

`refund_credit()` é reescrita para restaurar os buckets exatos registrados na deduction original. Ao invés de somar o valor total ao `balance` (ou ao `bonus_balance`), ela lê `metadata.bonus_amount` e `metadata.purchased_amount` da transação original e restaura cada bucket individualmente:

```sql
-- Dentro de refund_credit():
-- 1. Ler metadata da transação original
original_bonus := COALESCE((SELECT metadata->>'bonus_amount')::INTEGER, ABS(original_amount));
original_purchased := COALESCE((SELECT metadata->>'purchased_amount')::INTEGER, 0);

-- 2. Restaurar cada bucket (amounts sempre positivos após ABS)
bonus_balance := bonus_balance + original_bonus;
purchased_balance := purchased_balance + original_purchased;
```

Para transações de `deduction` existentes (criadas antes de F29.3, sem `bonus_amount`/`purchased_amount` no metadata), o fallback trata o valor total como `bonus_amount` usando `ABS(original_amount)` — deductions antigas têm `amount` negativo, e o `ABS` garante restauração positiva. Isso é consistente com o backfill que considera todo saldo existente como bônus.

---

### D4 — Concessão mensal com teto e grant parcial

`DECIDIDO`

Função `grant_monthly_credits()`:

```
Para cada loja elegível:
  1. Ler bonus_balance (via LEFT JOIN + COALESCE para lojas sem row)
  2. Se bonus_balance >= monthlyBonusCap → pular (NÃO atualiza last_monthly_grant_at)
  3. grant = min(monthlyCreditsAmount, monthlyBonusCap - bonus_balance)
  4. Se grant <= 0 → pular
  5. Chamar grant_credits() com:
       amount = grant
       reason = 'mensal'
       type = 'bonus_monthly'
       idempotency_key = 'mensal_ciclo_' || ciclo_efetivo || '_' || store_id
       metadata = { cycle: ciclo_efetivo, grant_type: 'bonus_monthly' }
  6. Atualizar last_monthly_grant_at = NOW()
```

**Nota:** `grant_credits()` é bucket-aware (D2) — ela própria atualiza `bonus_balance` no bucket correto. `grant_monthly_credits()` não precisa nem deve somar `bonus_balance` separadamente. O trigger `sync_credit_balances_total` mantém `balance = bonus_balance + purchased_balance` automaticamente.

**Elegibilidade completa (SQL da lógica da RPC):**

A função recebe `p_min_store_age_days` (do Launch Config) e usa `make_interval` em vez de `INTERVAL '30 days'` hardcoded:

```sql
-- Parâmetros da RPC:
--   p_amount INTEGER          → monthlyCreditsAmount
--   p_bonus_cap INTEGER       → monthlyBonusCap
--   p_min_store_age_days INTEGER → monthlyCreditsMinStoreAgeDays

-- Etapa 1: Garantir que lojas elegíveis tenham row em credit_balances.
--          (Evita LEFT JOIN com FOR UPDATE no lado nullable.)
INSERT INTO public.credit_balances (store_id, balance, bonus_balance, purchased_balance)
SELECT s.id, 0, 0, 0
FROM public.stores s
LEFT JOIN public.credit_balances cb ON cb.store_id = s.id
WHERE s.created_at <= NOW() - make_interval(days => p_min_store_age_days)
  AND (cb.last_monthly_grant_at IS NULL
       OR cb.last_monthly_grant_at < NOW() - make_interval(days => p_min_store_age_days))
  AND COALESCE(cb.bonus_balance, 0) < p_bonus_cap
  AND cb.store_id IS NULL
ON CONFLICT (store_id) DO NOTHING;

-- Etapa 2: Varrer lojas elegíveis com INNER JOIN (row sempre existe após etapa 1)
--          e FOR UPDATE com SKIP LOCKED para concorrência.
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT s.id, cb.bonus_balance
    FROM public.stores s
    JOIN public.credit_balances cb ON cb.store_id = s.id
    WHERE s.created_at <= NOW() - make_interval(days => p_min_store_age_days)
      AND (cb.last_monthly_grant_at IS NULL
           OR cb.last_monthly_grant_at < NOW() - make_interval(days => p_min_store_age_days))
      AND cb.bonus_balance < p_bonus_cap
      AND cb.bonus_balance >= 0
    FOR UPDATE OF cb SKIP LOCKED
  LOOP
    -- grant = min(p_amount, p_bonus_cap - rec.bonus_balance)
    -- chamar grant_credits(...)
    -- atualizar last_monthly_grant_at
  END LOOP;
END;
```

**Regra de `last_monthly_grant_at`:** Só é atualizado quando há grant efetivo. Se a loja for pulada por teto (`bonus_balance >= monthlyBonusCap`), `last_monthly_grant_at` **não** é atualizado. Isso permite que, se o usuário consumir bônus depois, o próximo cron diário complete até o cap sem esperar mais 30 dias.

**Exemplos:**

| Cenário | bonus_balance antes | monthlyCreditsAmount | monthlyBonusCap | Grant | bonus_balance depois | last_monthly_grant_at |
|----------|---------------------|----------------------|-----------------|-------|---------------------|----------------------|
| Loja nova, 1º ciclo | 0 | 5 | 10 | 5 | 5 | Atualizado |
| 2º ciclo, não usou | 5 | 5 | 10 | 5 | 10 | Atualizado |
| 3º ciclo, não usou | 10 | 5 | 10 | 0 (teto) | 10 | **Não atualizado** |
| Usou 2, saldo 8 | 8 | 5 | 10 | 2 | 10 (parcial) | Atualizado |
| Usou tudo, saldo 0 | 0 | 5 | 10 | 5 | 5 | Atualizado |

---

### D5 — Launch Config: política de bônus mensal

`DECIDIDO`

```typescript
interface LaunchConfig {
  // Flags existentes (F28)
  v15Enabled: boolean;
  creditsChargingEnabled: boolean;
  copyDirectorEnabled: boolean;
  rateLimitEnabled: boolean;
  generationPaused: boolean;

  // Novas flags (F29.3)
  monthlyCreditsEnabled: boolean;           // VENDEO_MONTHLY_CREDITS_ENABLED (default: true)
  monthlyCreditsAmount: number;            // VENDEO_MONTHLY_CREDITS_AMOUNT (default: 5)
  monthlyBonusCap: number;                // VENDEO_MONTHLY_BONUS_CAP (default: 10)
  monthlyCreditsMinStoreAgeDays: number;  // VENDEO_MONTHLY_CREDITS_MIN_STORE_AGE_DAYS (default: 30)
}
```

---

### D6 — Executor: Vercel Cron (primário), fallback admin

`DECIDIDO`

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/monthly-credits",
    "schedule": "0 6 * * *"
  }]
}
```

Rota `GET /api/cron/monthly-credits`:
1. Valida `Authorization: Bearer CRON_SECRET` → 401 se inválido
2. Lê `getLaunchConfig()` — se `monthlyCreditsEnabled = false`, retorna `{ skipped: true }`
3. Chama `supabaseAdmin.rpc("grant_monthly_credits", { p_amount, p_bonus_cap, p_min_store_age_days })`
4. Loga resultados via `logPipelineEvent()`
5. Retorna `{ eligible, granted, skipped, errors }`

**Fallback admin:** Botão "Executar concessão mensal" no admin, protegido por `requireAdmin`, que chama a mesma RPC.

**Alternativa considerada:** pg_cron/Supabase Cron. Rejeitado porque Vercel Cron já está habilitado no projeto, encaixa no Next.js App Router, é simples de testar manualmente e evita configurar extensão pg_cron. pg_cron fica como alternativa futura.

**Alternativa considerada:** On-demand lazy (verificar no `getBalance()`). Rejeitado porque a concessão não deve depender de o usuário acessar o sistema.

---

### D7 — Idempotência por ciclo efetivo de 30 dias

`DECIDIDO`

A idempotency key usa o **ciclo efetivo** desde `stores.created_at`, não mês calendário:

```
ciclo_efetivo := FLOOR(EXTRACT(EPOCH FROM (NOW() - stores.created_at)) / (30 * 86400))
idempotency_key = 'mensal_ciclo_' || ciclo_efetivo || '_' || store_id
```

Isso evita conflito em meses com duas datas elegíveis no mesmo `YYYY_MM`. A chave reflete o número de ciclos de 30 dias desde a criação da loja, que é a regra real de produto.

**Cenários cobertos:**
- Cron roda 2x no mesmo dia → 2ª chamada retorna tx_id existente (índice único parcial em `(store_id, idempotency_key)`)
- Cron falha na metade → próxima execução só processa as não processadas (`last_monthly_grant_at` não atualizado)
- Loja com `last_monthly_grant_at` já atualizado → não é elegível até próximo ciclo (condição 3 da elegibilidade)

---

### D8 — Compra de créditos independente do bônus

`DECIDIDO`

Créditos comprados (F30) são depositados em `purchased_balance`. A concessão mensal ignora `purchased_balance` — o teto de bônus só considera `bonus_balance`. Um usuário com 50 créditos comprados e 0 bônus continua recebendo 5 créditos bônus por mês (até o cap de 10).

---

### D9 — Admin grant como bônus (entra no cap)

`DECIDIDO`

`admin_grant` incrementa `bonus_balance` e conta para o `monthlyBonusCap`. Isso evita que admin grants criem acúmulo infinito fora do teto. **Nesta fase, todo admin grant entra como bônus e conta no cap; grant administrativo fora do cap fica fora de escopo.**

---

### Nota de migração — Ordem das operações

A migration deve seguir esta ordem para evitar inconsistência:

1. **Colunas** — `ALTER TABLE credit_balances ADD COLUMN bonus_balance`, `purchased_balance`, `last_monthly_grant_at`
2. **Backfill dos buckets** — popular `bonus_balance` com saldo atual de cada store, `purchased_balance = 0`, e backfill dos tipos em `credit_transactions`
3. **Trigger de sincronização** — criar `sync_credit_balances_total` e `trg_credit_balances_sync_total` **depois** do backfill, para que o trigger não recalcule `balance = 0 + 0` durante o backfill
4. **Reescrita das funções** — `DROP` + `CREATE OR REPLACE` de `grant_credits()`, `reserve_credit()`, `refund_credit()` com lógica bucket-aware
5. **CHECK constraints** — expandir `chk_credit_transactions_type` e `chk_credit_transactions_amount_sign` para os novos tipos

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| **Saldo bônus no teto não recebe grant** — loja com 10 bônus não recebe mais até consumir | Comportamento esperado. Teto é política de produto, não bug |
| **Consumo bônus primeiro pode zerar bônus rápido** — loja que gera muito perde bônus e passa a consumir comprado | Comportamento esperado. Bônus é benefício, não direito adquirido |
| **Cron falha e lojas deixam de receber grant** | Idempotência + `last_monthly_grant_at` não atualizado em pulados por teto → próxima execução processa as pendentes. Fallback admin permite execução manual |
| **Migração de dados: transações existentes com type='grant'** | Backfill controlado via migration com trigger de blindagem temporariamente suspenso |
| **Trigger de balance total conflita com trigger de updated_at** | Ordem de execução: `sync_credit_balances_total` BEFORE INSERT OR UPDATE, depois `update_credit_balances_updated_at` BEFORE UPDATE |
| **reserve_credit reescrita quebra chamadores existentes** | Assinatura permanece idêntica. Apenas a lógica interna muda. Testes de regressão (917 existentes) cobrem os chamadores |
| **Loja sem credit_balances no grant mensal** | `grant_credits()` já cria a row via `INSERT ON CONFLICT DO NOTHING` |
| **grant_credits() com novos tipos quebra idempotência existente** | Verificação de idempotência atualizada para aceitar `bonus_onboarding`, `bonus_monthly`, `admin_grant` como retorno válido |
| **CHECK constraint de sinal não reconhece novos tipos** | `chk_credit_transactions_amount_sign` expandido para incluir os 4 novos tipos como amount positivo |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Stripe Checkout / compra de créditos | F30/v1.6 (pós-beta) |
| Notificação push/email ao receber créditos | Fase futura de comunicação |
| UI de "próximo grant em X dias" no frontend | Fase futura de UX financeira |
| Galeria de créditos / dashboard de bônus | Fase futura |
| pg_cron como executor primário | Vercel Cron já habilitado; pg_cron fica como alternativa futura |
| Múltiplas lojas (1:N) | Relação 1:1 mantida |
| Histórico de execuções do cron | Logs do pipeline-logger servem; `cron.job_run_details` não disponível sem pg_cron |

---

## Checklist de Revisão

### Decisões de alinhamento

| Decisão | Status |
|---------|--------|
| D1 — Buckets de saldo: bonus_balance + purchased_balance | `DECIDIDO` |
| D2 — Categorias de transação expandidas (grant_credits bucket-aware) | `DECIDIDO` |
| D3 — Consumo: bônus primeiro, comprado por último | `DECIDIDO` |
| D4 — Concessão mensal com teto e grant parcial | `DECIDIDO` |
| D5 — Launch Config: política de bônus mensal | `DECIDIDO` |
| D6 — Executor: Vercel Cron (primário), fallback admin | `DECIDIDO` |
| D7 — Idempotência por ciclo efetivo (30 dias desde created_at) | `DECIDIDO` |
| D8 — Compra de créditos independente do bônus | `DECIDIDO` |
| D9 — Admin grant como bônus (entra no cap) | `DECIDIDO` |

### Pendentes de decisão

| Decisão | Opções | Recomendação |
|---------|--------|-------------|
| Nome da coluna de bucket bônus | `bonus_balance` / `granted_balance` / `free_balance` | `bonus_balance` (semântica clara de benefício) |
| Tratamento de `balance` existente | Manter como coluna real com trigger vs. coluna computada | Manter real com trigger (compatibilidade máxima) |
| Migração de transações existentes | Backfill via migration com trigger suspenso | Backfill controlado: `grant` + `onboarding` → `bonus_onboarding`; `grant` + outros → `admin_grant` |

---

## Próximos Passos

1. Revisar este documento de alinhamento
2. Criar change OpenSpec `fase-29-3-creditos-mensais-automaticos` com proposal, design, specs e tasks
3. Implementar em ondas:
   - **Onda 1:** Modelo contábil (buckets, categorias, migração, reserve_credit reescrita, grant_credits bucket-aware)
   - **Onda 2:** Função `grant_monthly_credits()` + Launch Config
   - **Onda 3:** Rota Vercel Cron + fallback admin
   - **Onda 4:** Testes de ciclo, duplicidade, loja antiga, teto, consumo prioritário
