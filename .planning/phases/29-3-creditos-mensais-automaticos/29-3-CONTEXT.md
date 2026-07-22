# Phase 29.3: Créditos Mensais Automáticos — Context

**Gathered:** 2026-07-22
**Status:** Ready for planning
**Source:** OpenSpec `openspec/changes/fase-29-3-creditos-mensais-automaticos/`

<domain>
## Phase Boundary

O Vendeo não possui créditos mensais recorrentes — o único grant automático é o onboarding (10 créditos, uma vez). Sem recorrência, lojistas que consomem os créditos iniciais ficam sem saldo e sem incentivo para continuar gerando campanhas.

**Estado atual (pós-F29.1.2):**
- `credit_balances` com saldo único (`balance`) — sem distinção entre bônus e compra
- `credit_transactions` com tipo `grant` genérico — sem categorização entre onboarding, admin, monthly
- `grant_credits()` com 5 parâmetros — sem parâmetro de tipo/bucket
- `reserve_credit()` deduz de saldo único — impossível saber se deduziu bônus ou compra
- `refund_credit()` restaura saldo genérico — sem restore bucket-aware
- Admin grant direciona ao mesmo saldo que compra (quando existir)
- Launch Config com 5 flags (F28) — sem configuração de política mensal
- Nenhum mecanismo de concessão recorrente

**O que esta fase entrega:**
- Modelo contábil com buckets (`bonus_balance` + `purchased_balance`), `balance` como soma automática
- Categorias de transação expandidas (`bonus_onboarding`, `bonus_monthly`, `admin_grant`, `purchase`)
- Consumo prioritário de bônus (bônus primeiro, comprado por último)
- Concessão mensal automática via Vercel Cron diário
- Elegibilidade por idade da loja (>= 30 dias configurável)
- Teto de bônus configurável com grant parcial
- Idempotência por ciclo efetivo de 30 dias desde `stores.created_at`
- Launch Config com 4 novas flags para política de bônus
- Fallback admin para execução manual

**Dependências:** F24 (credit_balances, credit_transactions, SQL functions), F25 (pipeline, rate-limit), F26 (admin layout, admin routes), F27 (balance display — `balance` column mantido), F28 (launch config module, pipeline logger)

**Non-Goals:**
- Stripe Checkout / compra de créditos (F30/v1.6)
- Notificação push/email ao receber créditos
- UI de "próximo grant em X dias"
- pg_cron como executor primário
- Múltiplas lojas por usuário
- Histórico de execuções do cron

</domain>

<decisions>
## Implementation Decisions

### D1 — Buckets de saldo na mesma tabela

`DECIDIDO`

`credit_balances` ganha `bonus_balance INTEGER NOT NULL DEFAULT 0 CHECK (>= 0)` e `purchased_balance INTEGER NOT NULL DEFAULT 0 CHECK (>= 0)`. `balance` mantido como coluna real sincronizada por trigger BEFORE INSERT OR UPDATE.

Trigger `sync_credit_balances_total` define `NEW.balance = NEW.bonus_balance + NEW.purchased_balance`. Leituras existentes de `balance` continuam funcionando.

**Alternativa rejeitada:** Saldo único com metadados de origem (impossível rastrear após consumo).
**Alternativa rejeitada:** Tabela separada `credit_buckets` (dois JOINs desnecessários).

### D2 — grant_credits bucket-aware com p_type

`DECIDIDO`

`grant_credits()` ganha parâmetro `p_type TEXT DEFAULT 'admin_grant'` (6º parâmetro). Overload antigo de 5 parâmetros droppado explicitamente.

| Categoria | Bucket | Origem |
|-----------|--------|--------|
| `bonus_onboarding` | `bonus_balance` | Grant inicial 10 créditos |
| `bonus_monthly` | `bonus_balance` | Grant mensal automático |
| `admin_grant` | `bonus_balance` | Grant manual via admin |
| `purchase` | `purchased_balance` | Compra (F30) |

Preserva chamadores existentes — `admin_grant_credits()` e admin UI continuam sem alteração.

### D3 — reserve_credit: bônus primeiro, comprado por último

`DECIDIDO`

`reserve_credit()` reescrita: deduz de `bonus_balance` até exaurir, depois de `purchased_balance`. Registra `bonus_amount` e `purchased_amount` no metadata da transação de deduction. Assinatura inalterada.

### D3.1 — refund_credit bucket-aware

`DECIDIDO`

`refund_credit()` lê `metadata.bonus_amount` e `metadata.purchased_amount` da deduction original e restaura cada bucket individualmente. Fallback para deductions antigas (sem metadata) trata valor total como `bonus_amount` via `ABS(original.amount)`.

### D4 — grant_monthly_credits() com teto e grant parcial

`DECIDIDO`

RPC que recebe `p_amount`, `p_bonus_cap`, `p_min_store_age_days` do Launch Config:
- Etapa 1: Insere `credit_balances` com zeros para lojas elegíveis sem row (LEFT JOIN anti-join)
- Etapa 2: Varre com `FOR UPDATE SKIP LOCKED`
- Grant = `min(p_amount, p_bonus_cap - bonus_balance)`
- `last_monthly_grant_at` atualizado apenas se houve grant efetivo

### D5 — Launch Config

`DECIDIDO`

4 novas flags: `monthlyCreditsEnabled` (boolean, default true), `monthlyCreditsAmount` (number, default 5), `monthlyBonusCap` (number, default 10), `monthlyCreditsMinStoreAgeDays` (number, default 30). Env vars prefixo `VENDEO_MONTHLY_`.

### D6 — Vercel Cron

`DECIDIDO`

`vercel.json`: cron `0 6 * * *` → `GET /api/cron/monthly-credits`. Proteção `Authorization: Bearer CRON_SECRET`. Lê Launch Config; se `monthlyCreditsEnabled=false`, retorna `{ skipped: true }`. Chama RPC `grant_monthly_credits`. Loga via `logPipelineEvent()`.

**Alternativa rejeitada:** pg_cron (Vercel Cron já habilitado, evita extensão Supabase).
**Alternativa rejeitada:** On-demand lazy no getBalance() (concessão não deve depender de acesso do usuário).

### D7 — Idempotência por ciclo efetivo

`DECIDIDO`

`idempotency_key = 'mensal_ciclo_' || FLOOR(EXTRACT(EPOCH FROM (NOW() - stores.created_at)) / (30 * 86400)) || '_' || store_id`. Baseada em ciclos de 30 dias desde criação, não mês calendário.

### D8 — Compra independente do bônus

`DECIDIDO`

Concessão mensal ignora `purchased_balance`. Teto de bônus só considera `bonus_balance`. Usuário com 50 créditos comprados e 0 bônus continua recebendo 5 bônus/mês até o cap.

### D9 — Admin grant como bônus (entra no cap)

`DECIDIDO`

`admin_grant` incrementa `bonus_balance` e conta para `monthlyBonusCap`. Grant administrativo fora do cap fica fora de escopo.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema e Migrations
- `src/lib/credit-schema.ts` — CreditService types existentes (Zod + TypeScript)
- `supabase/migrations/` — Migrações existentes de F24 (credit_balances, credit_transactions, funções SQL)
- `openspec/changes/fase-29-3-creditos-mensais-automaticos/specs/credit-tables/spec.md` — Schema expandido com buckets, triggers, constraints, backfill
- `openspec/changes/fase-29-3-creditos-mensais-automaticos/specs/credit-sql-functions/spec.md` — grant_credits, reserve_credit, refund_credit reescritos

### Monthly Credits Engine
- `openspec/changes/fase-29-3-creditos-mensais-automaticos/specs/monthly-credits-engine/spec.md` — grant_monthly_credits RPC com elegibilidade, teto, grant parcial, idempotência, SKIP LOCKED

### Launch Config
- `src/lib/launch-config/config.ts` — Módulo Launch Config existente (F28)
- `openspec/changes/fase-29-3-creditos-mensais-automaticos/specs/launch-config/spec.md` — 4 novas flags mensais

### Cron e Admin
- `src/lib/pipeline-logger.ts` — logPipelineEvent() existente (F28)
- `openspec/changes/fase-29-3-creditos-mensais-automaticos/specs/monthly-credits-cron/spec.md` — Vercel Cron route + admin fallback
- `openspec/changes/fase-29-3-creditos-mensais-automaticos/specs/admin-credit-grant/spec.md` — Admin grant direcionado a bonus_balance

### Admin existente
- `src/app/admin/credits/` — Páginas admin de créditos (F26)
- `src/app/api/admin/credits/` — Rotas admin de créditos (F26)
- `src/lib/admin/gate.ts` — requireAdmin gate (F26)

### Design Geral
- `openspec/changes/fase-29-3-creditos-mensais-automaticos/design.md` — Decisões de design D1-D9, riscos, migration plan

</canonical_refs>

<specifics>
## Specific Ideas

### Migration Plan (Ordem Obrigatória)

1. Colunas — `ALTER TABLE credit_balances ADD COLUMN bonus_balance`, `purchased_balance`, `last_monthly_grant_at`
2. Desabilitar trigger imutável — `DROP TRIGGER trg_credit_transactions_immutable`
3. Expandir CHECK constraints — recriar com novos tipos
4. Backfill credit_balances — `bonus_balance` = saldo atual, `purchased_balance = 0`
5. Backfill credit_transactions — `grant + onboarding` → `bonus_onboarding`; `grant + outros` → `admin_grant`
6. Reabilitar trigger imutável
7. Trigger de sincronização — `sync_credit_balances_total`
8. Funções — DROP + CREATE OR REPLACE de grant_credits, reserve_credit, refund_credit

### grant_credits Signature Final

```sql
grant_credits(
  p_store_id UUID,
  p_amount INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_type TEXT DEFAULT 'admin_grant'
) RETURNS UUID
```

### reserve_credit Logic

```
amount_restante := p_amount;
deduct_from_bonus := LEAST(bonus_balance, amount_restante);
bonus_balance := bonus_balance - deduct_from_bonus;
amount_restante := amount_restante - deduct_from_bonus;
deduct_from_purchased := LEAST(purchased_balance, amount_restante);
purchased_balance := purchased_balance - deduct_from_purchased;
amount_restante := amount_restante - deduct_from_purchased;
IF amount_restante > 0 THEN RAISE EXCEPTION 'saldo_insuficiente'; END IF;
p_metadata := p_metadata || jsonb_build_object('bonus_amount', deduct_from_bonus, 'purchased_amount', deduct_from_purchased);
```

### grant_monthly_credits Retorno

```json
{ "eligible": number, "granted": number, "skipped": number, "errors": number }
```

</specifics>

<deferred>
## Deferred Ideas

- Stripe Checkout / compra de créditos (F30/v1.6)
- Notificação push/email ao receber créditos
- UI de "próximo grant em X dias"
- pg_cron como executor primário (Vercel Cron é suficiente)
- Múltiplas lojas por usuário (1:1 mantida)
- Histórico de execuções do cron (logs do pipeline-logger servem)

</deferred>

<risks>
## Risk Summary

| Risco | Mitigação |
|-------|-----------|
| Saldo bônus no teto não recebe grant | Comportamento esperado. Teto é política de produto |
| Consumo bônus primeiro pode zerar bônus rápido | Comportamento esperado. Bônus é benefício, não direito adquirido |
| Cron falha e lojas deixam de receber grant | Idempotência + last_monthly_grant_at não atualizado em pulados → próxima execução processa pendentes. Fallback admin |
| Trigger de balance total conflita com trigger de updated_at | Ordem: sync_credit_balances_total BEFORE INSERT OR UPDATE, depois update_credit_balances_updated_at BEFORE UPDATE |
| reserve_credit reescrita quebra chamadores | Assinatura idêntica. Lógica interna muda apenas |
| grant_credits com novos tipos quebra idempotência existente | Verificação de idempotência atualizada para aceitar os 4 novos tipos como retorno válido |
| Loja sem credit_balances no grant mensal | Etapa 1 da RPC insere row com zeros para lojas elegíveis sem registro |

</risks>

---

*Phase: 29-3-creditos-mensais-automaticos*
*Context gathered: 2026-07-22 via OpenSpec*
