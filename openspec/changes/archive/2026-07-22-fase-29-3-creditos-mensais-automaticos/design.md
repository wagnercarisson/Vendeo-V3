## Context

A F24 entregou `credit_balances`, `credit_transactions` e as funções atômicas (`grant_credits`, `reserve_credit`, `refund_credit`). A F25 integrou créditos no pipeline de geração. A F26 adicionou admin operacional com grant manual. A F27 trouxe saldo visível e extrato. A F29.1 fez a assinatura visual consumir créditos.

O que ainda não existe: créditos mensais recorrentes, distinção entre bônus e compra, teto de acúmulo de bônus, política de consumo que prioriza bônus sobre compra, execução agendada (cron) para concessão recorrente, e configuração admin para política de bônus mensal.

O modelo atual de saldo único (`balance`) torna impossível responder "quanto do saldo atual é bônus?" após consumo, e impede aplicar teto de bônus corretamente.

## Goals / Non-Goals

**Goals:**
1. Modelo contábil com buckets — `bonus_balance` + `purchased_balance`, `balance` como soma automática via trigger
2. Categorias de transação expandidas — `bonus_onboarding`, `bonus_monthly`, `admin_grant`, `purchase`
3. Consumo prioritário de bônus — `reserve_credit()` desconta de `bonus_balance` primeiro
4. Concessão mensal automática — Vercel Cron diário executa RPC que concede créditos bônus a lojas elegíveis
5. Elegibilidade por idade da loja (>= 30 dias) e teto de bônus configurável (default 10)
6. Grant parcial — se `bonus_balance + amount > cap`, concede apenas o necessário
7. Idempotência por ciclo efetivo de 30 dias desde `stores.created_at`
8. Launch Config com 4 novas flags para política de bônus
9. Fallback admin para execução manual da concessão

**Non-Goals:**
- Stripe Checkout / compra de créditos (F30/v1.6)
- Notificação push/email ao receber créditos (fase futura)
- UI de "próximo grant em X dias" (fase futura)
- pg_cron como executor primário (alternativa futura)
- Múltiplas lojas por usuário (relação 1:1 mantida)
- Histórico de execuções do cron (logs do pipeline-logger servem)

## Decisions

### D1 — Buckets de saldo na mesma tabela

`credit_balances` ganha `bonus_balance INTEGER NOT NULL DEFAULT 0 CHECK (>= 0)` e `purchased_balance INTEGER NOT NULL DEFAULT 0 CHECK (>= 0)`. `balance` mantido como coluna real sincronizada por trigger BEFORE INSERT OR UPDATE. Índice parcial `idx_credit_balances_monthly_grant` em `(last_monthly_grant_at)` WHERE NOT NULL.

Trigger `sync_credit_balances_total` define `NEW.balance = NEW.bonus_balance + NEW.purchased_balance`. Leituras existentes de `balance` continuam funcionando.

Alternativa rejeitada: saldo único com metadados de origem (impossível rastrear após consumo). Alternativa rejeitada: tabela separada `credit_buckets` (dois JOINs desnecessários).

### D2 — grant_credits bucket-aware com p_type

`grant_credits()` ganha parâmetro `p_type TEXT DEFAULT 'admin_grant'` (6º parâmetro). O overload antigo de 5 parâmetros é droppado explicitamente para evitar ambiguidade.

| Categoria | Bucket | Origem |
|-----------|--------|--------|
| `bonus_onboarding` | `bonus_balance` | Grant inicial 10 créditos |
| `bonus_monthly` | `bonus_balance` | Grant mensal automático |
| `admin_grant` | `bonus_balance` | Grant manual via admin |
| `purchase` | `purchased_balance` | Compra (F30) |

Preserva chamadores existentes — `admin_grant_credits()` e admin UI continuam sem alteração (default `admin_grant`).

### D3 — reserve_credit: bônus primeiro, comprado por último

`reserve_credit()` reescrita: deduz de `bonus_balance` até exaurir, depois de `purchased_balance`. Registra `bonus_amount` e `purchased_amount` no metadata da transação de deduction. Assinatura inalterada.

### D3.1 — refund_credit bucket-aware

`refund_credit()` lê `metadata.bonus_amount` e `metadata.purchased_amount` da deduction original e restaura cada bucket individualmente. Fallback para deductions antigas (sem metadata) trata valor total como `bonus_amount` via `ABS(original.amount)`.

### D4 — grant_monthly_credits() com teto e grant parcial

RPC que recebe `p_amount`, `p_bonus_cap`, `p_min_store_age_days` do Launch Config. Etapa 1: insere `credit_balances` com zeros para lojas elegíveis sem row (LEFT JOIN anti-join). Etapa 2: varre com `FOR UPDATE SKIP LOCKED`. Grant = `min(p_amount, p_bonus_cap - bonus_balance)`. `last_monthly_grant_at` atualizado apenas se houve grant efetivo.

### D5 — Launch Config

4 novas flags: `monthlyCreditsEnabled` (boolean, default true), `monthlyCreditsAmount` (number, default 5), `monthlyBonusCap` (number, default 10), `monthlyCreditsMinStoreAgeDays` (number, default 30). Env vars prefixo `VENDEO_MONTHLY_`.

### D6 — Vercel Cron

`vercel.json`: cron `0 6 * * *` → `GET /api/cron/monthly-credits`. Proteção `Authorization: Bearer CRON_SECRET`. Lê Launch Config; se `monthlyCreditsEnabled=false`, retorna `{ skipped: true }`. Chama RPC `grant_monthly_credits`. Loga via `logPipelineEvent()`. Fallback admin: botão no admin protegido por `requireAdmin`.

Alternativa rejeitada: pg_cron (Vercel Cron já habilitado, evita extensão Supabase). Alternativa rejeitada: on-demand lazy no getBalance() (concessão não deve depender de acesso do usuário).

### D7 — Idempotência por ciclo efetivo

`idempotency_key = 'mensal_ciclo_' || FLOOR(EXTRACT(EPOCH FROM (NOW() - stores.created_at)) / (30 * 86400)) || '_' || store_id`. Baseada em ciclos de 30 dias desde criação, não mês calendário.

### D8 — Compra independente do bônus

Concessão mensal ignora `purchased_balance`. Teto de bônus só considera `bonus_balance`. Usuário com 50 créditos comprados e 0 bônus continua recebendo 5 bônus/mês até o cap.

### D9 — Admin grant como bônus (entra no cap)

`admin_grant` incrementa `bonus_balance` e conta para `monthlyBonusCap`. Grant administrativo fora do cap fica fora de escopo desta fase.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Saldo bônus no teto não recebe grant | Comportamento esperado. Teto é política de produto |
| Consumo bônus primeiro pode zerar bônus rápido | Comportamento esperado. Bônus é benefício, não direito adquirido |
| Cron falha e lojas deixam de receber grant | Idempotência + `last_monthly_grant_at` não atualizado em pulados → próxima execução processa pendentes. Fallback admin |
| Trigger de balance total conflita com trigger de updated_at | Ordem: `sync_credit_balances_total` BEFORE INSERT OR UPDATE, depois `update_credit_balances_updated_at` BEFORE UPDATE |
| reserve_credit reescrita quebra chamadores | Assinatura idêntica. Lógica interna muda apenas. Testes de regressão cobrem chamadores |
| grant_credits com novos tipos quebra idempotência existente | Verificação de idempotência atualizada para aceitar os 4 novos tipos como retorno válido |
| Loja sem credit_balances no grant mensal | Etapa 1 da RPC insere row com zeros para lojas elegíveis sem registro |

## Migration Plan

Ordem obrigatória (executar como migration única):
1. **Colunas** — `ALTER TABLE credit_balances ADD COLUMN bonus_balance`, `purchased_balance`, `last_monthly_grant_at`
2. **Desabilitar trigger imutável** — `DROP TRIGGER IF EXISTS trg_credit_transactions_immutable ON credit_transactions` para permitir UPDATE no backfill
3. **Expandir CHECK constraints** — `ALTER TABLE credit_transactions DROP CONSTRAINT chk_credit_transactions_type`, `DROP CONSTRAINT chk_credit_transactions_amount_sign`; recriar com novos tipos
4. **Backfill credit_balances** — popular `bonus_balance` com saldo atual de cada store; `purchased_balance = 0`
5. **Backfill credit_transactions** — `UPDATE type = 'bonus_onboarding' WHERE type = 'grant' AND reason = 'onboarding'`; `UPDATE type = 'admin_grant' WHERE type = 'grant' AND reason != 'onboarding'`
6. **Reabilitar trigger imutável** — recriar `trg_credit_transactions_immutable`
7. **Trigger de sincronização** — criar `sync_credit_balances_total` e `trg_credit_balances_sync_total`
8. **Funções** — `DROP` + `CREATE OR REPLACE` de `grant_credits`, `reserve_credit`, `refund_credit`

Rollback: migration reversa com `ALTER TABLE ... DROP COLUMN`, recriação das funções old signature, restore das CHECK constraints originais.

## Open Questions

Nenhuma — todas as decisões foram alinhadas e constam do documento de alinhamento aprovado.
