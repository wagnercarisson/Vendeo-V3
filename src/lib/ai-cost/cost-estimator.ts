import "server-only";
import type { CostResolution, TokenUsage } from "./types";
import { getModelPricing } from "./ai-model-pricing";
import type { ModelPricing } from "./ai-model-pricing";

/**
 * Strip de sufixo de data para lookup de preço (mantido de cost-estimator.ts:50-52):
 *   gpt-4o-2024-08-06       -> gpt-4o
 *   gpt-5.5-2026-04-23      -> gpt-5.5
 * Aplicado na BUSCA de pricing (tabela + bootstrap) — a tabela seeda só modelos base.
 */
function normalizeModel(model: string): string {
  return model.replace(/(-\d{4}-\d{2}-\d{2})+$/g, "");
}

/**
 * Fallback estático (D9 — fonte 4): controlado por VENDEO_AI_FALLBACK_COST_USD
 * (default 0.15) com compat retroativa com VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD.
 * Valores inválidos → default 0.15 (parse numérico com validação — T-38.1-20).
 * Os dois envs não se misturam com a cópia legada (legacy-estimator.ts lê só o antigo).
 */
function getFallbackCost(): number {
  const raw =
    process.env.VENDEO_AI_FALLBACK_COST_USD ?? process.env.VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD;
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 0.15;
}

/**
 * Fallback explicitamente desabilitado (D4 — caminho not_available): env setado para
 * "0"/"none"/"disabled"/"off" → sem preço/config → custo desconhecido (tokens
 * preservados, estimatedCostUsd null). Demais valores inválidos caem no default 0.15.
 */
function isFallbackDisabled(): boolean {
  const raw =
    process.env.VENDEO_AI_FALLBACK_COST_USD ?? process.env.VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD;
  const normalized = (raw ?? "").trim().toLowerCase();
  return normalized === "0" || normalized === "none" || normalized === "disabled" || normalized === "off";
}

function hasUsableUsage(usage?: TokenUsage): boolean {
  return (
    usage !== undefined &&
    (usage.promptTokens !== undefined ||
      usage.completionTokens !== undefined ||
      usage.imageTokens !== undefined)
  );
}

/**
 * Cálculo por tokens — aplica `?? 0` ANTES de multiplicar (dimensões opcionais:
 * ModelPricing pode ter só imageUnitCostUsd). NUNCA escrever `X/1M * inputCostUsd ?? 0`
 * (aplica o default só depois da multiplicação → NaN quando a dimensão está ausente).
 */
function calculateTokenCost(usage: TokenUsage, pricing: ModelPricing): number {
  const promptTokens = usage.promptTokens ?? 0;
  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const completionTokens = usage.completionTokens ?? 0;
  const imageTokens = usage.imageTokens ?? 0;
  const uncachedPromptTokens = Math.max(0, promptTokens - cachedInputTokens);
  const cost =
    (uncachedPromptTokens / 1_000_000) * (pricing.inputCostUsd ?? 0) +
    (cachedInputTokens / 1_000_000) * (pricing.cachedInputCostUsd ?? 0) +
    (completionTokens / 1_000_000) * (pricing.outputCostUsd ?? 0) +
    (imageTokens / 1_000_000) * (pricing.imageTokenUsdPer1M ?? 0);
  return Number(cost.toFixed(6));
}

/**
 * Resolvedor definitivo de custo de uma chamada de IA (D9) — NUNCA retorna null
 * (furo 1 sanado): sempre um CostResolution com cost_source de 5 valores (D4).
 *
 * Consumidores: os serviços onCall (38-1-05/06) e a rota generate-image (38-1-07)
 * chamam `resolveAiCost` para gravar o custo real por chamada via AiCostTracker.
 *
 * Cadeia de fontes (ordem rígida):
 *   1. provider_reported  — provider entregou custo financeiro direto (D3)
 *   2. manual_unknown     — custo inserido/ajustado manualmente (D4)
 *   3. pricing_table      — linha vigente ai_model_pricing (uuid) ou bootstrap
 *                           DEFAULT_AI_MODEL_PRICING ("code_default" — D8)
 *   4. fallback_static    — valor estático configurado (env, default 0.15)
 *   5. not_available      — sem usage E sem preço/config → custo NULL, tokens preservados
 */
export async function resolveAiCost(params: {
  provider: string;
  model: string;
  usage?: TokenUsage;
  providerReportedCostUsd?: number | null;
  manualCostUsd?: number | null; // D4 — ajuste manual sem origem automática
}): Promise<CostResolution> {
  const { provider, model, usage, providerReportedCostUsd, manualCostUsd } = params;

  // Fonte 1: provider_reported (D3) — nunca sobrescrito pelo cálculo interno
  if (typeof providerReportedCostUsd === "number" && !Number.isNaN(providerReportedCostUsd)) {
    return {
      estimatedCostUsd: providerReportedCostUsd,
      providerReportedCostUsd,
      costSource: "provider_reported",
    };
  }

  // Fonte 2: manual_unknown (D4) — custo definido manualmente sem origem automática
  if (typeof manualCostUsd === "number" && !Number.isNaN(manualCostUsd)) {
    return { estimatedCostUsd: manualCostUsd, costSource: "manual_unknown" };
  }

  // Fonte 3: pricing_table — linha vigente (uuid) ou bootstrap de código ("code_default")
  const pricingResult = await getModelPricing({ provider, model: normalizeModel(model) });
  if (pricingResult) {
    const { pricing, versionId } = pricingResult;

    // 3a. Usage disponível → cálculo por tokens (prompt/output/cached/image — D9)
    if (hasUsableUsage(usage)) {
      return {
        estimatedCostUsd: calculateTokenCost(usage!, pricing),
        costSource: "pricing_table",
        pricingVersion: versionId,
      };
    }

    // 3b. Sem usage + dimensão de imagem (gpt-image-2/dall-e-3) → custo por imagem
    if (pricing.imageUnitCostUsd !== undefined) {
      return {
        estimatedCostUsd: pricing.imageUnitCostUsd,
        costSource: "pricing_table",
        pricingVersion: versionId,
      };
    }

    // Modelo de texto com pricing conhecido mas SEM usage → não computável → cai para fallback
  }

  // Fonte 4: fallback_static (valor estático configurado — env, default 0.15)
  if (!isFallbackDisabled()) {
    return { estimatedCostUsd: getFallbackCost(), costSource: "fallback_static" };
  }

  // Fonte 5: not_available — sem usage E sem preço/config → custo desconhecido
  // (tokens ainda gravados pelo tracker — D4)
  return { estimatedCostUsd: null, costSource: "not_available" };
}
