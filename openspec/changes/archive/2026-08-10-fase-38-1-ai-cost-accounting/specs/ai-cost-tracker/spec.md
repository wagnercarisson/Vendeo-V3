## ADDED Requirements

### Requirement: Tipos centrais de custo (CostSource, OperationRunType, TokenUsage, CostResolution)

O sistema SHALL definir o módulo de tipos `src/lib/ai-cost/types.ts` (sem server-only — fonte única de tipos, consumido por schema/zod/UI sem risco de import de código server-only) com:

```typescript
export const COST_SOURCES = [
  "provider_reported", "pricing_table", "fallback_static",
  "manual_unknown", "not_available",
] as const;
export type CostSource = (typeof COST_SOURCES)[number];

export const OPERATION_RUN_TYPES = [
  "campaign_delivery", "visual_signature", "brand_profile", "theme",
] as const;
export type OperationRunType = (typeof OPERATION_RUN_TYPES)[number];

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  imageTokens?: number;
}

export interface CostResolution {
  estimatedCostUsd: number | null;        // cálculo interno do Vendeo (null = not_available)
  providerReportedCostUsd?: number | null;
  costSource: CostSource;
  pricingVersion?: string | null;         // uuid da linha ai_model_pricing | 'code_default' | null
}
```

- `CostSource` é o enum fechado de classificação de custo (D4) — os 5 valores mapeiam para o CHECK `chk_generation_events_cost_source` no banco (D2)
- `OperationRunType` versiona as semânticas de entrega econômica (D1): `campaign_delivery`, `visual_signature`, `brand_profile`, `theme`
- `TokenUsage` padroniza o usage de qualquer provider (D12) — inclui cached/image tokens (D9)

#### Scenario: COST_SOURCES contém os 5 valores

- **WHEN** `COST_SOURCES` é importado
- **THEN** contém `["provider_reported", "pricing_table", "fallback_static", "manual_unknown", "not_available"]`

#### Scenario: OPERATION_RUN_TYPES contém os 4 domínios

- **WHEN** `OPERATION_RUN_TYPES` é importado
- **THEN** contém `["campaign_delivery", "visual_signature", "brand_profile", "theme"]`

#### Scenario: CostSource inválido rejeitado em compile time

- **WHEN** um valor fora de `COST_SOURCES` é usado como `CostSource`
- **THEN** o TypeScript rejeita em compile time

### Requirement: AiCostEvent — contrato do evento de chamada real de IA

O sistema SHALL definir o tipo `AiCostEvent` em `src/lib/ai-cost/types.ts` como o contrato único de gravação de um evento de custo (D7):

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
  metadata?: Record<string, unknown>;
}
```

- `operationRunId` é UUID (string v4) — coluna UUID no banco (D1/D2); `trace_id` é TEXT com semântica técnica distinta
- `cost: null`/ausente indica **delivery marker** (anti-dupla-contagem — D1/D6): o evento da entrega não grava custo nem tokens
- `tokens` são gravados **sempre** que existirem, mesmo com `cost.estimatedCostUsd: null` (`not_available` — D4)

#### Scenario: AiCostEvent sem cost representa delivery marker

- **WHEN** um `AiCostEvent` é criado sem o campo `cost`
- **THEN** ele representa um delivery marker (sem custo e sem tokens — anti-dupla-contagem D1/D6)
- **AND** `operationRunId`/`traceId` permanecem preenchidos para agrupamento

#### Scenario: AiCostEvent com tokens e custo not_available

- **WHEN** um `AiCostEvent` é criado com `tokens` preenchidos e `cost: { estimatedCostUsd: null, costSource: "not_available" }`
- **THEN** o evento representa uma chamada real com consumo registrado e custo desconhecido (D4)

### Requirement: AiCallInfo — callback de usage (padrão dos serviços)

O sistema SHALL definir o tipo `AiCallInfo` em `src/lib/ai-cost/types.ts` como o contrato do callback opcional `onCall` que os serviços de IA expõem (D7/D12):

```typescript
export interface AiCallInfo {
  provider: string;
  model: string;
  usage?: TokenUsage;
  durationMs: number;
  providerReportedCostUsd?: number | null;
}
```

- Qualquer serviço que chame IA (copy, validação, revisão, geração de imagem, validator, brand profiler/director/text-only) SHALL aceitar um callback opcional `onCall?: (info: AiCallInfo) => void` e invocá-lo após a chamada real — sem quebrar contratos públicos existentes
- O adapter de um novo provider traduz o usage nativo do SDK para `TokenUsage` (D12)

#### Scenario: Serviço expõe onCall opcional

- **WHEN** um serviço de IA (ex.: `CopyDirectorService.generateCopy`) é chamado com `opts.onCall`
- **THEN** o callback é invocado após a chamada real com `AiCallInfo` (provider, model, usage, durationMs)
- **AND** o comportamento sem `onCall` permanece idêntico (retrocompatível)

#### Scenario: Novo provider emite AiCallInfo normalizado

- **WHEN** um novo provider é integrado
- **THEN** ele emite `AiCallInfo` com `provider`/`model` e `usage` normalizado para `TokenUsage` (D12)

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
