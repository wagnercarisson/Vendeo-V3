## MODIFIED Requirements

### Requirement: estimateAiCost() calcula custo estimado

O sistema SHALL prover uma função `resolveAiCost(params)` em `src/lib/ai-cost/cost-estimator.ts` que retorna `CostResolution` (contrato D9):

```typescript
export function resolveAiCost(params: {
  provider: string;
  model: string;
  usage?: TokenUsage;
  providerReportedCostUsd?: number | null;
}): CostResolution;
```

> **Delta F38.1 (D9):** O `estimateAiCost` deixa de ser a única fonte e passa a ser o **resolvedor** de custo `resolveAiCost`, resolvendo por fonte `provider_reported → pricing_table → fallback_static → not_available`. Os preços movem da `Record` TS para a tabela `ai_model_pricing` (D8); o TS vira default bootstrap (`DEFAULT_AI_MODEL_PRICING`). `cost_source` (5 valores) + `pricing_version` passam a ser retornados. Corrige `gemini-3.1-flash-lite` e `gpt-image-2`, cached/image tokens. Os testes existentes do estimator (`cost-estimator.test.ts`) são adaptados ao novo contrato e mantidos.

**Cadeia de resolução (D9):**

```
1. providerReportedCostUsd presente  → costSource = 'provider_reported'
2. senão, linha ai_model_pricing (vigente) p/ provider+model
     + usage disponível              → calcula por tokens → costSource = 'pricing_table'
     + modelo image sem usage        → usa dimensão da linha (image_token_usd_per_1m
                                       e/ou image_unit_usd) → costSource = 'pricing_table'
3. senão, modelo conhecido em código  → defaults (bootstrap) → costSource = 'pricing_table'
4. senão, fallback_static configurado (VENDEO_AI_FALLBACK_COST_USD, default 0.15)
                                      → costSource = 'fallback_static'
5. senão                              → costSource = 'not_available' (tokens registrados, custo NULL)
```

#### Scenario: usage + linha na tabela → pricing_table com uuid

- **WHEN** `resolveAiCost({ provider: "openai", model: "gpt-4o", usage: { promptTokens: 1000, completionTokens: 500 } })` é chamado com linha vigente em `ai_model_pricing`
- **THEN** retorna `{ estimatedCostUsd: 0.0075, costSource: "pricing_table", pricingVersion: "<uuid da linha>" }`

#### Scenario: providerReportedCostUsd presente → provider_reported

- **WHEN** `resolveAiCost({ provider: "openai", model: "gpt-4o", usage, providerReportedCostUsd: 0.02 })` é chamado
- **THEN** retorna `{ estimatedCostUsd: 0.02, providerReportedCostUsd: 0.02, costSource: "provider_reported" }`
- **AND** o cálculo interno NÃO sobrescreve o valor reportado (D3)

#### Scenario: modelo image sem usage (gpt-image-2) usa dimensão de imagem

- **WHEN** `resolveAiCost({ provider: "openai", model: "gpt-image-2" })` (sem usage) é chamado com linha na tabela com `image_unit_usd`
- **THEN** retorna `estimatedCostUsd` a partir da dimensão de imagem e `costSource: "pricing_table"` (D8/D9)

#### Scenario: gemini-3.1-flash-lite com usage → custo por tokens

- **WHEN** `resolveAiCost({ provider: "gemini", model: "gemini-3.1-flash-lite", usage: { promptTokens: 1000, completionTokens: 200 } })` é chamado
- **THEN** retorna custo por tokens (NÃO mais NULL — furo 3 sanado)

#### Scenario: gpt-4o sem usage → fallback_static

- **WHEN** `resolveAiCost({ provider: "openai", model: "gpt-4o" })` (sem usage) é chamado
- **THEN** retorna `estimatedCostUsd` com `costSource: "fallback_static"` (0.15 default) — e NÃO null (furo 1 sanado no fluxo)

#### Scenario: modelo desconhecido + sem usage → fallback_static

- **WHEN** `resolveAiCost({ provider: "openai", model: "unknown-model" })` (sem usage) é chamado
- **THEN** retorna `costSource: "fallback_static"` com o valor configurado

#### Scenario: tabela sem linha e default em código → pricing_table code_default

- **WHEN** `resolveAiCost` é chamado para modelo sem linha na tabela mas com default em `DEFAULT_AI_MODEL_PRICING`
- **THEN** retorna `costSource: "pricing_table"` com `pricingVersion: "code_default"` (bootstrap D8)

#### Scenario: tabela sem linha E sem default → not_available

- **WHEN** `resolveAiCost` é chamado para modelo sem linha na tabela e sem default em código
- **THEN** retorna `{ estimatedCostUsd: null, costSource: "not_available" }` (tokens preservados, custo NULL — D4)

#### Scenario: cached tokens (gpt-5.5) descontam do input

- **WHEN** `resolveAiCost` é chamado com `usage: { promptTokens: 1000, completionTokens: 200, cachedInputTokens: 400 }` para `gpt-5.5` (cached 0.50)
- **THEN** o input pago é `600` (1000 - 400 cached) ao preço normal + `400` ao preço cached (D9)

#### Scenario: manual_unknown para ajuste manual

- **WHEN** um custo é resolvido a partir de ajuste manual sem origem automática
- **THEN** retorna `costSource: "manual_unknown"` (D4)

### Requirement: Modelo desconhecido → null (legado)

O sistema SHALL manter o comportamento de retornar um `CostResolution` (nunca `null`) para modelos desconhecidos — o evento existe mesmo sem custo.

> **Delta F38.1 (D9):** Comportamento legado substituído — `resolveAiCost` **nunca retorna `null`**; retorna `CostResolution` com `costSource: "fallback_static"` ou `"not_available"` (custo NULL apenas neste último caso). O evento da chamada é **sempre** gravado pelo `AiCostTracker` (D7), mesmo sem custo.

#### Scenario: modelo desconhecido com usage → fallback_static

- **WHEN** `resolveAiCost({ provider: "openai", model: "unknown-model", usage: { promptTokens: 1000 } })` é chamado
- **THEN** retorna `CostResolution` (não-null) com `costSource: "fallback_static"`
- **AND** os tokens estão preservados na trilha (D4)
