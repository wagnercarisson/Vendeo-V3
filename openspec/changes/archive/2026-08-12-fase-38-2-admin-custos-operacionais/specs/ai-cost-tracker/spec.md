## MODIFIED Requirements

### Requirement: AiCostTracker — camada única de registro (best-effort)

O sistema SHALL prover a classe `AiCostTracker` em `src/lib/ai-cost/tracker.ts` (import `server-only`), como **único** caminho de escrita de custo (D7):

```typescript
import "server-only";

export class AiCostTracker {
  constructor(client?: SupabaseClient);   // default supabaseAdmin
  startRun(type: OperationRunType): { operationRunId: string; traceId: string };
  async record(event: AiCostEvent): Promise<void>;   // best-effort — nunca lança
}
```

- **`startRun(type)`** gera `operationRunId` (UUID v4) e `traceId` (UUID/TEXT) **distintos** no início de um request e propaga-os às chamadas filhas via contexto de telemetria (`opts.telemetry`) (D1/D7)
- **`record(event)`** grava o evento completo em `generation_events` (todas as colunas novas — D2): `operation_run_id`, `operation_run_type`, `visual_signature_id`, `cached_input_tokens`, `image_tokens`, `provider_reported_cost_usd`, `estimated_cost_usd`, `cost_source`, `pricing_version`, além das existentes
- **F38.2 (D5): `record` passa a persistir também** `cost_formula_version`, `cost_estimation_note`, `text_component_usd`, `image_tool_component_usd` a partir do `CostResolution` — o `resolveAiCost` já os computa; **daqui para frente, sem reclassificar histórico** (eventos anteriores à migration ficam NULL)
- **Nunca lança** — qualquer falha de escrita é logada e ignorada (best-effort, geração não bloqueada por telemetria)
- **Delivery marker:** `record` do delivery (ex.: `campaign_pipeline`/`visual_signature`/`brand_profile_*`) recebe evento sem `cost` e sem `tokens`, com `durationMs` (pipeline) e `metadata.duration_is_pipeline: true` (anti-dupla-contagem D1/D6)
- **Substitui** os 4 inserts inline do `generate-image/route.ts`, os inserts do `generate-without-logo/route.ts` e o helper `insertGenerationEvent` (que passa a delegar ao tracker — D11)

#### Scenario: startRun gera operation_run_id e trace_id distintos

- **WHEN** `tracker.startRun("campaign_delivery")` é chamado
- **THEN** retorna `{ operationRunId, traceId }` com UUIDs **diferentes entre si**
- **AND** o `operationRunId` é um UUID válido (string v4)

#### Scenario: record grava todas as novas colunas

- **WHEN** `tracker.record(event)` é chamado com um evento completo (com `visualSignatureId`, cached/image tokens, `costSource`, `pricingVersion`)
- **THEN** a linha inserida em `generation_events` contém todas as novas colunas preenchidas (D2/D7)

#### Scenario: record persiste campos de confiança (F38.2 D5)

- **WHEN** `tracker.record(event)` é chamado com um evento cujo `CostResolution` traz `costFormulaVersion`, `costEstimationNote`, `textComponentUsd` e `imageToolComponentUsd`
- **THEN** a linha inserida em `generation_events` contém `cost_formula_version`, `cost_estimation_note`, `text_component_usd` e `image_tool_component_usd` preenchidos

#### Scenario: evento sem nota (histórico) → colunas NULL

- **WHEN** `tracker.record(event)` é chamado com um evento sem `costFormulaVersion`/`costEstimationNote`/componentes (ou `CostResolution` sem eles)
- **THEN** as colunas novas de confiança ficam NULL (badge genérico no service — D5)

#### Scenario: record nunca lança em erro de escrita

- **WHEN** a escrita em `generation_events` falha (ex.: timeout de rede)
- **THEN** o erro é logado
- **AND** o `record` resolve sem lançar (best-effort — geração segue)

#### Scenario: mesmo operation_run_id agrupa N chamadas

- **WHEN** múltiplas chamadas de um mesmo run são gravadas com o mesmo `operationRunId`
- **THEN** todas as linhas compartilham o mesmo `operation_run_id` (propagação — D1)

#### Scenario: delivery marker sem custo/tokens

- **WHEN** o delivery (ex.: `campaign_pipeline`) é gravado
- **THEN** `estimated_cost_usd`/`provider_reported_cost_usd` e tokens ficam NULL
- **AND** `metadata.duration_is_pipeline` é `true` (D1/D6)

#### Scenario: evento sem custo (not_available) ainda grava tokens

- **WHEN** um evento é gravado com `costSource: "not_available"` e `estimatedCostUsd: null`
- **THEN** os tokens continuam persistidos (trilha auditável — D4)

#### Scenario: cost_source inválido rejeitado no TS

- **WHEN** um valor fora de `COST_SOURCES` é passado como `costSource`
- **THEN** o TypeScript rejeita em compile time (D4)

#### Scenario: insertGenerationEvent delega ao tracker

- **WHEN** `insertGenerationEvent` (VS, `generation-events.ts`) é chamado
- **THEN** ele delega a gravação ao `AiCostTracker` (retorno compatível com o uso existente — D11)
