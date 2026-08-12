# Economic Parameters

> Synced from `fase-38-2-admin-custos-operacionais` (ADDED) + `fase-38-2-1-economic-snapshot` (MODIFIED).

## Purpose

Parâmetros econômicos de operação (`usd_brl_rate`, `credit_value_brl`) com tabela + audit append-only + RLS service_role, RPC transacional idempotente, service fail-open/fail-closed, API admin (GET/PUT) e seção "Parâmetros Econômicos" na página `/admin/operation-costs`. A partir da F38.2.1, os valores correntes valem para **novas gerações** — o histórico usa o snapshot `*_at_generation` em `generation_events` (spec `economic-snapshot`), com fallback explícito para eventos sem snapshot.

## Requirements

### Requirement: Chaves dos parâmetros econômicos (enum TS versionado)

O sistema SHALL definir em `src/lib/economic/types.ts` (sem server-only) as chaves versionadas dos parâmetros econômicos:

```typescript
export const ECONOMIC_PARAMETER_KEYS = ["usd_brl_rate", "credit_value_brl"] as const;
export type EconomicParameterKey = (typeof ECONOMIC_PARAMETER_KEYS)[number];

export interface EconomicParameterResolution {
  key: EconomicParameterKey;
  value: number;
  source: "table" | "fallback";   // linha inexistente → default 1.00 (fail-open)
}
```

- As chaves SHALL ser o contrato entre banco, service, API (zod) e UI — nunca strings soltas
- **Sem import server-only** — o arquivo é consumido também por schema zod e componentes

#### Scenario: ECONOMIC_PARAMETER_KEYS contém as duas chaves

- **WHEN** `ECONOMIC_PARAMETER_KEYS` é importado
- **THEN** contém `["usd_brl_rate", "credit_value_brl"]`

#### Scenario: Key fora do enum rejeitado no TS

- **WHEN** um valor fora de `ECONOMIC_PARAMETER_KEYS` é usado como `EconomicParameterKey`
- **THEN** o TypeScript rejeita em compile time

### Requirement: Tabela economic_parameters + audit + RLS

O sistema SHALL criar via migration `economic_parameters` (1 linha por chave) e `economic_parameter_audit` (append-only), padrão F38 (RLS service_role, sem GRANT para `authenticated`):

```sql
economic_parameters
  key           TEXT PRIMARY KEY        -- 'usd_brl_rate' | 'credit_value_brl'
  value         NUMERIC NOT NULL CHECK (value > 0)
  updated_by    UUID REFERENCES auth.users(id)          -- NULL p/ seeds de sistema
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()

economic_parameter_audit
  id              UUID PK default gen_random_uuid()
  key             TEXT NOT NULL
  old_value       NUMERIC
  new_value       NUMERIC
  actor_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  reason          TEXT NOT NULL
  operation_id    UUID
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  ▸ idempotência: UNIQUE (operation_id) WHERE operation_id IS NOT NULL
  ▸ trigger imutável bloqueia UPDATE/DELETE
```

- **Seeds idempotentes** `('usd_brl_rate', 1.00)` e `('credit_value_brl', 1.00)` com `ON CONFLICT (key) DO NOTHING`; `updated_by` NULL (sistema)
- `value > 0` via CHECK; `reason` obrigatório na audit; audit **append-only** (trigger imutável bloqueia UPDATE/DELETE); idempotência por `operation_id` (UNIQUE parcial)
- **RLS:** acesso apenas service_role; `authenticated` não lê/escreve (parâmetro é dado interno de operação)

#### Scenario: Migration cria tabelas com schema correto

- **WHEN** as migrations são listadas
- **THEN** existe migration `*_f38_2_economic_parameters.sql`
- **AND** o arquivo contém `CREATE TABLE` de `economic_parameters` e `economic_parameter_audit` com as colunas e CHECKs acima

#### Scenario: Seeds presentes e idempotentes

- **WHEN** a migration é aplicada
- **THEN** existem linhas `('usd_brl_rate', 1.00)` e `('credit_value_brl', 1.00)`
- **AND** reaplicar a migration não duplica (ON CONFLICT DO NOTHING)

#### Scenario: CHECK rejeita value <= 0

- **WHEN** uma linha é inserida com `value = 0` ou negativo
- **THEN** o INSERT falha com violação de CHECK

#### Scenario: authenticated não acessa economic_parameters

- **WHEN** um usuário `authenticated` tenta `SELECT` em `economic_parameters`
- **THEN** a operação falha (sem GRANT para `authenticated`; RLS service_role) — nenhuma linha é retornada nem acessível pelo role `authenticated`

#### Scenario: audit bloqueia UPDATE/DELETE

- **WHEN** uma linha de `economic_parameter_audit` é alvo de UPDATE ou DELETE
- **THEN** o trigger imutável bloqueia a operação

#### Scenario: audit rejeita linha sem reason

- **WHEN** uma linha é inserida em `economic_parameter_audit` com `reason` NULL/vazio
- **THEN** o INSERT falha (reason obrigatório)

### Requirement: RPC admin_set_economic_parameter (transacional)

O sistema SHALL criar o RPC `admin_set_economic_parameter` (SECURITY DEFINER, `SET search_path=''`, padrão admin do repositório — D2):

```
admin_set_economic_parameter(
  p_actor_id UUID, p_key TEXT, p_value NUMERIC, p_reason TEXT, p_operation_id UUID DEFAULT NULL
) RETURNS JSONB { key, value, audit_id, updated_at, idempotent }
```

- **Transacional:** captura old, UPDATE, INSERT na audit na mesma transação; falha → rollback
- `reason` obrigatório; `value > 0`; `key` validado no zod da rota (enum TS)
- **Idempotência:** mesmo `operation_id` em retry → retorna `{ idempotent: true }` com dados da primeira operação, sem novo UPDATE nem nova linha de audit
- `p_operation_id` DEFAULT NULL (sem idempotência quando ausente)
- Nenhuma mutação direta via query builder — sempre RPC (padrão financeiro)

#### Scenario: RPC atualiza e registra audit

- **WHEN** `admin_set_economic_parameter` é chamado com `p_key='usd_brl_rate'`, `p_value=5.20`, `p_reason='Calibragem beta'`
- **THEN** `economic_parameters` passa a conter `('usd_brl_rate', 5.20)`
- **AND** `economic_parameter_audit` ganha linha com `old_value=1.00`, `new_value=5.20`, `actor_id` e `reason`
- **AND** o retorno contém `{ key, value, audit_id, updated_at, idempotent: false }`

#### Scenario: RPC idempotente em retry

- **WHEN** o mesmo PUT é repetido com o mesmo `p_operation_id`
- **THEN** retorna `{ idempotent: true }` com dados da primeira operação
- **AND** não há novo UPDATE nem nova linha de audit

#### Scenario: RPC rejeita sem reason

- **WHEN** `admin_set_economic_parameter` é chamado com `p_reason` vazio/NULL
- **THEN** o RPC falha (reason obrigatório)

#### Scenario: RPC rejeita value <= 0

- **WHEN** `p_value` é 0 ou negativo
- **THEN** o RPC falha (CHECK value > 0)

#### Scenario: RPC falha em erro → rollback

- **WHEN** o INSERT na audit falha após o UPDATE
- **THEN** o UPDATE é revertido (transação única)

### Requirement: EconomicParameterService (fail-open / fail-closed)

O sistema SHALL manter a classe `EconomicParameterService` em `src/lib/economic/economic-parameter-service.ts` (server-only, padrão `OperationCostService` F38) com a semântica atual, documentando o papel dos valores correntes:

```typescript
import "server-only";

export class EconomicParameterUnavailableError extends Error { /* fail-closed */ }

export class EconomicParameterService {
  constructor(client?: SupabaseClient);   // default supabaseAdmin
  async getParameter(key: EconomicParameterKey): Promise<EconomicParameterResolution>;
  async getAll(): Promise<EconomicParameterResolution[]>;
}
```

- **`getParameter(key)`** → linha existente → `{ key, value, source: 'table' }`; linha inexistente → default seguro **1.00** com `source: 'fallback'` (fail-open, log aviso); **erro real de leitura** → lança `EconomicParameterUnavailableError` (fail-closed)
- **`getAll()`** → mescla tabela + fallback para as duas chaves, expondo `source` para o admin
- **Semântica de uso (F38.2.1):** o valor corrente retornado por `getParameter`/`getAll` é o valor **vigente para novas gerações** — a F38.2.1 passa a usar o snapshot `*_at_generation` em `generation_events` para o histórico; o valor corrente serve como **fallback explícito** para eventos sem snapshot
- Sem alteração de assinatura: os snapshots são resolvidos pelos callers (início do run) e persistidos no tracker

#### Scenario: linha existente → source table

- **WHEN** `getParameter('usd_brl_rate')` e a linha existe com valor 5.20
- **THEN** retorna `{ key: 'usd_brl_rate', value: 5.20, source: 'table' }`

#### Scenario: linha inexistente → fallback 1.00

- **WHEN** `getParameter('credit_value_brl')` e a linha não existe
- **THEN** retorna `{ key: 'credit_value_brl', value: 1.00, source: 'fallback' }` (fail-open, log aviso)

#### Scenario: erro real de leitura → fail-closed

- **WHEN** a leitura em `economic_parameters` falha (ex.: RPC error)
- **THEN** `getParameter` lança `EconomicParameterUnavailableError`

#### Scenario: getAll mescla tabela + fallback

- **WHEN** `getAll()` é chamado com uma linha na tabela e outra ausente
- **THEN** retorna as duas chaves, uma com `source: 'table'` e a outra com `source: 'fallback'`

### Requirement: GET /api/admin/economic-parameters

O sistema SHALL expor `GET /api/admin/economic-parameters` sob `requireAdmin` (D2):

```
GET /api/admin/economic-parameters     (admin)
  → 200 { parameters: [ { key, value, source } ] }
  → 403 não-admin
  → 503 (fail-closed — EconomicParameterUnavailableError)
```

- Lista resolvida com `source` (`table`/`fallback`) via `EconomicParameterService.getAll()`
- **Sem endpoint público** — parâmetros são dado interno de operação

#### Scenario: GET lista parâmetros resolvidos

- **WHEN** um admin chama `GET /api/admin/economic-parameters`
- **THEN** retorna `200` com `parameters` contendo `usd_brl_rate` e `credit_value_brl`, cada um com `value` e `source`

#### Scenario: GET sem admin retorna 403

- **WHEN** um usuário não-admin chama `GET /api/admin/economic-parameters`
- **THEN** retorna `403`

#### Scenario: GET com falha de leitura retorna 503

- **WHEN** o service lança `EconomicParameterUnavailableError`
- **THEN** retorna `503`

### Requirement: PUT /api/admin/economic-parameters

O sistema SHALL expor `PUT /api/admin/economic-parameters` sob `requireAdmin` + zod + RPC (D2):

```
PUT /api/admin/economic-parameters      (admin)
  body: { key, value, reason, operationId? }
  → 200 { key, value, audit_id, updated_at, idempotent }
  → 400 zod (key inválido, value <= 0, reason vazio)
  → 403 não-admin
  → 500 erro do RPC
```

- **`key`** validado contra `ECONOMIC_PARAMETER_KEYS` (enum TS); **`value`** > 0; **`reason`** obrigatório
- `operationId` opcional para idempotência (retry seguro)
- Nenhuma mutação direta via query builder — sempre RPC

#### Scenario: PUT atualiza via RPC

- **WHEN** um admin faz `PUT /api/admin/economic-parameters` com `{ key: "usd_brl_rate", value: 5.20, reason: "Calibragem beta", operationId }`
- **THEN** o RPC `admin_set_economic_parameter` é chamado
- **AND** retorna `200` com `{ key, value, audit_id, updated_at, idempotent: false }`

#### Scenario: PUT sem reason retorna 400

- **WHEN** `PUT` é chamado com body sem `reason` (ou vazio)
- **THEN** retorna `400` (zod)

#### Scenario: PUT com key inválido retorna 400

- **WHEN** `PUT` é chamado com `key: "foo"` fora do enum
- **THEN** retorna `400` (zod enum)

#### Scenario: PUT com value <= 0 retorna 400

- **WHEN** `PUT` é chamado com `value: 0` ou negativo
- **THEN** retorna `400` (zod)

#### Scenario: PUT sem admin retorna 403

- **WHEN** um usuário não-admin chama `PUT`
- **THEN** retorna `403`

#### Scenario: PUT com erro do RPC retorna 500

- **WHEN** o RPC `admin_set_economic_parameter` falha
- **THEN** retorna `500`

### Requirement: Página /admin/operation-costs — "Configurações Econômicas" + seção de Parâmetros

O sistema SHALL manter a rota `/admin/operation-costs` (não quebra bookmarks/testes/navegação — D2) com **título visual "Configurações Econômicas"** e conter:

1. **Créditos debitados por tipo de entrega** — tabela `credit_operation_costs` existente (F38), inalterada em schema
2. **Seção "Parâmetros Econômicos"** — inputs para `usd_brl_rate` ("Taxa de conversão USD→BRL") e `credit_value_brl` ("Valor operacional do crédito em BRL"), cada um com **motivo obrigatório**, badge `source` (`tabela`/`fallback`), e feedback com `audit_id` após salvar via `PUT /api/admin/economic-parameters`
3. **Aviso de semântica (F38.2.1):** a página SHALL exibir um aviso de que **as alterações valem para novas gerações e não recalculam o histórico** (os runs existentes usam o snapshot gravado na geração)

#### Scenario: Título visual "Configurações Econômicas" mantendo rota

- **WHEN** um admin acessa `/admin/operation-costs`
- **THEN** a página renderiza com o título "Configurações Econômicas"
- **AND** a rota continua `/admin/operation-costs` (não há redirect para outro path)

#### Scenario: Seção de parâmetros renderiza com badge source

- **WHEN** a página é renderizada
- **THEN** exibe a seção "Parâmetros Econômicos" com `usd_brl_rate` e `credit_value_brl`, cada um com badge `source` (`tabela` ou `fallback`)

#### Scenario: Página avisa que alteração vale para novas gerações

- **WHEN** a seção de parâmetros é exibida
- **THEN** há um aviso de que alterar `usd_brl_rate`/`credit_value_brl` vale para novas gerações e não recalcula o histórico exibido

#### Scenario: Editar parâmetro exige motivo

- **WHEN** um admin altera `usd_brl_rate` (ou `credit_value_brl`) e clica em salvar sem preencher o motivo
- **THEN** a página bloqueia o save e pede o motivo

#### Scenario: Salvar parâmetro chama PUT e mostra audit_id

- **WHEN** um admin altera `usd_brl_rate` com motivo válido e salva
- **THEN** a página chama `PUT /api/admin/economic-parameters`
- **AND** exibe feedback com o `audit_id` retornado
