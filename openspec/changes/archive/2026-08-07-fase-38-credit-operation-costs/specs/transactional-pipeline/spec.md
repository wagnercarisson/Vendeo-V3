## MODIFIED Requirements

### Requirement: COST_PER_GENERATION fixo em 1

> **Delta F38 (D12):** O sistema SHALL **remover** `COST_PER_GENERATION` de `src/lib/image-generation/config.ts`. O custo da geração de campanha passa a ser resolvido em runtime por `OperationCostService.getCost("campaign_generation")` (fonte: `credit_operation_costs`; fallback seguro 1 crédito quando linha inexistente — D5). Nenhum import de `COST_PER_GENERATION` pode restar no código.

O sistema SHALL definir o custo da geração de campanha dinamicamente via `OperationCostService` (D12), em vez de uma constante fixa em código.

#### Scenario: Constante removida de config

- **WHEN** `src/lib/image-generation/config.ts` é inspecionado
- **THEN** `COST_PER_GENERATION` NÃO existe

#### Scenario: Nenhum import restante

- **WHEN** o código é varrido por imports de `COST_PER_GENERATION`
- **THEN** nenhum import restante é encontrado

#### Scenario: Custo resolvido pelo OperationCostService

- **WHEN** a rota `generate-image` precisa do custo de geração
- **THEN** chama `OperationCostService.getCost("campaign_generation")` (fonte tabela ou fallback)

## ADDED Requirements

### Requirement: Pipeline pré-stream resolve custo via OperationCostService

> **Delta F38 (D12):** O pipeline pré-stream do `POST /api/campaign/generate-image` SHALL passar a resolver o custo de `campaign_generation` **uma única vez por request, após auth/ownership/readiness/rate guards e antes do saldo check** (evita leitura de custo antes de validar usuário/loja). O custo é dinâmico (`OperationCostService.getCost`), o balance check é `balance < cost.costCredits`, e a reserva usa `cost.costCredits` com metadata snapshot (`operation_key`, `operation_cost_credits`, `operation_cost_source`).

O sistema SHALL manter a estrutura de 3 zonas do pipeline de geração de campanha (pré-stream, paralelo, pós), com a resolução de custo dinâmica no pré-stream:

**PRÉ-STREAM (síncrono, fora do ReadableStream):** parse + auth + ownership + legal clearance (inclui reaceite v1.2) + campaignIntent guard + rate limit + **resolver custo `campaign_generation` (após os guards, antes do saldo)** + saldo check + input validation + criar campanha + reservar crédito. Produz Response HTTP direto (400, 401, 403, 429, 402, 409, 500). Nunca chama IA paga se alguma condição falhar.

#### Scenario: Saldo insuficiente retorna 402 antes do stream

- **WHEN** `POST /api/campaign/generate-image` é chamado com `balance < cost.costCredits`
- **THEN** retorna HTTP 402 Payment Required
- **AND** Nenhuma chamada de IA é feita
- **AND** Nenhum evento NDJSON é emitido

#### Scenario: Fluxo completo com saldo suficiente e rate limit OK

- **WHEN** `POST /api/campaign/generate-image` é chamado com saldo suficiente e rate limit OK
- **THEN** rate limit guard passa
- **AND** tentativa é registrada em `generation_rate_events`
- **AND** saldo check passa (contra `cost.costCredits` dinâmico)
- **AND** campanha é criada com status `generating`
- **AND** `cost.costCredits` é reservado via `reserveCredit` com metadata snapshot (`operation_key`, `operation_cost_credits`, `operation_cost_source`)
- **AND** Copy Director + Image Director executam em paralelo
- **AND** NDJSON events de progresso são emitidos
- **AND** ao finalizar, campanha fica com status `ready`
- **AND** `publication_copy_snapshot` contém resultado do Copy Director
- **AND** NDJSON result é emitido com `campaignId` e `campaignUrl`
