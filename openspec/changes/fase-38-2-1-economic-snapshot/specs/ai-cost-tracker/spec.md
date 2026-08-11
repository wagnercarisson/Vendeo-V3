## MODIFIED Requirements

### Requirement: AiCostEvent — contrato do evento de chamada real de IA

O sistema SHALL definir o tipo `AiCostEvent` em `src/lib/ai-cost/types.ts` como o contrato único de gravação de um evento de custo (D7), incluindo o snapshot econômico no momento da geração:

```typescript
export interface AiCostEvent {
  operationRunId: string;
  operationRunType: OperationRunType;
  traceId: string;
  storeId: string;
  userId?: string | null;
  campaignId?: string | null;
  visualSignatureId?: string | null;
  themeId?: string | null;
  generationType: GenerationEventType;      // D5
  provider: string;
  model: string;
  attemptNumber: number;
  durationMs: number;
  status: GenerationEventStatus;
  errorType?: string | null;
  tokens?: TokenUsage;
  cost?: CostResolution;
  usdBrlRateAtGeneration?: number | null;        // snapshot contábil — câmbio conhecido na geração
  creditValueBrlAtGeneration?: number | null;    // snapshot estimativo/fallback — valor do crédito na geração
  usdBrlRateSourceAtGeneration?: string | null;  // origem: 'captured_at_generation' quando o tracker grava
  creditValueBrlSourceAtGeneration?: string | null;  // origem: 'captured_at_generation' quando o tracker grava
  metadata?: Record<string, unknown>;
}
```

- `operationRunId` é UUID (string v4) — coluna UUID no banco (D1/D2); `trace_id` é TEXT com semântica técnica distinta
- `cost: null`/ausente indica **delivery marker** (anti-dupla-contagem — D1/D6): o evento da entrega não grava custo nem tokens
- `tokens` são gravados **sempre** que existirem, mesmo com `cost.estimatedCostUsd: null` (`not_available` — D4)
- **`usdBrlRateAtGeneration`/`creditValueBrlAtGeneration`** são os snapshots econômicos resolvidos no início do run (padrão telemetria D7/D12) e propagados às chamadas filhas; NULL quando indisponíveis (fallback legacy em leitura)
- **`usdBrlRateSourceAtGeneration`/`creditValueBrlSourceAtGeneration`** são as origens dos valores — quando o tracker grava um valor presente, a origem SHALL ser `"captured_at_generation"`; nunca `backfilled_*` nem `economic_parameter_fallback` (essas são gravadas pelo backfill/derivadas em leitura)
- `usdBrlRateAtGeneration` é o snapshot **contábil** do câmbio (estrutural, continua válido em fases futuras); `creditValueBrlAtGeneration` é o snapshot **estimativo/fallback** do valor do crédito — usado somente para derivados **estimados** (nunca "receita real")

#### Scenario: AiCostEvent sem cost representa delivery marker

- **WHEN** um `AiCostEvent` é criado sem o campo `cost`
- **THEN** ele representa um delivery marker (sem custo e sem tokens — anti-dupla-contagem D1/D6)
- **AND** `operationRunId`/`traceId` permanecem preenchidos para agrupamento

#### Scenario: AiCostEvent com tokens e custo not_available

- **WHEN** um `AiCostEvent` é criado com `tokens` preenchidos e `cost: { estimatedCostUsd: null, costSource: "not_available" }`
- **THEN** o evento representa uma chamada real com consumo registrado e custo desconhecido (D4)

#### Scenario: AiCostEvent carrega snapshot econômico da geração

- **WHEN** um `AiCostEvent` é criado para uma chamada de um run iniciado com `usd_brl_rate = 5.20` e `credit_value_brl = 2.00`
- **THEN** o evento carrega `usdBrlRateAtGeneration = 5.20` e `creditValueBrlAtGeneration = 2.00` (snapshot propagado do início do run) com origens `captured_at_generation`

#### Scenario: AiCostEvent sem snapshot disponível

- **WHEN** a resolução dos parâmetros falha no início do run
- **THEN** `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration` e as origens são NULL (fallback legacy em leitura, sem bloquear geração)

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
- **`record(event)`** grava o evento completo em `generation_events` (todas as colunas novas — D2): `operation_run_id`, `operation_run_type`, `visual_signature_id`, `cached_input_tokens`, `image_tokens`, `provider_reported_cost_usd`, `estimated_cost_usd`, `cost_source`, `pricing_version`, `cost_formula_version`, `cost_estimation_note`, `text_component_usd`, `image_tool_component_usd`, **`usd_brl_rate_at_generation`**, **`credit_value_brl_at_generation`**, **`usd_brl_rate_source_at_generation`**, **`credit_value_brl_source_at_generation`**, além das existentes
- **Nunca lança** — qualquer falha de escrita é logada e ignorada (best-effort, geração não bloqueada por telemetria)
- **Delivery marker:** `record` do delivery (ex.: `campaign_pipeline`/`visual_signature`/`brand_profile_*`) recebe evento sem `cost` e sem `tokens`, com `durationMs` (pipeline) e `metadata.duration_is_pipeline: true` (anti-dupla-contagem D1/D6)
- **Substitui** os 4 inserts inline do `generate-image/route.ts`, os inserts do `generate-without-logo/route.ts` e o helper `insertGenerationEvent` (que passa a delegar ao tracker — D11)
- **Snapshot econômico:** `record` persiste `usd_brl_rate_at_generation`/`credit_value_brl_at_generation` do evento **com origem `captured_at_generation`** — daqui para frente, sem reclassificar histórico; snapshots NULL não bloqueiam a gravação

#### Scenario: startRun gera operation_run_id e trace_id distintos

- **WHEN** `tracker.startRun("campaign_delivery")` é chamado
- **THEN** retorna `{ operationRunId, traceId }` com UUIDs **diferentes entre si**
- **AND** o `operationRunId` é um UUID válido (string v4)

#### Scenario: record grava todas as novas colunas

- **WHEN** `tracker.record(event)` é chamado com um evento completo (com `visualSignatureId`, cached/image tokens, `costSource`, `pricingVersion`, `usdBrlRateAtGeneration`, `creditValueBrlAtGeneration`)
- **THEN** a linha inserida em `generation_events` contém todas as novas colunas preenchidas, incluindo os snapshots econômicos e as origens `captured_at_generation` (D2/D7)

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
