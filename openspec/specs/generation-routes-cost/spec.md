# Generation Routes Cost

> Synced from `fase-38-credit-operation-costs` (ADDED).

## Purpose

Contrato de resolução de custo nas rotas de geração (D12): `generate-image` (campaign_generation) e `generate-without-logo` (visual_signature_generation) resolvem o custo **uma única vez por request, após auth/ownership/readiness/rate guards e antes de saldo/reserva/IA paga** — com guard `enabled=false` → `503 operation_disabled` (sempre), fail-closed → `503 operation_cost_unavailable`, balance check dinâmico e reserva com metadata snapshot.

## Requirements

### Requirement: Resolução de custo nas rotas de geração

O sistema SHALL fazer as rotas de geração (`generate-image` para `campaign_generation` e `generate-without-logo` para `visual_signature_generation`) resolverem o custo **uma única vez por request, após auth/ownership/readiness/rate guards e antes de saldo/reserva/IA paga** via `OperationCostService.getCost(operationKey)` (D12) — sem cache extra; 1 leitura por request:

1. **Fail-closed em erro de leitura:** `OperationCostUnavailableError` → `503 { error: "operation_cost_unavailable", message: "Serviço indisponível no momento. Tente novamente em alguns instantes." }` — sem geração nem reserva (D5)
2. **Guard de habilitação (sempre):** `enabled=false` → `503 { error: "operation_disabled", operationKey }` — independente de `creditsChargingEnabled` (D4)
3. **Balance check dinâmico (se `creditsChargingEnabled`):** `balance < costCredits` → `402` (mensagem existente); com cobrança desligada, pula o gate de saldo e a reserva — mas não a operação desabilitada
4. **Reserva:** `reserveCredit(storeId, costCredits, { ...metadata, operation_key, operation_cost_credits, operation_cost_source })` (D6)
5. **Refund** mantém metadata de feature (sem necessidade de snapshot extra)

- A resolução acontece **depois** dos guards de autenticação/ownership/readiness/rate limit (evita leitura de custo antes de validar usuário/loja) e **antes** do balance check, da reserva e de qualquer IA paga
- Resolução única por request significa que uma geração já em andamento usa o valor lido na partida — mudança de custo pelo admin não afeta gerações em voo (documentado)

#### Scenario: Custo resolvido uma única vez após guards e antes do saldo

- **WHEN** uma rota de geração recebe um request que passou auth/ownership/readiness/rate guards
- **THEN** `OperationCostService.getCost(operationKey)` é chamado uma única vez, após os guards e antes do balance check/reserva/IA paga

#### Scenario: Erro real de leitura retorna 503 operation_cost_unavailable sem reserva

- **WHEN** `OperationCostService.getCost` lança `OperationCostUnavailableError`
- **THEN** a rota retorna `503` com `{ error: "operation_cost_unavailable", message: "Serviço indisponível no momento. Tente novamente em alguns instantes." }`
- **AND** nenhuma reserva nem geração acontece

#### Scenario: enabled=false retorna 503 operation_disabled

- **WHEN** o custo resolvido tem `enabled: false`
- **THEN** a rota retorna `503` com `{ error: "operation_disabled", operationKey }`

#### Scenario: enabled=false bloqueia mesmo com cobrança desligada

- **WHEN** o custo resolvido tem `enabled: false` e `creditsChargingEnabled=false`
- **THEN** a rota retorna `503 operation_disabled` (guard de habilitação incondicional — D4)

#### Scenario: Erro de leitura bloqueia mesmo com cobrança desligada

- **WHEN** `OperationCostUnavailableError` é lançado e `creditsChargingEnabled=false`
- **THEN** a rota retorna `503 operation_cost_unavailable` (fail-closed independe da cobrança — D5)

#### Scenario: Balance insuficiente retorna 402 dinâmico

- **WHEN** `creditsChargingEnabled=true` e `balance < costCredits`
- **THEN** a rota retorna `402` (mensagem existente)

#### Scenario: Cobrança desligada pula saldo e reserva

- **WHEN** `creditsChargingEnabled=false` e a operação está habilitada
- **THEN** a rota NÃO verifica saldo nem chama `reserveCredit` (o fluxo grátis segue como hoje para operações habilitadas)

#### Scenario: Reserva usa custo resolvido com snapshot

- **WHEN** a reserva acontece com `creditsChargingEnabled=true`
- **THEN** `reserveCredit` é chamado com `costCredits` (custo resolvido) e metadata contendo `operation_key`, `operation_cost_credits` e `operation_cost_source`

### Requirement: generate-image (campaign_generation) com custo dinâmico

O sistema SHALL atualizar `POST /api/campaign/generate-image` para resolver `campaign_generation` e usar o custo dinâmico (D12):

```
generate-image (campaign_generation):
  :227  balance < cost.costCredits        (antes: COST_PER_GENERATION)
  :347  reserveCredit(storeId, cost.costCredits, { campaignId, idempotencyKey,
          metadata: { feature: "campaign_pipeline",
                      operation_key, operation_cost_credits, operation_cost_source } })
```

- `COST_PER_GENERATION` é **removido** de `src/lib/image-generation/config.ts`; os defaults vivem no módulo do `OperationCostService` (D5)
- Nenhum import restante de `COST_PER_GENERATION`

#### Scenario: generate-image usa custo resolvido

- **WHEN** a rota `generate-image` valida saldo
- **THEN** compara `balance < cost.costCredits` (não importa `COST_PER_GENERATION`)

#### Scenario: generate-image reserva com snapshot

- **WHEN** a reserva acontece
- **THEN** `reserveCredit` recebe `cost.costCredits` e metadata com `feature: "campaign_pipeline"`, `operation_key`, `operation_cost_credits`, `operation_cost_source`

#### Scenario: COST_PER_GENERATION removido de config.ts

- **WHEN** `src/lib/image-generation/config.ts` é inspecionado
- **THEN** `COST_PER_GENERATION` não existe
- **AND** nenhum import de `COST_PER_GENERATION` resta no código

### Requirement: generate-without-logo (visual_signature_generation) com custo dinâmico

O sistema SHALL atualizar `POST /api/store/[id]/visual-signature/generate-without-logo` para resolver `visual_signature_generation` e usar o custo dinâmico (D12):

```
generate-without-logo (visual_signature_generation):
  :176  balance < cost.costCredits        (antes: literal 1)
  :186  reserveCredit(id, cost.costCredits, { idempotencyKey, metadata: {
          feature: "visual_signature", mode, operationId,
          operation_key, operation_cost_credits, operation_cost_source } })
```

#### Scenario: generate-without-logo usa custo resolvido

- **WHEN** a rota `generate-without-logo` valida saldo
- **THEN** compara `balance < cost.costCredits` (substitui o literal `1`)

#### Scenario: generate-without-logo reserva com snapshot

- **WHEN** a reserva acontece
- **THEN** `reserveCredit` recebe `cost.costCredits` e metadata com `feature: "visual_signature"`, `mode`, `operationId`, `operation_key`, `operation_cost_credits`, `operation_cost_source`
