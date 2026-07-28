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
- **THEN** `logPipelineEvent()` é chamado com `event_type = 'cron.monthly_credits'`, metadata contendo `{ eligible, granted, skipped, errors }`

### Requirement: Response structure

A rota SHALL retornar JSON com `{ eligible, granted, skipped, errors }` refletindo o retorno da RPC.

#### Scenario: Successful execution returns counts

- **WHEN** `GET /api/cron/monthly-credits` executa com sucesso
- **THEN** retorna `{ eligible: number, granted: number, skipped: number, errors: number }`

#### Scenario: Raiz sem grant no ciclo → concede

- **WHEN** cron executa para store com cnpj_root_hash válido
- **AND** raiz não recebeu monthly neste ciclo
- **THEN** INSERT em freemium_entitlements vence
- **AND** 5 créditos são concedidos

#### Scenario: Raiz já recebeu no ciclo → pula

- **WHEN** cron executa para store cuja raiz já recebeu monthly neste ciclo
- **THEN** INSERT não vence (ON CONFLICT)
- **AND** nenhum crédito é concedido

#### Scenario: Loja sem CNPJ → ignorada

- **WHEN** cron executa para store com `cnpj_root_hash` vazio ou nulo
- **THEN** a store é pulada sem tentativa de INSERT

#### Scenario: Três filiais + matriz = 1 grant mensal

- **WHEN** cron executa para 4 stores da mesma raiz
- **THEN** apenas 1 store recebe grant mensal (a primeira do loop)
- **AND** as outras 3 são puladas (raiz já entitled no ciclo)

### Requirement: POST /api/admin/monthly-credits/grant

O sistema SHALL criar a rota `POST /api/admin/monthly-credits/grant` para fallback admin.

- Protegida por `requireAdmin()`
- Lê `getLaunchConfig()` — se `monthlyCreditsEnabled = false`, retorna `{ skipped: true }`
- Chama `supabaseAdmin.rpc("grant_monthly_credits", { p_amount, p_bonus_cap, p_min_store_age_days })`
- Loga via `logPipelineEvent()`
- Retorna `{ eligible, granted, skipped, errors }`

#### Scenario: Admin fallback route works

- **WHEN** admin POST `/api/admin/monthly-credits/grant`
- **THEN** executa `grant_monthly_credits` com parâmetros do Launch Config
- **AND** retorna resultado da RPC
