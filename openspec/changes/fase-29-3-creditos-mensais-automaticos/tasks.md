## 1. Onda 1 — Modelo Contábil (Buckets + Categorias + Migração)

- [ ] 1.1 Criar migration SQL: `ALTER TABLE credit_balances ADD COLUMN bonus_balance INTEGER NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0)`, `purchased_balance INTEGER NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0)`, `last_monthly_grant_at TIMESTAMPTZ`
- [ ] 1.2 Criar migration: desabilitar trigger `trg_credit_transactions_immutable` em `credit_transactions` (DROP) antes do backfill
- [ ] 1.3 Criar migration: expandir CHECK constraints — DROP `chk_credit_transactions_type` e `chk_credit_transactions_amount_sign`, recriar com novos tipos
- [ ] 1.4 Criar migration: backfill `credit_balances.bonus_balance` com saldo atual de cada store, `purchased_balance = 0` para todas
- [ ] 1.5 Criar migration: backfill `credit_transactions.type` — `grant + onboarding` → `bonus_onboarding`; `grant + outros` → `admin_grant`
- [ ] 1.6 Criar migration: reabilitar trigger `trg_credit_transactions_immutable` em `credit_transactions`
- [ ] 1.7 Criar migration: trigger `sync_credit_balances_total` (BEFORE INSERT OR UPDATE) e `trg_credit_balances_sync_total`
- [ ] 1.8 Criar migration: índice parcial `idx_credit_balances_monthly_grant` em `(last_monthly_grant_at)` WHERE NOT NULL
- [ ] 1.9 Criar migration: DROP do overload antigo `grant_credits(UUID, INTEGER, TEXT, TEXT, JSONB)` e CREATE OR REPLACE com `p_type TEXT DEFAULT 'admin_grant'`
- [ ] 1.10 Criar migration: reescrever `reserve_credit()` com lógica bucket-aware (bônus primeiro, comprado por último, metadata com bonus_amount/purchased_amount)
- [ ] 1.11 Criar migration: reescrever `refund_credit()` bucket-aware (restaura buckets exatos do metadata, fallback legacy)
- [ ] 1.12 Executar migrations em ambiente de desenvolvimento e verificar consistência dos dados

## 2. Onda 2 — Função grant_monthly_credits + Launch Config

- [ ] 2.1 Criar migration: RPC `grant_monthly_credits(p_amount, p_bonus_cap, p_min_store_age_days)` com elegibilidade, teto, grant parcial, idempotência por ciclo efetivo, FOR UPDATE SKIP LOCKED
- [ ] 2.2 Atualizar tipo `LaunchConfig` em `src/lib/launch-config/config.ts` com 4 novas flags: `monthlyCreditsEnabled`, `monthlyCreditsAmount`, `monthlyBonusCap`, `monthlyCreditsMinStoreAgeDays`
- [ ] 2.3 Atualizar função `getLaunchConfig()` para ler as 4 novas environment variables com defaults
- [ ] 2.4 Adicionar env vars ao `.env.example` e documentar defaults

## 3. Onda 3 — Vercel Cron + Fallback Admin

- [ ] 3.1 Criar rota `GET /api/cron/monthly-credits` com validação `Authorization: Bearer CRON_SECRET`, leitura de Launch Config, execução da RPC e logging via `logPipelineEvent()`
- [ ] 3.2 Adicionar cron entry em `vercel.json`: `{ "path": "/api/cron/monthly-credits", "schedule": "0 6 * * *" }`
- [ ] 3.3 Criar rota `POST /api/admin/monthly-credits/grant` protegida por `requireAdmin` para fallback manual
- [ ] 3.4 Adicionar botão "Executar concessão mensal" na página de admin com estado de loading e exibição de resultado

## 4. Onda 4 — Testes e Verificação

- [ ] 4.1 Teste de ciclo completo: loja velha (>30 dias) sem grant → recebe monthlyCreditsAmount corretamente
- [ ] 4.2 Teste de teto: loja com bonus_balance = monthlyBonusCap → não recebe grant, last_monthly_grant_at não atualizado
- [ ] 4.3 Teste de grant parcial: loja a 2 créditos do cap → recebe apenas 2 créditos
- [ ] 4.4 Teste de duplicidade: mesma execução duas vezes → idempotência impede duplicação
- [ ] 4.5 Teste de concorrência: execução simultânea → SKIP LOCKED previne race condition
- [ ] 4.6 Teste de consumo prioritário: reserve_credit com bônus + compra → deduz bônus primeiro
- [ ] 4.7 Teste de refund bucket-aware: reembolso de deduction com metadata → restaura buckets exatos
- [ ] 4.8 Teste de refund legacy: reembolso de deduction antiga sem metadata → fallback para bonus_balance
- [ ] 4.9 Teste de CRON_SECRET: requisição sem token → 401; com token inválido → 401; com token válido → 200
- [ ] 4.10 Teste de Launch Config: monthlyCreditsEnabled=false → cron retorna skipped e não executa RPC
- [ ] 4.11 Teste de migração reversa: rollback da migration restaura estado anterior
- [ ] 4.12 Verificar TypeScript: `npm run typecheck` sem erros
- [ ] 4.13 Verificar lint: `npm run lint` sem erros
