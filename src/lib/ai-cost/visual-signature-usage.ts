import type { TokenUsage } from "./types";

/**
 * F47.1 (D8) — normalização de usage e custo da Assinatura Visual.
 *
 * Módulo PURO (sem I/O). Regras invioláveis:
 * - `R` (reasoning) é subconjunto de `O`; nunca somado novamente.
 * - `C` (cache) é subconjunto de `I`; nunca somado novamente.
 * - tokens de imagem são excluídos do texto e precificados uma única vez.
 * - breakdown só é utilizado quando a soma é compatível com o total.
 * - ausência de dado/tarifa NUNCA vira zero silencioso nem total inventado.
 * - tarifas do orquestrador (texto) e da imagem/tool são SEPARADAS.
 *
 * As fórmulas A–E do design são aplicadas conforme o formato confirmado.
 */

export type VisualSignatureCostCoverage = "complete" | "partial" | "unknown";
export type VisualSignatureCostSource =
  | "pricing_table"
  | "provider_reported"
  | "not_available";

/** Tarifas de TEXTO do orquestrador (GPT-5.5/Luna). */
export interface VisualSignatureOrchestratorRates {
  inputTextUsdPer1M?: number;
  outputTextUsdPer1M?: number;
  cachedTextUsdPer1M?: number;
}

/**
 * Tarifas de IMAGEM/TOOL. `imageTokenUsdPer1M` é a ÚNICA tarifa de imagem
 * disponível no schema atual; ela só é aplicada quando a direção do usage é
 * inequívoca. Entrada e saída simultâneas exigem tarifas separadas explícitas.
 */
export interface VisualSignatureImageRates {
  imageTokenUsdPer1M?: number;
  inputImageUsdPer1M?: number;
  outputImageUsdPer1M?: number;
  cachedImageUsdPer1M?: number;
}

export interface NormalizedVisualSignatureUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  reasoningExcludedFromOutput: boolean;
  inputTextTokens?: number;
  inputImageTokens?: number;
  outputTextTokens?: number;
  outputImageTokens?: number;
  cachedTextTokens?: number;
  cachedImageTokens?: number;
  inputBreakdown: "complete" | "incomplete" | "inconsistent" | "absent";
  outputBreakdown: "complete" | "incomplete" | "inconsistent" | "absent";
  cacheAttribution: "attributed" | "unattributed" | "absent";
  /** Usage bruto sanitizado (referência, sem chaves/prompt). */
  raw: TokenUsage;
  notes: string[];
  /** Inconsistências que impedem cobertura `complete`. */
  inconsistent: boolean;
}

export interface VisualSignatureCostComponent {
  tokens: number;
  usd: number | null;
}

export interface VisualSignatureCostResult {
  estimatedCostUsd: number | null;
  providerReportedCostUsd?: number | null;
  costCoverage: VisualSignatureCostCoverage;
  costSource: VisualSignatureCostSource;
  costEstimationNote: string | null;
  components: Record<string, VisualSignatureCostComponent>;
  missingRates: string[];
  formula: "A" | "B" | "C" | "D" | "E" | null;
}

export interface ComputeVisualSignatureCostParams {
  usage?: TokenUsage;
  orchestratorRates: VisualSignatureOrchestratorRates;
  imageRates: VisualSignatureImageRates;
  providerReportedCostUsd?: number | null;
  /** Usage próprio da tool, quando o provider expõe separadamente. */
  imageToolUsage?: TokenUsage;
  /** Referência histórica quality-aware, apenas por falta de usage. */
  historicalEstimateUsd?: number | null;
  historicalEstimateSource?: string;
  preset?: string | null;
}

const INCONSISTENCY_NOTES = [
  "reasoning_exceeds_output",
  "cached_input_exceeds_input",
  "cached_text_exceeds_input_text",
  "cached_image_exceeds_input_image",
  "input_breakdown_inconsistent",
  "output_breakdown_inconsistent",
] as const;

function nonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isPositive(value: number | undefined): value is number {
  return value !== undefined && value > 0;
}

function ratePresent(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function money(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * Normaliza o usage bruto e classifica o breakdown. Nunca lança: entradas
 * inconsistentes são marcadas para que a cobertura seja parcial/desconhecida.
 */
export function normalizeVisualSignatureUsage(raw: TokenUsage | undefined): NormalizedVisualSignatureUsage {
  const notes: string[] = [];
  const inputTokens = nonNegative(raw?.promptTokens);
  const outputTokens = nonNegative(raw?.completionTokens);
  const cachedInputTokens = nonNegative(raw?.cachedInputTokens);
  const reasoningTokens = nonNegative(raw?.reasoningTokens);
  const reasoningExcludedFromOutput = raw?.reasoningExcludedFromOutput === true;

  let inputTextTokens = nonNegative(raw?.inputTextTokens);
  let inputImageTokens = nonNegative(raw?.inputImageTokens);
  let outputTextTokens = nonNegative(raw?.outputTextTokens);
  let outputImageTokens = nonNegative(raw?.outputImageTokens);
  let cachedTextTokens = nonNegative(raw?.cachedTextTokens);
  let cachedImageTokens = nonNegative(raw?.cachedImageTokens);
  let inconsistent = false;

  // Compatibilidade com o campo legado `imageTokens` (output image tokens).
  if (outputImageTokens === undefined) {
    outputImageTokens = nonNegative(raw?.imageTokens);
  }

  // Cache total sem atribuição: não inventa divisão texto/imagem.
  if (cachedInputTokens !== undefined && cachedTextTokens === undefined && cachedImageTokens === undefined) {
    const cached = raw?.cachedInputTokens;
    if (cached !== undefined && cachedInputTokens !== cached) {
      notes.push("cached_input_tokens_normalized");
    }
  }

  if (cachedInputTokens !== undefined && cachedTextTokens !== undefined && cachedImageTokens === undefined) {
    cachedImageTokens = Math.max(0, cachedInputTokens - cachedTextTokens);
  }
  if (cachedInputTokens !== undefined && cachedImageTokens !== undefined && cachedTextTokens === undefined) {
    cachedTextTokens = Math.max(0, cachedInputTokens - cachedImageTokens);
  }

  let inputBreakdown: NormalizedVisualSignatureUsage["inputBreakdown"] = "absent";
  if (inputTextTokens !== undefined || inputImageTokens !== undefined) {
    if (inputTextTokens === undefined || inputImageTokens === undefined) {
      inputBreakdown = "incomplete";
      notes.push("input_breakdown_incomplete");
    } else if (inputTokens === undefined) {
      inputBreakdown = "incomplete";
      notes.push("input_total_missing");
    } else if (inputTextTokens + inputImageTokens > inputTokens) {
      inputBreakdown = "inconsistent";
      inconsistent = true;
      notes.push("input_breakdown_inconsistent");
      inputTextTokens = undefined;
      inputImageTokens = undefined;
    } else {
      inputBreakdown = "complete";
      if (inputTextTokens + inputImageTokens < inputTokens) {
        notes.push("input_breakdown_leaves_unattributed_tokens");
      }
    }
  }

  let outputBreakdown: NormalizedVisualSignatureUsage["outputBreakdown"] = "absent";
  if (outputTextTokens !== undefined || outputImageTokens !== undefined) {
    if (outputTextTokens === undefined || outputImageTokens === undefined) {
      outputBreakdown = "incomplete";
      notes.push("output_breakdown_incomplete");
    } else if (outputTokens === undefined) {
      outputBreakdown = "incomplete";
      notes.push("output_total_missing");
    } else if (outputTextTokens + outputImageTokens > outputTokens) {
      outputBreakdown = "inconsistent";
      inconsistent = true;
      notes.push("output_breakdown_inconsistent");
      outputTextTokens = undefined;
      outputImageTokens = undefined;
    } else {
      outputBreakdown = "complete";
      if (outputTextTokens + outputImageTokens < outputTokens) {
        notes.push("output_breakdown_leaves_unattributed_tokens");
      }
    }
  }

  // Reasoning é subconjunto de output. Se o provider declarar explicitamente
  // que está fora, isso é registrado; caso contrário, R > O é inconsistência.
  if (
    reasoningTokens !== undefined &&
    outputTokens !== undefined &&
    !reasoningExcludedFromOutput &&
    reasoningTokens > outputTokens
  ) {
    notes.push("reasoning_exceeds_output");
    inconsistent = true;
  }

  if (cachedInputTokens !== undefined && inputTokens !== undefined && cachedInputTokens > inputTokens) {
    notes.push("cached_input_exceeds_input");
    inconsistent = true;
  }

  if (
    cachedTextTokens !== undefined &&
    inputTextTokens !== undefined &&
    cachedTextTokens > inputTextTokens
  ) {
    notes.push("cached_text_exceeds_input_text");
    inconsistent = true;
  }

  if (
    cachedImageTokens !== undefined &&
    inputImageTokens !== undefined &&
    cachedImageTokens > inputImageTokens
  ) {
    notes.push("cached_image_exceeds_input_image");
    inconsistent = true;
  }

  let cacheAttribution: NormalizedVisualSignatureUsage["cacheAttribution"] = "absent";
  if (cachedInputTokens !== undefined && cachedInputTokens > 0) {
    if (
      cachedTextTokens !== undefined &&
      cachedImageTokens !== undefined &&
      cachedTextTokens + cachedImageTokens === cachedInputTokens
    ) {
      cacheAttribution = "attributed";
    } else {
      cacheAttribution = "unattributed";
      cachedTextTokens = undefined;
      cachedImageTokens = undefined;
      notes.push("cache_attribution_missing");
    }
  }

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    reasoningTokens,
    reasoningExcludedFromOutput,
    inputTextTokens,
    inputImageTokens,
    outputTextTokens,
    outputImageTokens,
    cachedTextTokens,
    cachedImageTokens,
    inputBreakdown,
    outputBreakdown,
    cacheAttribution,
    raw: raw ?? {},
    notes,
    inconsistent: inconsistent || INCONSISTENCY_NOTES.some((note) => notes.includes(note)),
  };
}

function addComponent(
  components: Record<string, VisualSignatureCostComponent>,
  missingRates: string[],
  name: string,
  rateName: string,
  tokens: number,
  rate: number | undefined,
): number {
  if (!isPositive(tokens)) {
    components[name] = { tokens: 0, usd: 0 };
    return 0;
  }
  if (!ratePresent(rate)) {
    components[name] = { tokens, usd: null };
    missingRates.push(rateName);
    return 0;
  }
  const usd = (tokens / 1_000_000) * rate;
  components[name] = { tokens, usd: money(usd) };
  return usd;
}

function sumComponents(components: Record<string, VisualSignatureCostComponent>): number {
  return money(
    Object.values(components).reduce((total, component) => total + (component.usd ?? 0), 0),
  );
}

function hasAnyUsage(usage: NormalizedVisualSignatureUsage): boolean {
  return (
    isPositive(usage.inputTokens) ||
    isPositive(usage.outputTokens) ||
    isPositive(usage.cachedInputTokens) ||
    isPositive(usage.inputImageTokens) ||
    isPositive(usage.outputImageTokens)
  );
}

/**
 * Resolve as tarifas de imagem por direção. A tarifa única do schema só é
 * usada quando a direção é inequívoca. Com entrada E saída, a equivalência
 * precisa ser explícita (`inputImageUsdPer1M` + `outputImageUsdPer1M`).
 */
function resolveDirectionalImageRates(
  usage: NormalizedVisualSignatureUsage,
  rates: VisualSignatureImageRates,
): { input?: number; output?: number; unproven: boolean } {
  const hasInput = isPositive(usage.inputImageTokens);
  const hasOutput = isPositive(usage.outputImageTokens);

  if (hasInput && hasOutput) {
    if (ratePresent(rates.inputImageUsdPer1M) && ratePresent(rates.outputImageUsdPer1M)) {
      return { input: rates.inputImageUsdPer1M, output: rates.outputImageUsdPer1M, unproven: false };
    }
    return { unproven: true };
  }
  if (hasInput) {
    return {
      input: rates.inputImageUsdPer1M ?? rates.imageTokenUsdPer1M,
      unproven: false,
    };
  }
  if (hasOutput) {
    return {
      output: rates.outputImageUsdPer1M ?? rates.imageTokenUsdPer1M,
      unproven: false,
    };
  }
  return { unproven: false };
}

function toolTextOutputTokens(usage: NormalizedVisualSignatureUsage): number | undefined {
  if (usage.outputTextTokens !== undefined) return usage.outputTextTokens;
  if (usage.outputTokens !== undefined && usage.outputImageTokens !== undefined) {
    if (usage.outputImageTokens > usage.outputTokens) return undefined;
    return usage.outputTokens - usage.outputImageTokens;
  }
  if (usage.outputImageTokens === undefined) return usage.outputTokens;
  return undefined;
}

function toolTextInputTokens(usage: NormalizedVisualSignatureUsage): number | undefined {
  if (usage.inputTextTokens !== undefined) return usage.inputTextTokens;
  if (usage.inputTokens !== undefined && usage.inputImageTokens !== undefined) {
    if (usage.inputImageTokens > usage.inputTokens) return undefined;
    return usage.inputTokens - usage.inputImageTokens;
  }
  if (usage.inputImageTokens === undefined) return usage.inputTokens;
  return undefined;
}

/**
 * Aplica as fórmulas A–E. Retorna SEMPRE uma cobertura explícita.
 */
export function computeVisualSignatureCost(
  params: ComputeVisualSignatureCostParams,
): VisualSignatureCostResult {
  const usage = normalizeVisualSignatureUsage(params.usage);
  const toolUsage = params.imageToolUsage
    ? normalizeVisualSignatureUsage(params.imageToolUsage)
    : undefined;
  const providerReported =
    typeof params.providerReportedCostUsd === "number" &&
    Number.isFinite(params.providerReportedCostUsd) &&
    params.providerReportedCostUsd >= 0
      ? params.providerReportedCostUsd
      : undefined;

  const components: Record<string, VisualSignatureCostComponent> = {};
  const missingRates: string[] = [];
  const noteParts: string[] = [...usage.notes];

  const mainHasUsage = hasAnyUsage(usage);
  const toolHasUsage = toolUsage !== undefined && hasAnyUsage(toolUsage);

  let computedFormula: "A" | "B" | "C" | "E" = "B";
  let canBeComplete = false;
  let toolInconsistent = false;

  // Fórmula C: usage da tool só é precificado quando é a ÚNICA fonte. Com
  // usage principal presente, a exclusão NÃO é comprovável — nunca soma as
  // duas fontes.
  const toolOverlapUnproven = toolHasUsage && mainHasUsage;
  const toolIsSoleSource = toolHasUsage && !mainHasUsage;

  if (toolOverlapUnproven) {
    noteParts.push("tool_usage_overlap_unproven");
  } else if (toolIsSoleSource && toolUsage) {
    const toolRates = resolveDirectionalImageRates(toolUsage, params.imageRates);
    if (toolRates.unproven) {
      noteParts.push("image_rate_direction_unproven");
    }
    if (
      toolUsage.outputTokens !== undefined &&
      toolUsage.outputImageTokens !== undefined &&
      toolUsage.outputImageTokens > toolUsage.outputTokens
    ) {
      toolInconsistent = true;
      noteParts.push("tool_output_breakdown_inconsistent");
    }
    if (
      toolUsage.inputTokens !== undefined &&
      toolUsage.inputImageTokens !== undefined &&
      toolUsage.inputImageTokens > toolUsage.inputTokens
    ) {
      toolInconsistent = true;
      noteParts.push("tool_input_breakdown_inconsistent");
    }
    addComponent(
      components,
      missingRates,
      "tool_input_text",
      "orchestrator.inputTextUsdPer1M",
      toolTextInputTokens(toolUsage) ?? 0,
      params.orchestratorRates.inputTextUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "tool_output_text",
      "orchestrator.outputTextUsdPer1M",
      toolTextOutputTokens(toolUsage) ?? 0,
      params.orchestratorRates.outputTextUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "tool_input_image",
      "image.inputImageUsdPer1M",
      toolUsage.inputImageTokens ?? 0,
      toolRates.input,
    );
    addComponent(
      components,
      missingRates,
      "tool_output_image",
      "image.outputImageUsdPer1M",
      toolUsage.outputImageTokens ?? 0,
      toolRates.output,
    );
    noteParts.push("tool_usage_separate");
    computedFormula = "C";
    canBeComplete = !toolRates.unproven && !toolInconsistent;
  }

  const hasToolUsage =
    toolIsSoleSource &&
    Object.keys(components).some((key) => key.startsWith("tool_"));

  if (!mainHasUsage && !hasToolUsage) {
    // Fórmula E/D — sem usage suficiente: nenhuma tarifa é inventada.
    const note =
      params.historicalEstimateUsd != null
        ? [
            "visual_signature_image_estimate_no_usage",
            `historical_reference_usd=${params.historicalEstimateUsd}`,
            `historical_source=${params.historicalEstimateSource ?? "local_historical_images"}`,
            `preset=${params.preset ?? "unknown"}`,
          ].join(";")
        : "visual_signature_usage_unavailable";
    if (providerReported !== undefined) {
      return {
        estimatedCostUsd: null,
        providerReportedCostUsd: providerReported,
        costCoverage: "partial",
        costSource: "provider_reported",
        costEstimationNote: "provider_reported_cost_only",
        components,
        missingRates,
        formula: "D",
      };
    }
    return {
      estimatedCostUsd: null,
      providerReportedCostUsd: null,
      costCoverage: "partial",
      costSource: "not_available",
      costEstimationNote: note,
      components,
      missingRates,
      formula: "E",
    };
  }

  if (mainHasUsage) {
    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;
    const cachedInputTokens = usage.cachedInputTokens ?? 0;
    const reasoningInsideOutput =
      usage.reasoningTokens !== undefined &&
      usage.reasoningTokens > 0 &&
      !usage.reasoningExcludedFromOutput;

    // Reasoning fora do output: precificado UMA vez na tarifa de output.
    if (
      usage.reasoningTokens !== undefined &&
      usage.reasoningExcludedFromOutput &&
      usage.reasoningTokens > 0
    ) {
      addComponent(
        components,
        missingRates,
        "reasoning",
        "orchestrator.outputTextUsdPer1M",
        usage.reasoningTokens,
        params.orchestratorRates.outputTextUsdPer1M,
      );
      noteParts.push("reasoning_priced_outside_output");
    } else if (reasoningInsideOutput) {
      // Explicitamente NÃO adicionado: já está em outputTokens.
      noteParts.push("reasoning_included_in_output");
    }

    const hasCompleteBreakdown =
      usage.inputBreakdown === "complete" && usage.outputBreakdown === "complete";
    const imageRates = resolveDirectionalImageRates(usage, params.imageRates);
    const hasImageTokens =
      isPositive(usage.inputImageTokens) || isPositive(usage.outputImageTokens);

    if (hasCompleteBreakdown && usage.cacheAttribution !== "unattributed") {
      computedFormula = "A";
      canBeComplete = true;
      const cachedText = usage.cachedTextTokens ?? 0;
      const cachedImage = usage.cachedImageTokens ?? 0;
      if (imageRates.unproven) {
        noteParts.push("image_rate_direction_unproven");
      }
      addComponent(
        components,
        missingRates,
        "input_text",
        "orchestrator.inputTextUsdPer1M",
        Math.max(0, (usage.inputTextTokens ?? 0) - cachedText),
        params.orchestratorRates.inputTextUsdPer1M,
      );
      addComponent(
        components,
        missingRates,
        "cached_text",
        "orchestrator.cachedTextUsdPer1M",
        cachedText,
        params.orchestratorRates.cachedTextUsdPer1M,
      );
      addComponent(
        components,
        missingRates,
        "input_image",
        "image.inputImageUsdPer1M",
        Math.max(0, (usage.inputImageTokens ?? 0) - cachedImage),
        imageRates.input,
      );
      addComponent(
        components,
        missingRates,
        "cached_image",
        "image.cachedImageUsdPer1M",
        cachedImage,
        params.imageRates.cachedImageUsdPer1M,
      );
      addComponent(
        components,
        missingRates,
        "output_text",
        "orchestrator.outputTextUsdPer1M",
        usage.outputTextTokens ?? 0,
        params.orchestratorRates.outputTextUsdPer1M,
      );
      addComponent(
        components,
        missingRates,
        "output_image",
        "image.outputImageUsdPer1M",
        usage.outputImageTokens ?? 0,
        imageRates.output,
      );
    } else if (hasImageTokens && usage.cacheAttribution === "unattributed") {
      // Cache sem modalidade: NÃO distribui a parcela para texto/imagem.
      // Componentes de ENTRADA ficam sem preço; saída confirmada continua.
      computedFormula = "E";
      canBeComplete = false;
      noteParts.push("cache_attribution_missing_input_unpriced");
      if (imageRates.unproven) {
        noteParts.push("image_rate_direction_unproven");
      }
      addComponent(
        components,
        missingRates,
        "output_text",
        "orchestrator.outputTextUsdPer1M",
        usage.outputTextTokens ?? 0,
        params.orchestratorRates.outputTextUsdPer1M,
      );
      addComponent(
        components,
        missingRates,
        "output_image",
        "image.outputImageUsdPer1M",
        usage.outputImageTokens ?? 0,
        imageRates.output,
      );
      noteParts.push("cache_not_attributed_cost_partial");
    } else {
      // Fórmula B — totais. Imagem sem breakdown não é tratada como texto.
      computedFormula = "B";
      canBeComplete = false;
      noteParts.push("image_inclusion_unproven");
      const cached = Math.min(cachedInputTokens, inputTokens);
      const inputHasImage = isPositive(usage.inputImageTokens);
      const outputHasImage = isPositive(usage.outputImageTokens);
      if (inputHasImage || outputHasImage) {
        noteParts.push("image_breakdown_incomplete_text_not_priced");
      }
      if (!inputHasImage) {
        addComponent(
          components,
          missingRates,
          "input_text",
          "orchestrator.inputTextUsdPer1M",
          Math.max(0, inputTokens - cached),
          params.orchestratorRates.inputTextUsdPer1M,
        );
      }
      if (usage.cacheAttribution === "attributed" || cached > 0) {
        addComponent(
          components,
          missingRates,
          "cached_input",
          "orchestrator.cachedTextUsdPer1M",
          cached,
          params.orchestratorRates.cachedTextUsdPer1M,
        );
      }
      if (!outputHasImage) {
        addComponent(
          components,
          missingRates,
          "output_text",
          "orchestrator.outputTextUsdPer1M",
          outputTokens,
          params.orchestratorRates.outputTextUsdPer1M,
        );
      }
    }
  }

  const usageInconsistent = usage.inconsistent || toolInconsistent;
  const hasMissingRates = missingRates.length > 0;
  const hasAnyPricedComponent = Object.values(components).some(
    (component) => component.usd !== null && component.usd > 0,
  );

  let costCoverage: VisualSignatureCostCoverage;
  let costSource: VisualSignatureCostSource;
  let estimatedCostUsd: number | null;

  if (!hasAnyPricedComponent) {
    costCoverage = "unknown";
    costSource = "not_available";
    estimatedCostUsd = null;
    noteParts.push("visual_signature_pricing_missing");
  } else {
    costSource = "pricing_table";
    estimatedCostUsd = sumComponents(components);
    if (usageInconsistent) {
      costCoverage = "partial";
      noteParts.push("usage_inconsistent_coverage_not_complete");
    } else if (hasMissingRates) {
      costCoverage = "partial";
      noteParts.push(`missing_rates=${[...new Set(missingRates)].join(",")}`);
    } else if (
      toolOverlapUnproven ||
      noteParts.includes("tool_usage_overlap_unproven") ||
      noteParts.includes("image_rate_direction_unproven") ||
      noteParts.includes("cache_attribution_missing_input_unpriced") ||
      noteParts.includes("image_breakdown_incomplete_text_not_priced") ||
      noteParts.includes("input_breakdown_leaves_unattributed_tokens") ||
      noteParts.includes("output_breakdown_leaves_unattributed_tokens")
    ) {
      costCoverage = "partial";
    } else if (canBeComplete) {
      // A e C são os únicos formatos que podem comprovar cobertura completa.
      costCoverage = "complete";
    } else {
      costCoverage = "partial";
    }
  }

  if (providerReported !== undefined) {
    return {
      estimatedCostUsd,
      providerReportedCostUsd: providerReported,
      costCoverage: estimatedCostUsd === null ? "partial" : costCoverage,
      costSource: "provider_reported",
      costEstimationNote: [noteParts.join(";"), "provider_reported_separate"]
        .filter(Boolean)
        .join(";"),
      components,
      missingRates: [...new Set(missingRates)],
      formula: "D",
    };
  }

  return {
    estimatedCostUsd,
    providerReportedCostUsd: null,
    costCoverage,
    costSource,
    costEstimationNote: noteParts.length > 0 ? noteParts.join(";") : null,
    components,
    missingRates: [...new Set(missingRates)],
    formula: computedFormula,
  };
}
