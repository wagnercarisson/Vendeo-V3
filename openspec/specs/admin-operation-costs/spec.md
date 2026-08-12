# Admin Operation Costs

> Synced from `fase-38-credit-operation-costs` (ADDED) + `fase-38-2-admin-custos-operacionais` (MODIFIED).

## Purpose

Gestão admin de custo/habilitação por operação (D9/D10): `GET`/`PUT /api/admin/operation-costs` (requireAdmin + zod + RPC `admin_update_operation_cost`) e página `/admin/operation-costs` com tabela de operações, edição de custo com motivo obrigatório, toggle de habilitação, badge `source` e feedback de `audit_id` — sem mutação direta via query builder (padrão financeiro do repositório).

## Requirements

### Requirement: GET /api/admin/operation-costs (lista)

O sistema SHALL expor `GET /api/admin/operation-costs` sob `requireAdmin` (D9), seguindo o padrão existente (`requireAdmin` + zod + RPC + apiHandler — ex.: `src/app/api/admin/credits/grant/route.ts`):

```
GET /api/admin/operation-costs        (admin)
  → 200 { operations: [ { operationKey, costCredits, enabled, updatedBy, updatedAt, source } ] }
    -- lista todas as chaves conhecidas (enum TS), mesclando tabela + fallback
    -- source indica se veio da tabela ou do fallback (visibilidade p/ o admin)
```

- `updated_by`/`updated_at` vêm da tabela (RPC/seed); `source` = `table` quando a linha existe, `fallback` quando não
- **Erro real de leitura** → `503 operation_cost_unavailable` (fail-closed, D5)

#### Scenario: Lista todas as chaves conhecidas com source

- **WHEN** um admin chama `GET /api/admin/operation-costs`
- **THEN** retorna `200` com `operations` contendo `campaign_generation` e `visual_signature_generation`, cada uma com `operationKey`, `costCredits`, `enabled`, `updatedBy`, `updatedAt` e `source` (`table` ou `fallback`)

#### Scenario: Sem admin retorna 403

- **WHEN** um usuário não-admin chama `GET /api/admin/operation-costs`
- **THEN** retorna `403`

#### Scenario: Erro real de leitura retorna 503

- **WHEN** o service lança `OperationCostUnavailableError`
- **THEN** retorna `503 operation_cost_unavailable`

### Requirement: PUT /api/admin/operation-costs (update)

O sistema SHALL expor `PUT /api/admin/operation-costs` sob `requireAdmin` (D9), com validação zod e RPC `admin_update_operation_cost`:

```
PUT /api/admin/operation-costs        (admin)
  body: { operationKey, costCredits?, enabled?, reason, operationId? }
        -- exatamente UM de costCredits OU enabled (XOR, nunca ambos — D8)
  → 200 { operation_key, cost_credits, enabled, audit_id, updated_at, idempotent }
  → 400 zod (operation_key inválido, cost_credits <= 0, reason vazio, costCredits E enabled juntos)
  → 403 não-admin
  → 500 erro do RPC
```

- Nenhuma mutação direta via query builder — sempre RPC (padrão financeiro do repositório)
- `operationKey` validado contra `OPERATION_KEYS` (D7); `costCredits` > 0 (D3); `reason` obrigatório (D8); `.refine` exige **exatamente um** de `costCredits` OU `enabled` (XOR — a audit registra uma ação por linha)
- O `operationId` fornece idempotência (retry seguro)

#### Scenario: PUT atualiza custo e retorna audit_id

- **WHEN** um admin faz `PUT /api/admin/operation-costs` com `{ operationKey: "campaign_generation", costCredits: 2, reason: "Calibragem", operationId }`
- **THEN** retorna `200` com `{ operation_key, cost_credits: 2, enabled, audit_id, updated_at, idempotent: false }`

#### Scenario: PUT toggle de habilitação

- **WHEN** um admin faz `PUT /api/admin/operation-costs` com `{ operationKey: "visual_signature_generation", enabled: false, reason: "..." }`
- **THEN** retorna `200` com `enabled: false` e `audit_id`

#### Scenario: PUT idempotente em retry

- **WHEN** um admin repete o mesmo PUT com o mesmo `operationId`
- **THEN** retorna `200` com `idempotent: true` (dados da primeira operação, sem novo UPDATE)

#### Scenario: PUT com operationKey inválido retorna 400

- **WHEN** um admin faz `PUT` com `operationKey` fora do enum (ex.: `"foo"`)
- **THEN** retorna `400` (validação zod enum)

#### Scenario: PUT com costCredits zero retorna 400

- **WHEN** um admin faz `PUT` com `costCredits: 0`
- **THEN** retorna `400` (validação zod `min(1)`)

#### Scenario: PUT sem reason retorna 400

- **WHEN** um admin faz `PUT` sem `reason` (ou vazio)
- **THEN** retorna `400`

#### Scenario: PUT sem campo mutável retorna 400

- **WHEN** um admin faz `PUT` sem `costCredits` e sem `enabled`
- **THEN** retorna `400` (refine "Informe exatamente um: costCredits ou enabled")

#### Scenario: PUT com costCredits e enabled juntos retorna 400

- **WHEN** um admin faz `PUT` com `costCredits` E `enabled` no mesmo body
- **THEN** retorna `400` (refine XOR — a audit só descreve uma ação por linha: `update_cost` ou `toggle_enabled`)

#### Scenario: PUT sem admin retorna 403

- **WHEN** um usuário não-admin faz `PUT /api/admin/operation-costs`
- **THEN** retorna `403`

#### Scenario: PUT com erro do RPC retorna 500

- **WHEN** o RPC `admin_update_operation_cost` falha
- **THEN** retorna `500`

### Requirement: Schema zod UpdateOperationCostRequestSchema

O sistema SHALL estender `src/lib/admin/schemas.ts` com o schema zod (D3/D7/D8):

```typescript
export const UpdateOperationCostRequestSchema = z
  .object({
    operationKey: z.enum(OPERATION_KEYS),       // D7
    costCredits: z.number().int().min(1).optional(),   // D3
    enabled: z.boolean().optional(),
    reason: z.string().min(1),                  // D8
    operationId: z.string().uuid().optional(),  // idempotência
  })
  .refine(
    (v) => (v.costCredits !== undefined) !== (v.enabled !== undefined),
    {
      message: "Informe exatamente um: costCredits ou enabled",
    }
  );
```

#### Scenario: Schema aceita body válido

- **WHEN** o body é `{ operationKey: "campaign_generation", costCredits: 2, reason: "x", operationId: "<uuid>" }`
- **THEN** o schema valida sem erro

#### Scenario: Schema rejeita operationKey desconhecido

- **WHEN** `operationKey` não está em `OPERATION_KEYS`
- **THEN** o schema rejeita

#### Scenario: Schema rejeita costCredits <= 0

- **WHEN** `costCredits` é 0 ou negativo
- **THEN** o schema rejeita

#### Scenario: Schema rejeita costCredits e enabled juntos

- **WHEN** o body contém `costCredits` E `enabled` ao mesmo tempo
- **THEN** o schema rejeita (refine XOR)

### Requirement: Página /admin/operation-costs

O sistema SHALL prover a página `/admin/operation-costs` (D10/D2) seguindo o padrão das páginas existentes (`/admin/users`, `/admin/metrics`):

- **Título visual "Configurações Econômicas"** — a **rota `/admin/operation-costs` é mantida** (não quebra bookmarks/testes/links existentes — D2); muda apenas o título/heading da página
- **Tabela de operações:** cada linha mostra `operation_key`, `cost_credits` (input numérico ≥1), toggle `enabled`, `updated_by` (email), `updated_at`, e badge `source` (`tabela`/`fallback`)
- **Editar custo:** campo numérico + **motivo obrigatório** + botão salvar → `PUT /api/admin/operation-costs`
- **Toggle habilitação:** switch com **motivo obrigatório** (mesmo RPC)
- **Seção "Parâmetros Econômicos" (F38.2 D2):** `usd_brl_rate` ("Taxa de conversão USD→BRL") e `credit_value_brl` ("Valor operacional do crédito em BRL"), cada um com input numérico, **motivo obrigatório**, badge `source` (`tabela`/`fallback`), e feedback `audit_id` após salvar via `PUT /api/admin/economic-parameters`
- **Feedback:** audit_id retornado e indicador de "não altera em produção até salvar"; estado de erro/load da chamada
- **Acesso:** apenas admin (guard da rota + nav admin). Link adicionado à navegação admin (`src/app/(app)/admin/layout.tsx`)

#### Scenario: Título visual "Configurações Econômicas" mantendo rota

- **WHEN** um admin acessa `/admin/operation-costs`
- **THEN** a página exibe o título "Configurações Econômicas" (heading) sem mudar a rota `/admin/operation-costs`

#### Scenario: Página lista operações com badge source

- **WHEN** um admin acessa `/admin/operation-costs`
- **THEN** a página exibe uma linha por operação com `operation_key`, custo, toggle, `updated_by`, `updated_at` e badge `source` (`tabela` ou `fallback`)

#### Scenario: Seção de Parâmetros Econômicos renderiza

- **WHEN** a página é renderizada
- **THEN** exibe a seção "Parâmetros Econômicos" com `usd_brl_rate` e `credit_value_brl`, cada um com badge `source` (`tabela` ou `fallback`) e descrição ("Taxa de conversão USD→BRL" / "Valor operacional do crédito em BRL")

#### Scenario: Editar parâmetro exige motivo

- **WHEN** um admin altera `usd_brl_rate` (ou `credit_value_brl`) e clica em salvar sem preencher o motivo
- **THEN** a página bloqueia o save e pede o motivo

#### Scenario: Salvar parâmetro chama PUT e mostra audit_id

- **WHEN** um admin altera `usd_brl_rate` com motivo válido e salva
- **THEN** a página chama `PUT /api/admin/economic-parameters`
- **AND** exibe feedback com o `audit_id` retornado

#### Scenario: Editar custo exige motivo

- **WHEN** um admin altera `cost_credits` e clica em salvar sem preencher o motivo
- **THEN** a página bloqueia o save e pede o motivo

#### Scenario: Salvar custo chama PUT e mostra audit_id

- **WHEN** um admin altera `cost_credits` com motivo válido e salva
- **THEN** a página chama `PUT /api/admin/operation-costs`
- **AND** exibe feedback com o `audit_id` retornado

#### Scenario: Toggle habilitação exige motivo

- **WHEN** um admin alterna o toggle `enabled` sem preencher o motivo
- **THEN** a página bloqueia o save e pede o motivo

#### Scenario: Link na navegação admin

- **WHEN** um admin abre a navegação admin
- **THEN** há um link para `/admin/operation-costs`
