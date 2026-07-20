export interface AiCostEstimate {
  estimatedCostUsd: number;
  source: string;
}

interface PricingTier {
  inputPer1M: number;
  cachedInputPer1M?: number;
  outputPer1M: number;
}

const OPENAI_PRICING: Record<string, PricingTier | number> = {
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-5.5": { inputPer1M: 5.0, cachedInputPer1M: 0.5, outputPer1M: 30.0 },
  "gpt-5.5-2026-04-23": { inputPer1M: 5.0, cachedInputPer1M: 0.5, outputPer1M: 30.0 },
  "dall-e-3": 0.040,
};

const GEMINI_PRICING: Record<string, PricingTier> = {
  "gemini-2.0-flash": { inputPer1M: 0.10, outputPer1M: 0.40 },
};

// Fallback cost for image generation when no usage data is available.
// Set via VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD env var (default 0.15 USD).
// This is a temporary heuristic for UAT — replace with OpenAI Costs API in future phases.
function getFallbackCost(): number {
  const raw = process.env.VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD;
  if (raw) {
    const parsed = Number(raw);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 0.15;
}

const KNOWN_TEXT_MODELS = new Set(["gpt-4o", "gpt-4o-mini", "gemini-2.0-flash"]);

function isKnownTextModel(model: string): boolean {
  return KNOWN_TEXT_MODELS.has(model);
}

/**
 * Strip version/date suffixes from model names for pricing lookup.
 * Examples:
 *   gpt-4o-2024-08-06       -> gpt-4o
 *   gpt-4o-mini-2024-07-18  -> gpt-4o-mini
 *   gpt-5.5-2026-04-23      -> gpt-5.5
 *   gpt-4.1-2025-04-14      -> gpt-4.1
 */
function normalizeModel(model: string): string {
  return model.replace(/(-\d{4}-\d{2}-\d{2})+$/g, "");
}

export function estimateAiCost(params: {
  provider: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number; cachedInputTokens?: number };
}): AiCostEstimate | null {
  const { provider, model, usage } = params;

  const promptTokens = usage?.promptTokens ?? 0;
  const cachedInputTokens = usage?.cachedInputTokens ?? 0;
  const completionTokens = usage?.completionTokens ?? 0;
  const hasUsage = usage !== undefined && (usage.promptTokens !== undefined || usage.completionTokens !== undefined);

  const normalizedModel = normalizeModel(model);
  const baseModel = normalizedModel;

  if (provider === "openai") {
    const pricing = OPENAI_PRICING[model] ?? OPENAI_PRICING[baseModel];
    if (pricing) {
      if (typeof pricing === "number") {
        return { estimatedCostUsd: pricing, source: "openai_published_pricing" };
      }
      if (hasUsage) {
        const uncachedPromptTokens = Math.max(0, promptTokens - cachedInputTokens);
        const cachedCost = pricing.cachedInputPer1M
          ? (cachedInputTokens / 1_000_000) * pricing.cachedInputPer1M
          : 0;
        const cost =
          (uncachedPromptTokens / 1_000_000) * pricing.inputPer1M +
          cachedCost +
          (completionTokens / 1_000_000) * pricing.outputPer1M;
        return { estimatedCostUsd: Number(cost.toFixed(6)), source: "openai_published_pricing" };
      }
    }

    if (!isKnownTextModel(baseModel)) {
      const source = hasUsage ? "configured_fallback_unknown_model_with_usage" : "configured_fallback";
      return { estimatedCostUsd: getFallbackCost(), source };
    }

    return null;
  }

  if (provider === "gemini") {
    const pricing = GEMINI_PRICING[model] ?? GEMINI_PRICING[baseModel];
    if (!pricing) return null;

    if (hasUsage) {
      const cost =
        (promptTokens / 1_000_000) * pricing.inputPer1M +
        (completionTokens / 1_000_000) * pricing.outputPer1M;
      return { estimatedCostUsd: Number(cost.toFixed(6)), source: "gemini_published_pricing" };
    }

    return null;
  }

  return null;
}
