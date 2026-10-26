import "server-only";
import type { ModelPricing } from "./ai-model-pricing";
import type { CostResolution, TokenUsage } from "./types";
import {
  VISUAL_SIGNATURE_IMAGE_COST_FORMULA_VERSION,
  VISUAL_SIGNATURE_IMAGE_ESTIMATE_COMPLETE_NOTE,
  VISUAL_SIGNATURE_IMAGE_ESTIMATE_PARTIAL_NOTE,
  VISUAL_SIGNATURE_IMAGE_USAGE_APPROVED_AT,
  VISUAL_SIGNATURE_IMAGE_USAGE_ESTIMATE_VERSION,
  VISUAL_SIGNATURE_IMAGE_USAGE_ORIGIN,
  getVisualSignatureImageUsageEstimate,
  type VisualSignatureImageEstimateCoverage,
  type VisualSignatureImageUsageAudit,
  type VisualSignatureImageUsageEstimate,
  type VisualSignatureImageUsageTarget,
} from "./visual-signature-image-usage";

export {
  VISUAL_SIGNATURE_IMAGE_COST_FORMULA_VERSION,
  VISUAL_SIGNATURE_IMAGE_ESTIMATE_COMPLETE_NOTE,
  VISUAL_SIGNATURE_IMAGE_ESTIMATE_PARTIAL_NOTE,
};

/**
 * Cálculo de custo da imagem da Assinatura Visual nas NOVAS gerações cobertas
 * pela configuração dedicada (`visual_signature_model_config`).
 *
 * Fórmula (v1):
 *   estimated_cost_usd =
 *     componente_texto_orquestrador (tokens REAIS do provider)
 *     + componente_estimado_imagem (tokens estimados de vs-image-usage-v1)
 *
 * Regras financeiras:
 * - tarifas vêm EXCLUSIVAMENTE de `ai_model_pricing` (linhas vigentes);
 * - entrada textual da imagem usa `input_token_usd_per_1m`;
 * - saída de imagem usa `image_token_usd_per_1m` (NUNCA
 *   `input_token_usd_per_1m` como entrada de imagem e NUNCA
 *   `output_token_usd_per_1m` como saída de imagem);
 * - `image_unit_usd` NÃO é usado neste cálculo (não é o componente por token);
 * - `provider_reported_cost_usd` NÃO é usado nem preenchido por este caminho;
 * - o componente genérico de US$ 0,065 (`responses:image_generation`) NÃO é
 *   somado quando este caminho está ativo;
 * - tarifa/dimensão ausente ⇒ estimativa parcial/desconhecida, sem inventar
 *   zero e sem cair silenciosamente na cadeia legada;
 * - os tokens REAIS do provider continuam intactos nos campos atuais — as
 *   médias estimadas ficam apenas no metadata de auditoria.
 */

export interface VisualSignatureImageCostCalculation extends CostResolution {
  visualSignatureImageUsage: VisualSignatureImageUsageAudit;
}

interface PricingVersionPair {
  orchestrator: string | null;
  image: string | null;
}

interface CalculateParams {
  provider: string;
  target: VisualSignatureImageUsageTarget;
  estimate: VisualSignatureImageUsageEstimate | null;
  orchestratorPricing: ModelPricing | null;
  imagePricing: ModelPricing | null;
  usage?: TokenUsage;
  pricingVersions: PricingVersionPair;
  /** A imagem foi gerada com sucesso nesta chamada? */
  imageGenerated: boolean;
}

/** Normalização local de sufixo de data (mesmo contrato do estimador legado). */
function normalizeModel(model: string): string {
  return model.replace(/(-\d{4}-\d{2}-\d{2})+$/g, "");
}

function hasUsage(usage?: TokenUsage): usage is TokenUsage {
  return (
    usage !== undefined &&
    (usage.promptTokens !== undefined ||
      usage.completionTokens !== undefined ||
      usage.inputTextTokens !== undefined ||
      usage.outputTextTokens !== undefined ||
      usage.inputImageTokens !== undefined ||
      usage.outputImageTokens !== undefined)
  );
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * Componente do orquestrador calculado com os tokens REAIS do provider,
 * excluindo os tokens de imagem quando o breakdown granular existe (eles são
 * substituídos pelo componente estimado da imagem).
 *
 * Cache NÃO é contado duas vezes: `cached_tokens` é um subconjunto da entrada
 * reportada e é descontado da tarifa normal antes de ser cobrado pela tarifa de
 * cache, em ambos os formatos (detalhado e agregado).
 *
 * Ausência de uma dimensão de usage NÃO vira zero: se a entrada ou a saída não
 * foram reportadas (e não podem ser derivadas com segurança), o componente
 * textual fica desconhecido (`orchestrator_*_usage`) em vez de "completo".
 */
function calculateOrchestratorTextComponent(
  usage: TokenUsage,
  pricing: ModelPricing,
  imageGenerated: boolean,
): { usd: number | null; missing: string[] } {
  const missing: string[] = [];

  let inputTextTokens: number;
  if (usage.inputTextTokens !== undefined) {
    inputTextTokens = usage.inputTextTokens;
  } else if (usage.promptTokens !== undefined) {
    inputTextTokens = Math.max(0, usage.promptTokens - (usage.inputImageTokens ?? 0));
  } else {
    missing.push("orchestrator_input_usage");
    inputTextTokens = 0;
  }

  let outputTextTokens: number;
  if (usage.outputTextTokens !== undefined) {
    outputTextTokens = usage.outputTextTokens;
  } else if (usage.completionTokens !== undefined) {
    if (usage.outputImageTokens !== undefined) {
      outputTextTokens = Math.max(0, usage.completionTokens - usage.outputImageTokens);
    } else if (!imageGenerated) {
      // Sem imagem gerada, a saída reportada é textual.
      outputTextTokens = usage.completionTokens;
    } else {
      // Com imagem gerada e sem breakdown, não é possível separar texto/imagem.
      missing.push("orchestrator_output_usage");
      outputTextTokens = 0;
    }
  } else {
    missing.push("orchestrator_output_usage");
    outputTextTokens = 0;
  }

  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const uncachedInputTextTokens = Math.max(0, inputTextTokens - cachedInputTokens);

  if (uncachedInputTextTokens > 0 && pricing.inputCostUsd == null) {
    missing.push("orchestrator_input");
  }
  if (cachedInputTokens > 0 && pricing.cachedInputCostUsd == null) {
    missing.push("orchestrator_cached");
  }
  if (outputTextTokens > 0 && pricing.outputCostUsd == null) missing.push("orchestrator_output");

  if (missing.length > 0) return { usd: null, missing };

  const usd =
    (uncachedInputTextTokens / 1_000_000) * (pricing.inputCostUsd ?? 0) +
    (cachedInputTokens / 1_000_000) * (pricing.cachedInputCostUsd ?? 0) +
    (outputTextTokens / 1_000_000) * (pricing.outputCostUsd ?? 0);

  return { usd: round6(usd), missing };
}

/**
 * Cálculo puro (sem I/O) dos componentes. Exportado para testes offline com
 * fixtures de tarifa; a resolução assíncrona (leitura de `ai_model_pricing`)
 * fica em `resolveVisualSignatureImageCost`.
 */
export function calculateVisualSignatureImageCost(
  params: CalculateParams,
): VisualSignatureImageCostCalculation {
  const {
    provider,
    target,
    estimate,
    orchestratorPricing,
    imagePricing,
    usage,
    pricingVersions,
    imageGenerated,
  } = params;

  const missing: string[] = [];

  const usageBreakdown: VisualSignatureImageUsageAudit["usageBreakdown"] =
    usage === undefined
      ? "absent"
      : usage.inputImageTokens !== undefined || usage.outputImageTokens !== undefined
        ? "detailed"
        : "aggregate";

  let textComponentUsd: number | null = null;
  if (!hasUsage(usage)) {
    missing.push("orchestrator_usage");
  } else if (orchestratorPricing === null) {
    missing.push("orchestrator_pricing");
  } else {
    const text = calculateOrchestratorTextComponent(usage, orchestratorPricing, imageGenerated);
    textComponentUsd = text.usd;
    missing.push(...text.missing);
  }

  let imageComponentUsd: number | null = null;
  if (estimate === null) {
    missing.push("image_usage_estimate");
  } else if (!imageGenerated) {
    missing.push("image_not_generated");
  } else if (imagePricing === null) {
    missing.push("image_pricing");
  } else {
    const missingImageRates: string[] = [];
    if (estimate.inputTextTokens > 0 && imagePricing.inputCostUsd == null) {
      missingImageRates.push("image_input_text");
    }
    if (estimate.outputImageTokens > 0 && imagePricing.imageTokenUsdPer1M == null) {
      missingImageRates.push("image_output_image");
    }
    missing.push(...missingImageRates);

    if (missingImageRates.length === 0) {
      imageComponentUsd = round6(
        (estimate.inputTextTokens / 1_000_000) * (imagePricing.inputCostUsd ?? 0) +
          (estimate.outputImageTokens / 1_000_000) * (imagePricing.imageTokenUsdPer1M ?? 0),
      );
    }
  }

  const complete =
    missing.length === 0 && textComponentUsd !== null && imageComponentUsd !== null;
  const coverage: VisualSignatureImageEstimateCoverage = complete
    ? "complete"
    : textComponentUsd !== null || imageComponentUsd !== null
      ? "partial"
      : "unknown";

  const estimatedCostUsd =
    complete && textComponentUsd !== null && imageComponentUsd !== null
      ? round6(textComponentUsd + imageComponentUsd)
      : null;

  const audit: VisualSignatureImageUsageAudit = {
    origin: VISUAL_SIGNATURE_IMAGE_USAGE_ORIGIN,
    estimated: true,
    estimateVersion: VISUAL_SIGNATURE_IMAGE_USAGE_ESTIMATE_VERSION,
    approvedAt: VISUAL_SIGNATURE_IMAGE_USAGE_APPROVED_AT,
    model: target.imageModel,
    quality: target.imageQuality,
    size: target.size,
    configVersionId: target.configVersionId ?? null,
    inputTextTokens: estimate?.inputTextTokens ?? null,
    outputImageTokens: estimate?.outputImageTokens ?? null,
    imagePricingVersion: pricingVersions.image,
    orchestratorPricingVersion: pricingVersions.orchestrator,
    imageInputTextUsdPer1M: imagePricing?.inputCostUsd ?? null,
    imageOutputImageUsdPer1M: imagePricing?.imageTokenUsdPer1M ?? null,
    imageComponentUsd,
    textComponentUsd,
    coverage,
    missing,
    usageBreakdown,
  };

  const resolution: VisualSignatureImageCostCalculation = {
    estimatedCostUsd,
    costSource: complete ? "pricing_table" : "not_available",
    // Mantém o endereço da tarifa do componente textual (mesma semântica de
    // `pricing_version` da cadeia legada); a versão da imagem vai no metadata.
    pricingVersion: pricingVersions.orchestrator ?? pricingVersions.image ?? null,
    costFormulaVersion: VISUAL_SIGNATURE_IMAGE_COST_FORMULA_VERSION,
    costEstimationNote: complete
      ? VISUAL_SIGNATURE_IMAGE_ESTIMATE_COMPLETE_NOTE
      : VISUAL_SIGNATURE_IMAGE_ESTIMATE_PARTIAL_NOTE,
    ...(textComponentUsd !== null ? { textComponentUsd } : {}),
    ...(imageComponentUsd !== null ? { imageToolComponentUsd: imageComponentUsd } : {}),
    imageToolPricingProvider: provider,
    imageToolPricingModel: target.imageModel,
    ...(pricingVersions.image !== null
      ? { imageToolPricingVersion: pricingVersions.image }
      : {}),
    visualSignatureImageUsage: audit,
  };

  return resolution;
}

export interface ResolveVisualSignatureImageCostParams {
  provider: string;
  /** Modelo real do orquestrador que executou a chamada (envelope.model). */
  orchestratorModel: string;
  usage?: TokenUsage;
  target: VisualSignatureImageUsageTarget;
  /** `false` em falha/timeout: não estima saída de imagem que não foi gerada. */
  imageGenerated: boolean;
}

/**
 * Resolve o custo da imagem da Assinatura Visual a partir das tarifas vigentes
 * de `ai_model_pricing` e da estimativa versionada. Não lança: ausência de
 * tarifa vira custo parcial/desconhecido (nunca bloqueia a geração).
 */
export async function resolveVisualSignatureImageCost(
  params: ResolveVisualSignatureImageCostParams,
): Promise<VisualSignatureImageCostCalculation> {
  const { provider, orchestratorModel, usage, target, imageGenerated } = params;

  // Import tardio: mantém o módulo puro importável por testes/consumidores que
  // não resolvem custo (o client Supabase só é carregado no caminho real).
  const { getModelPricing } = await import("./ai-model-pricing");

  const estimate = getVisualSignatureImageUsageEstimate(target);

  let orchestratorPricing: ModelPricing | null = null;
  let orchestratorPricingVersion: string | null = null;
  try {
    const result = await getModelPricing({
      provider,
      model: normalizeModel(orchestratorModel),
    });
    // Fonte exclusiva deste caminho = tabela `ai_model_pricing`. O bootstrap de
    // código (`code_default`) NÃO é tarifa tabelada e vira indisponível somente
    // aqui; a cadeia legada continua aceitando-o normalmente.
    if (result && result.versionId !== "code_default") {
      orchestratorPricing = result.pricing;
      orchestratorPricingVersion = result.versionId;
    }
  } catch (err) {
    console.error(
      "[visual-signature-image-cost] orchestrator pricing unavailable:",
      err instanceof Error ? err.message : String(err),
    );
  }

  let imagePricing: ModelPricing | null = null;
  let imagePricingVersion: string | null = null;
  if (estimate) {
    try {
      const result = await getModelPricing({
        provider,
        model: estimate.model,
        quality: estimate.quality,
      });
      // Defensivo: com `quality` o leitor já não usa bootstrap, mas o caminho
      // novo nunca classifica `code_default` como tarifa tabelada.
      if (result && result.versionId !== "code_default") {
        imagePricing = result.pricing;
        imagePricingVersion = result.versionId;
      }
    } catch (err) {
      console.error(
        "[visual-signature-image-cost] image pricing unavailable:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return calculateVisualSignatureImageCost({
    provider,
    target,
    estimate,
    orchestratorPricing,
    imagePricing,
    usage,
    pricingVersions: {
      orchestrator: orchestratorPricingVersion,
      image: imagePricingVersion,
    },
    imageGenerated,
  });
}
