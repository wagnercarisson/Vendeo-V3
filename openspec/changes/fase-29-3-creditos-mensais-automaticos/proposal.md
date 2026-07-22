## Why

O Vendeo não possui créditos mensais recorrentes — o único grant automático é o onboarding (10 créditos, uma vez). Sem recorrência, lojistas que consomem os créditos iniciais ficam sem saldo e sem incentivo para continuar gerando campanhas. Esta fase implementa o ciclo de créditos mensais automáticos com distinção contábil entre bônus e compra, teto de acúmulo, consumo prioritário de bônus e execução via Vercel Cron.

## What Changes

- **Modelo contábil com buckets** — `credit_balances` ganha `bonus_balance` e `purchased_balance`; `balance` mantido como soma automática via trigger
- **Categorias de transação expandidas** — `bonus_onboarding`, `bonus_monthly`, `admin_grant`, `purchase` substituem `grant` genérico
- **Consumo prioritário de bônus** — `reserve_credit()` desconta de `bonus_balance` primeiro, `purchased_balance` por último
- **Concessão mensal automática** — Vercel Cron diário executa RPC que concede créditos bônus a lojas elegíveis
- **Elegibilidade por idade da loja** — `stores.created_at` deve ser anterior a `NOW() - monthlyCreditsMinStoreAgeDays` (default 30 dias)
- **Teto de bônus configurável** — `monthlyBonusCap` (default 10) impede acúmulo além do limite
- **Grant parcial** — se `bonus_balance + monthlyCreditsAmount > monthlyBonusCap`, concede apenas o necessário para atingir o cap
- **Idempotência por ciclo efetivo** — `idempotency_key` baseada no número de ciclos de 30 dias desde `stores.created_at`
- **Launch Config para política** — 4 novas flags no módulo existente
- **Executor Vercel Cron** — rota `GET /api/cron/monthly-credits` com proteção `CRON_SECRET`
- **Fallback admin** — botão de execução manual no admin
- **`refund_credit()` bucket-aware** — restaura `bonus_amount` e `purchased_amount` exatos deduzidos na transação original

## Capabilities

### New Capabilities

- `monthly-credits-engine`: RPC function `grant_monthly_credits()` que implementa elegibilidade por idade da loja, teto de bônus configurável, grant parcial e idempotência por ciclo efetivo de 30 dias
- `monthly-credits-cron`: Rota Vercel Cron `GET /api/cron/monthly-credits` com proteção CRON_SECRET, leitura de Launch Config, execução da RPC, logging e fallback admin

### Modified Capabilities

- `credit-tables`: Schema expandido — novas colunas `bonus_balance`, `purchased_balance`, `last_monthly_grant_at`; trigger `sync_credit_balances_total`; índice `idx_credit_balances_monthly_grant`; CHECK constraints `chk_credit_transactions_type` e `chk_credit_transactions_amount_sign` expandidas para novos tipos (`bonus_onboarding`, `bonus_monthly`, `admin_grant`, `purchase`)
- `credit-sql-functions`: Reescrita bucket-aware de `grant_credits()` (novo parâmetro `p_type`, direcionamento ao bucket correto), `reserve_credit()` (bônus primeiro, comprado por último), `refund_credit()` (restaura buckets exatos via metadata)
- `launch-config`: 4 novas flags — `monthlyCreditsEnabled`, `monthlyCreditsAmount`, `monthlyBonusCap`, `monthlyCreditsMinStoreAgeDays`
- `admin-credit-grant`: Admin grant passa a usar `p_type = 'admin_grant'`, direcionando ao `bonus_balance` e contando para o `monthlyBonusCap` (D9)

## Impact

- **Database migrations**: `credit_balances` (3 colunas, trigger, índice), `credit_transactions` (CHECK constraints), backfill de transações existentes (`grant` → `bonus_onboarding`/`admin_grant`)
- **SQL functions**: `grant_credits` (assinatura + lógica), `reserve_credit` (lógica), `refund_credit` (lógica) — assinaturas existentes preservadas via parâmetros default
- **Launch Config module**: 4 novas env vars no tipo e na função `getLaunchConfig()`
- **New cron route**: `GET /api/cron/monthly-credits` com proteção via `CRON_SECRET`
- **Admin UI**: Botão "Executar concessão mensal" na página de admin
- **No breaking changes**: Chamadores existentes de `grant_credits`, `reserve_credit`, `refund_credit` continuam funcionando sem alteração
