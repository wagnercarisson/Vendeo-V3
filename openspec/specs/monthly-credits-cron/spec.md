# Monthly Credits Cron

> Synced from `fase-29-3-creditos-mensais-automaticos` (ADDED).

## Purpose

Rota Vercel Cron `GET /api/cron/monthly-credits` com proteção CRON_SECRET, leitura de Launch Config, execução da RPC `grant_monthly_credits`, logging via `logPipelineEvent()` e fallback admin `POST /api/admin/monthly-credits/grant`.

## Requirements

### Requirement: Vercel Cron route for monthly credits

O sistema SHALL criar a rota `GET /api/cron/monthly-credits` executada pelo Vercel Cron no schedule `0 6 * * *` (06:00 UTC diário).

**MODIFICADO (F32):** O cron mensal SHALL verificar entitlement por raiz antes de conceder créditos mensais. Lojas sem `cnpj_root_hash` (vazio ou nulo) são ignoradas.
- Dentro do loop de stores elegíveis, antes de `grant_credits`: lê `stores.cnpj_root_hash`, se vazio/nulo → pula, calcula `cycle = TO_CHAR(NOW(), 'YYYY-MM')`, tenta INSERT em `freemium_entitlements`, se retornou id → concede, se ON CONFLICT → pula

#### Scenario: Cron route exists at correct path

- **WHEN** `GET /api/cron/monthly-credits` é acessado
- **THEN** a rota responde com HTTP 200 (com CRON_SECRET válido)

#### Scenario: Cron is scheduled in vercel.json

- **WHEN** `vercel.json` é analisado
- **THEN** contém cron entry com `"path": "/api/cron/monthly-credits"` e `"schedule": "0 6 * * *"`

### Requirement: CRON_SECRET authentication

A rota SHALL validar `Authorization: Bearer <CRON_SECRET>` antes de qualquer operação. O `CRON_SECRET` é lido de `process.env.CRON_SECRET`.

#### Scenario: Valid CRON_SECRET returns 200

- **WHEN** `GET /api/cron/monthly-credits` é chamado com `Authorization: Bearer <CRON_SECRET_VÁLIDO>`
- **THEN** rota prossegue com a execução
- **AND** retorna HTTP 200

#### Scenario: Missing Authorization header returns 401

- **WHEN** `GET /api/cron/monthly-credits` é chamado sem `Authorization` header
- **THEN** retorna HTTP 401

#### Scenario: Invalid CRON_SECRET returns 401

- **WHEN** `GET /api/cron/monthly-credits` é chamado com `Authorization: Bearer <TOKEN_INVÁLIDO>`
- **THEN** retorna HTTP 401

### Requirement: Launch Config check before execution

A rota SHALL ler `getLaunchConfig()` antes de executar a RPC. Se `monthlyCreditsEnabled` for `false`, a rota retorna `{ skipped: true }` sem chamar o banco.

#### Scenario: monthlyCreditsEnabled=false skips execution

- **WHEN** `GET /api/cron/monthly-credits` é chamado
- **AND** `getLaunchConfig().monthlyCreditsEnabled` é `false`
- **THEN** retorna `{ skipped: true }`
- **AND** não chama `grant_monthly_credits` RPC

### Requirement: RPC execution with Launch Config parameters

A rota SHALL chamar `supabaseAdmin.rpc("grant_monthly_credits", { p_amount, p_bonus_cap, p_min_store_age_days })` com os valores do Launch Config.

#### Scenario: RPC is called with correct parameters

- **WHEN** `GET /api/cron/monthly-credits` executa
- **AND** `monthlyCreditsEnabled = true`
- **THEN** chama `grant_monthly_credits(p_amount = monthlyCreditsAmount, p_bonus_cap = monthlyBonusCap, p_min_store_age_days = monthlyCreditsMinStoreAgeDays)`

### Requirement: Pipeline logging

A rota SHALL logar a execução via `logPipelineEvent()` com os resultados da RPC.

#### Scenario: Cron execution is logged

- **WHEN** `GET /api/cron/monthly-credits` executa a RPC
- **THEN** `logPipelineEvent()` é chamado com `event_type = 'cron.monthly_credits'`, metadata contendo `{ eligible, granted, skipped, errors }` (counters top-level do shape canônico)

### Requirement: Response structure

A rota SHALL retornar JSON com o shape canônico `{ eligible, granted, skipped, errors, details }` refletindo o retorno da RPC, onde `details = { roots_considered, skipped_no_cnpj, skipped_already_granted, skipped_not_due, skipped_bonus_threshold }`.

Semântica do shape (alinhada entre RPC, botão admin e testes):

- `eligible = granted + skipped_already_granted + skipped_bonus_threshold` (raízes que passaram dia/idade/histórico)
- `roots_considered = eligible + skipped_not_due` (cursor de raízes)
- `skipped_not_due` NÃO entra em `eligible` — fica apenas em `details.roots_considered`/`details.skipped_not_due`
- `skipped_no_cnpj` fica fora do cursor (lojas sem CNPJ, pré-contagem)

#### Scenario: Successful execution returns canonical shape

- **WHEN** `GET /api/cron/monthly-credits` executa com sucesso
- **THEN** retorna `{ eligible: number, granted: number, skipped: number, errors: number, details: { roots_considered: number, skipped_no_cnpj: number, skipped_already_granted: number, skipped_not_due: number, skipped_bonus_threshold: number } }`

#### Scenario: Raiz sem grant no ciclo → concede

- **WHEN** cron executa para raiz com `cnpj_root_hash` válido
- **AND** raiz não recebeu monthly neste ciclo (sem entitlement `(root_hash, 'monthly', cycle)`)
- **AND** `bonus_balance` do recipiente < `p_bonus_cap`
- **THEN** INSERT em freemium_entitlements vence
- **AND** o valor INTEGRAL de `monthlyCreditsAmount` é concedido ao recipiente determinístico da raiz

#### Scenario: Raiz já recebeu no ciclo → pula

- **WHEN** cron executa para raiz que já recebeu monthly neste ciclo
- **THEN** INSERT não vence (ON CONFLICT)
- **AND** nenhum crédito é concedido
- **AND** `details.skipped_already_granted` é incrementado

#### Scenario: Loja sem CNPJ → ignorada

- **WHEN** cron executa para store com `cnpj_root_hash` vazio ou nulo
- **THEN** a store é pulada sem tentativa de INSERT
- **AND** `details.skipped_no_cnpj` é incrementado (pré-contagem fora do cursor)

#### Scenario: Três filiais + matriz = 1 grant mensal (por raiz)

- **WHEN** cron executa para 4 stores da mesma raiz (3 filiais + 1 matriz)
- **THEN** apenas 1 store recebe grant mensal — o recipiente determinístico (matriz preferida; sem matriz, a loja não-teste mais antiga `created_at ASC, id ASC`)
- **AND** as outras 3 não recebem (1 grant por raiz+cycle)

#### Scenario: Limiar de bônus — abaixo do cap recebe grant integral

- **WHEN** cron executa e o recipiente tem `bonus_balance = 9` com `monthlyBonusCap = 10` e `monthlyCreditsAmount = 5`
- **THEN** concede o valor INTEGRAL de 5 (grant cheio, sem fracionamento)
- **AND** `bonus_balance` passa a 14

#### Scenario: Limiar de bônus — no cap ou acima não recebe

- **WHEN** cron executa e o recipiente tem `bonus_balance = 10` com `monthlyBonusCap = 10`
- **THEN** nenhum grant é concedido (sem entitlement criado)
- **AND** `details.skipped_bonus_threshold` é incrementado
- **AND** a raiz entra em `eligible` (passou dia/idade/histórico, falhou o limiar)

#### Scenario: Ciclo por aniversário — concede apenas no dia-do-mês do created_at

- **WHEN** cron executa fora do dia-do-mês do `created_at` do recipiente
- **THEN** a raiz não recebe grant (aguarda o dia de aniversário)
- **AND** `details.skipped_not_due` é incrementado

#### Scenario: Ciclo por aniversário — dia 29/30/31 clampa para o último dia do mês curto

- **WHEN** o dia de aniversário do recipiente é 31 e o mês corrente tem 30 dias (ex.: abril)
- **THEN** a raiz é concedida no último dia do mês (`LEAST(v_anniv_day, v_last_day)`)
- **AND** nunca rola para o dia 1 do mês seguinte

#### Scenario: Fuso explícito America/Sao_Paulo

- **WHEN** o cron executa (schedule `0 6 * * *` = 06:00 UTC = 03:00 BR)
- **THEN** todos os cálculos de dia de aniversário, ciclo e idade usam `America/Sao_Paulo` (`(NOW() AT TIME ZONE 'America/Sao_Paulo')::date`; `created_at AT TIME ZONE 'America/Sao_Paulo'`), independente do fuso da sessão do banco (Supabase = UTC)

### Requirement: POST /api/admin/monthly-credits/grant

O sistema SHALL criar a rota `POST /api/admin/monthly-credits/grant` para fallback admin.

- Protegida por `requireAdmin()`
- Lê `getLaunchConfig()` — se `monthlyCreditsEnabled = false`, retorna `{ skipped: true }`
- Chama `supabaseAdmin.rpc("grant_monthly_credits", { p_amount, p_bonus_cap, p_min_store_age_days })`
- Loga via `logPipelineEvent()`
- Retorna o shape canônico `{ eligible, granted, skipped, errors, details: { roots_considered, skipped_no_cnpj, skipped_already_granted, skipped_not_due, skipped_bonus_threshold } }`

#### Scenario: Admin fallback route works

- **WHEN** admin POST `/api/admin/monthly-credits/grant`
- **THEN** executa `grant_monthly_credits` com parâmetros do Launch Config
- **AND** retorna resultado da RPC (shape canônico com `details.roots_considered`)
