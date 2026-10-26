import type {
  CostResolution,
  ProductOneToOneImageUsageAudit,
  TokenUsage,
  UsageTokenPricing,
} from "./types";

/**
 * Quick 261026 — custo PÓS-CHAMADA do Produto 1:1 com tokens REAIS do provider.
 *
 * Fórmula:
 *   custo = Σ(tokens de cada dimensão × tarifa da dimensão / 1.000.000)
 *
 * Dimensões:
 * - texto: entrada (menos cache textual), cache textual, saída textual;
 * - imagem: entrada (menos cache de imagem), cache de imagem, saída de imagem.
 *
 * Regras:
 * - `imageTokenUsdPer1M` é SAÍDA de imagem; `imageInputTokenUsdPer1M` é ENTRADA.
 * - cache só é rateado quando o breakdown textual/imagem é inequívoco.
 *   `cachedInputTokens` agregado (>0) sem split é ambíguo → custo parcial.
 * - zero explícito é válido; ausência de dimensão obrigatória não vira zero.
 * - `code_default` não é tarifa tabelada neste cálculo.
 * - `imageUnitCostUsd` (pré-chamada) NUNCA é usado aqui.
 */

export const PRODUCT_1_1_IMAGE_USAGE_FORMULA_VERSION =
  "product_1_1_image_usage_tokens_v1" as const;
export const PRODUCT_1_1_IMAGE_USAGE_COMPLETE_NOTE =
  "product_1_1_image_usage_tokens" as const;
export const PRODUCT_1_1_IMAGE_USAGE_PARTIAL_NOTE =
  "product_1_1_image_usage_tokens_partial" as const;

export interface ProductOneToOneImageUsageCost extends CostResolution {
  productOneToOneImageUsage: ProductOneToOneImageUsageAudit;
}

export interface CalculateProductOneToOneImageUsageCostParams {
  usage?: TokenUsage;
  pricing: UsageTokenPricing | null;
  pricingVersion: string | null;
  pricingSource: string | null;
  model: string;
  quality: string;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function hasUsage(usage?: TokenUsage): usage is TokenUsage {
  return (
    usage !== undefined &&
    (usage.promptTokens !== undefined ||
      usage.completionTokens !== undefined ||
      usage.inputTextTokens !== undefined ||
      usage.inputImageTokens !== undefined ||
      usage.outputTextTokens !== undefined ||
      usage.outputImageTokens !== undefined ||
      usage.cachedInputTokens !== undefined ||
      usage.cachedInputTextTokens !== undefined ||
      usage.cachedInputImageTokens !== undefined)
  );
}

function tokenOrNull(value: number | undefined): number | null {
  return value === undefined ? null : value;
}

export function calculateProductOneToOneImageUsageCost(
  params: CalculateProductOneToOneImageUsageCostParams,
): ProductOneToOneImageUsageCost {
  const { usage, model, quality } = params;
  const missing = new Set<string>();

  const usageBreakdown: ProductOneToOneImageUsageAudit["usageBreakdown"] =
    !hasUsage(usage)
      ? "absent"
      : usage.inputTextTokens !== undefined ||
          usage.inputImageTokens !== undefined ||
          usage.outputTextTokens !== undefined ||
          usage.outputImageTokens !== undefined ||
          usage.cachedInputTextTokens !== undefined ||
          usage.cachedInputImageTokens !== undefined
        ? "detailed"
        : "aggregate";

  let pricing = params.pricing;
  if (params.pricingSource === "code_default") {
    // Não é linha de ai_model_pricing; nunca usar como tarifa tabelada.
    pricing = null;
    missing.add("pricing_code_default");
  }
  if (pricing === null) missing.add("pricing");
  if (params.pricingVersion === null) missing.add("pricing_version");

  if (!hasUsage(usage)) {
    missing.add("usage");
    return buildResolution({
      params,
      pricing,
      inputTextTokens: null,
      cachedInputTextTokens: null,
      inputImageTokens: null,
      cachedInputImageTokens: null,
      outputTextTokens: null,
      outputImageTokens: null,
      textComponentUsd: null,
      imageComponentUsd: null,
      missing: [...missing],
      cacheMode: "none",
      usageBreakdown,
    });
  }

  // ── Tokens por dimensão (sem inferir separações ambíguas) ──────────────
  const inputTextTokens =
    usage.inputTextTokens !== undefined
      ? usage.inputTextTokens
      : usage.promptTokens !== undefined && usage.inputImageTokens !== undefined
        ? Math.max(0, usage.promptTokens - usage.inputImageTokens)
        : null;
  if (inputTextTokens === null) missing.add("input_text_tokens");

  const inputImageTokens = tokenOrNull(usage.inputImageTokens);
  if (inputImageTokens === null) missing.add("input_image_tokens");

  const outputImageTokens = tokenOrNull(usage.outputImageTokens);
  if (outputImageTokens === null) missing.add("output_image_tokens");

  // Saída textual é opcional em geração de imagem: só entra quando reportada
  // ou derivável de output_tokens - output_image_tokens.
  const outputTextTokens =
    usage.outputTextTokens !== undefined
      ? usage.outputTextTokens
      : usage.completionTokens !== undefined && usage.outputImageTokens !== undefined
        ? Math.max(0, usage.completionTokens - usage.outputImageTokens)
        : null;

  // ── Cache: só com modalidade inequívoca ─────────────────────────────────
  let cacheMode: ProductOneToOneImageUsageAudit["cacheMode"] = "none";
  let cachedInputTextTokens: number | null = 0;
  let cachedInputImageTokens: number | null = 0;

  const hasExplicitText = usage.cachedInputTextTokens !== undefined;
  const hasExplicitImage = usage.cachedInputImageTokens !== undefined;

  if (hasExplicitText && hasExplicitImage) {
    cacheMode = "explicit";
    cachedInputTextTokens = usage.cachedInputTextTokens ?? 0;
    cachedInputImageTokens = usage.cachedInputImageTokens ?? 0;
  } else if (hasExplicitText || hasExplicitImage) {
    // Apenas uma modalidade detalhada: a outra não pode ser inferida como zero.
    cacheMode = "ambiguous";
    missing.add("cache_modality_ambiguous");
    cachedInputTextTokens = usage.cachedInputTextTokens ?? null;
    cachedInputImageTokens = usage.cachedInputImageTokens ?? null;
  } else if (usage.cachedInputTokens !== undefined) {
    if (usage.cachedInputTokens > 0) {
      cacheMode = "ambiguous";
      missing.add("cache_modality_ambiguous");
      cachedInputTextTokens = null;
      cachedInputImageTokens = null;
    } else {
      cacheMode = "none";
      cachedInputTextTokens = 0;
      cachedInputImageTokens = 0;
    }
  }

  if (
    cachedInputTextTokens !== null &&
    inputTextTokens !== null &&
    cachedInputTextTokens > inputTextTokens
  ) {
    missing.add("cache_exceeds_input_text");
  }
  if (
    cachedInputImageTokens !== null &&
    inputImageTokens !== null &&
    cachedInputImageTokens > inputImageTokens
  ) {
    missing.add("cache_exceeds_input_image");
  }

  const uncachedText =
    inputTextTokens !== null && cachedInputTextTokens !== null
      ? Math.max(0, inputTextTokens - cachedInputTextTokens)
      : null;
  const uncachedImage =
    inputImageTokens !== null && cachedInputImageTokens !== null
      ? Math.max(0, inputImageTokens - cachedInputImageTokens)
      : null;

  // ── Componentes (texto e imagem separados) ──────────────────────────────
  const textMissing = new Set<string>();
  if (inputTextTokens === null) textMissing.add("input_text_tokens");
  if (uncachedText !== null && uncachedText > 0 && pricing?.inputCostUsd == null) {
    textMissing.add("text_input_rate");
  }
  if (
    cachedInputTextTokens !== null &&
    cachedInputTextTokens > 0 &&
    pricing?.cachedInputCostUsd == null
  ) {
    textMissing.add("text_cache_rate");
  }
  if (outputTextTokens !== null && outputTextTokens > 0 && pricing?.outputCostUsd == null) {
    textMissing.add("text_output_rate");
  }

  const imageMissing = new Set<string>();
  if (inputImageTokens === null) imageMissing.add("input_image_tokens");
  if (outputImageTokens === null) imageMissing.add("output_image_tokens");
  if (
    uncachedImage !== null &&
    uncachedImage > 0 &&
    pricing?.imageInputTokenUsdPer1M == null
  ) {
    imageMissing.add("image_input_rate");
  }
  if (
    cachedInputImageTokens !== null &&
    cachedInputImageTokens > 0 &&
    pricing?.imageCachedInputTokenUsdPer1M == null
  ) {
    imageMissing.add("image_cache_rate");
  }
  if (
    outputImageTokens !== null &&
    outputImageTokens > 0 &&
    pricing?.imageTokenUsdPer1M == null
  ) {
    imageMissing.add("image_output_rate");
  }

  let textComponentUsd: number | null = null;
  if (textMissing.size === 0 && uncachedText !== null) {
    textComponentUsd = round6(
      (uncachedText / 1_000_000) * (pricing?.inputCostUsd ?? 0) +
        ((cachedInputTextTokens ?? 0) / 1_000_000) *
          (pricing?.cachedInputCostUsd ?? 0) +
        ((outputTextTokens ?? 0) / 1_000_000) * (pricing?.outputCostUsd ?? 0),
    );
  }

  let imageComponentUsd: number | null = null;
  if (imageMissing.size === 0 && uncachedImage !== null && outputImageTokens !== null) {
    imageComponentUsd = round6(
      (uncachedImage / 1_000_000) * (pricing?.imageInputTokenUsdPer1M ?? 0) +
        ((cachedInputImageTokens ?? 0) / 1_000_000) *
          (pricing?.imageCachedInputTokenUsdPer1M ?? 0) +
        (outputImageTokens / 1_000_000) * (pricing?.imageTokenUsdPer1M ?? 0),
    );
  }

  for (const item of textMissing) missing.add(item);
  for (const item of imageMissing) missing.add(item);

  return buildResolution({
    params,
    pricing,
    inputTextTokens,
    cachedInputTextTokens,
    inputImageTokens,
    cachedInputImageTokens,
    outputTextTokens,
    outputImageTokens,
    textComponentUsd,
    imageComponentUsd,
    missing: [...missing],
    cacheMode,
    usageBreakdown,
  });
}

function buildResolution(input: {
  params: CalculateProductOneToOneImageUsageCostParams;
  pricing: UsageTokenPricing | null;
  inputTextTokens: number | null;
  cachedInputTextTokens: number | null;
  inputImageTokens: number | null;
  cachedInputImageTokens: number | null;
  outputTextTokens: number | null;
  outputImageTokens: number | null;
  textComponentUsd: number | null;
  imageComponentUsd: number | null;
  missing: string[];
  cacheMode: ProductOneToOneImageUsageAudit["cacheMode"];
  usageBreakdown: ProductOneToOneImageUsageAudit["usageBreakdown"];
}): ProductOneToOneImageUsageCost {
  const {
    params,
    pricing,
    inputTextTokens,
    cachedInputTextTokens,
    inputImageTokens,
    cachedInputImageTokens,
    outputTextTokens,
    outputImageTokens,
    textComponentUsd,
    imageComponentUsd,
    missing,
    cacheMode,
    usageBreakdown,
  } = input;

  const complete =
    missing.length === 0 && textComponentUsd !== null && imageComponentUsd !== null;
  const coverage: ProductOneToOneImageUsageAudit["coverage"] = complete
    ? "complete"
    : textComponentUsd !== null || imageComponentUsd !== null
      ? "partial"
      : "unknown";

  const estimatedCostUsd =
    complete && textComponentUsd !== null && imageComponentUsd !== null
      ? round6(textComponentUsd + imageComponentUsd)
      : null;

  const audit: ProductOneToOneImageUsageAudit = {
    origin: "usage_tokens",
    formulaVersion: PRODUCT_1_1_IMAGE_USAGE_FORMULA_VERSION,
    pricingVersion: params.pricingVersion,
    pricingSource: params.pricingSource,
    model: params.model,
    quality: params.quality,
    inputTextTokens,
    cachedInputTextTokens,
    inputImageTokens,
    cachedInputImageTokens,
    outputTextTokens,
    outputImageTokens,
    textComponentUsd,
    imageComponentUsd,
    coverage,
    missing,
    cacheMode,
    usageBreakdown,
  };

  return {
    estimatedCostUsd,
    costSource: complete ? "pricing_table" : "not_available",
    pricingVersion: params.pricingVersion,
    costFormulaVersion: PRODUCT_1_1_IMAGE_USAGE_FORMULA_VERSION,
    costEstimationNote: complete
      ? PRODUCT_1_1_IMAGE_USAGE_COMPLETE_NOTE
      : PRODUCT_1_1_IMAGE_USAGE_PARTIAL_NOTE,
    ...(textComponentUsd !== null ? { textComponentUsd } : {}),
    ...(imageComponentUsd !== null
      ? { imageToolComponentUsd: imageComponentUsd }
      : {}),
    ...(pricing
      ? {
          imageToolPricingProvider: "openai",
          imageToolPricingModel: params.model,
          imageToolPricingVersion: params.pricingVersion ?? undefined,
        }
      : {}),
    productOneToOneImageUsage: audit,
  };
}
