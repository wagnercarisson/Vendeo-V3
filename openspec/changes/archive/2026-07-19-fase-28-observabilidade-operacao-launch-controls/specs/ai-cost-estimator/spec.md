## ADDED Requirements

### Requirement: estimateAiCost() calcula custo estimado

O sistema SHALL prover uma função `estimateAiCost(params)` em `src/lib/ai-cost/cost-estimator.ts` que retorna `AiCostEstimate | null`.

```typescript
export type AiCostEstimate = {
  estimatedCostUsd: number;
  source: string;
};

export function estimateAiCost(params: {
  provider: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}): AiCostEstimate | null;
```

A função SHALL usar uma tabela de preços interna com ao menos OpenAI e Gemini. Os valores são **constantes versionadas internamente** baseadas nos preços públicos dos provedores no momento da implementação — não garantem preço atual externo. Se os preços dos provedores mudarem, a tabela interna deve ser atualizada em uma fase posterior.

#### Scenario: OpenAI gpt-4o com tokens → custo calculado

- **WHEN** `estimateAiCost({ provider: "openai", model: "gpt-4o", usage: { promptTokens: 1000, completionTokens: 500 } })`
- **THEN** retorna `{ estimatedCostUsd: 0.0075, source: "openai_published_pricing" }`
- **AND** o cálculo é `(1000/1000 * 0.0025) + (500/1000 * 0.01) = 0.0025 + 0.005 = 0.0075`

#### Scenario: Modelo desconhecido → null

- **WHEN** `estimateAiCost({ provider: "openai", model: "unknown-model" })`
- **THEN** retorna `null`

#### Scenario: Sem usage → null

- **WHEN** `estimateAiCost({ provider: "openai", model: "gpt-4o" })` (sem `usage`)
- **THEN** retorna `null`

#### Scenario: Gemini modelo conhecido → custo calculado

- **WHEN** `estimateAiCost({ provider: "gemini", model: "gemini-2.0-flash", usage: { promptTokens: 1000, completionTokens: 200 } })` é chamado
- **THEN** retorna um objeto com `estimatedCostUsd` numérico e `source: "google_published_pricing"`
