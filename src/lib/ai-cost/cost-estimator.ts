export interface AiCostEstimate {
  estimatedCostUsd: number;
  source: string;
}

interface PricingTier {
  inputPer1M: number;
  outputPer1M: number;
}

const OPENAI_PRICING: Record<string, PricingTier | number> = {
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "dall-e-3": 0.040,
};

const GEMINI_PRICING: Record<string, PricingTier> = {
  "gemini-2.0-flash": { inputPer1M: 0.10, outputPer1M: 0.40 },
};

export function estimateAiCost(params: {
  provider: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}): AiCostEstimate | null {
  const { provider, model, usage } = params;

  if (!usage || (usage.promptTokens === undefined && usage.completionTokens === undefined)) {
    return null;
  }

  const promptTokens = usage.promptTokens ?? 0;
  const completionTokens = usage.completionTokens ?? 0;

  if (provider === "openai") {
    const pricing = OPENAI_PRICING[model];
    if (!pricing) return null;

    if (typeof pricing === "number") {
      return { estimatedCostUsd: pricing, source: "openai_published_pricing" };
    }

    const cost =
      (promptTokens / 1_000_000) * pricing.inputPer1M +
      (completionTokens / 1_000_000) * pricing.outputPer1M;

    return { estimatedCostUsd: Number(cost.toFixed(6)), source: "openai_published_pricing" };
  }

  if (provider === "gemini") {
    const pricing = GEMINI_PRICING[model];
    if (!pricing) return null;

    const cost =
      (promptTokens / 1_000_000) * pricing.inputPer1M +
      (completionTokens / 1_000_000) * pricing.outputPer1M;

    return { estimatedCostUsd: Number(cost.toFixed(6)), source: "gemini_published_pricing" };
  }

  return null;
}
