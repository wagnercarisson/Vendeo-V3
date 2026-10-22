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
 *
 * As fórmulas A–E do design são aplicadas conforme o formato confirmado.
 */

export type VisualSignatureCostCoverage = "complete" | "partial" | "unknown";
export type VisualSignatureCostSource =
  | "pricing_table"
  | "provider_reported"
  | "not_available";

export interface VisualSignatureRates {
  inputTextUsdPer1M?: number;
  cachedTextUsdPer1M?: number;
  inputImageUsdPer1M?: number;
  cachedImageUsdPer1M?: number;
  outputTextUsdPer1M?: number;
  outputImageUsdPer1M?: number;
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
  rates: VisualSignatureRates;
  providerReportedCostUsd?: number | null;
  /** Usage próprio da tool, quando o provider expõe separadamente. */
  imageToolUsage?: TokenUsage;
  /** Referência histórica quality-aware, apenas por falta de usage. */
  historicalEstimateUsd?: number | null;
  historicalEstimateSource?: string;
  preset?: string | null;
}

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
    } else if (inputTokens !== undefined && inputTextTokens + inputImageTokens > inputTokens) {
      inputBreakdown = "inconsistent";
      notes.push("input_breakdown_inconsistent");
      inputTextTokens = undefined;
      inputImageTokens = undefined;
    } else if (inputTokens === undefined) {
      inputBreakdown = "incomplete";
      notes.push("input_total_missing");
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
    } else if (outputTokens !== undefined && outputTextTokens + outputImageTokens > outputTokens) {
      outputBreakdown = "inconsistent";
      notes.push("output_breakdown_inconsistent");
      outputTextTokens = undefined;
      outputImageTokens = undefined;
    } else if (outputTokens === undefined) {
      outputBreakdown = "incomplete";
      notes.push("output_total_missing");
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
  }

  if (cachedInputTokens !== undefined && inputTokens !== undefined && cachedInputTokens > inputTokens) {
    notes.push("cached_input_exceeds_input");
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
 * Aplica as fórmulas A–E. Retorna SEMPRE uma cobertura explícita.
 */
export function computeVisualSignatureCost(
  params: ComputeVisualSignatureCostParams,
): VisualSignatureCostResult {
  const { rates } = params;
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

  const mainHasImageTokens =
    isPositive(usage.inputImageTokens) || isPositive(usage.outputImageTokens);
  const toolUsageAmbiguous =
    toolUsage !== undefined && hasAnyUsage(toolUsage) && mainHasImageTokens;

  // ---- Tool usage próprio (fórmula C): precificado UMA vez. ----
  // Quando o usage principal TAMBÉM traz tokens de imagem, não é possível
  // provar que os dois não se sobrepõem: nenhuma das fontes é precificada para
  // não duplicar; a cobertura fica parcial.
  if (toolUsageAmbiguous) {
    noteParts.push("tool_usage_ambiguous_with_orchestrator_image_tokens");
  } else if (toolUsage && hasAnyUsage(toolUsage)) {
    const toolTextIn = toolUsage.inputTextTokens ?? toolUsage.inputTokens ?? 0;
    const toolTextOut = toolUsage.outputTextTokens ?? toolUsage.outputTokens ?? 0;
    addComponent(
      components,
      missingRates,
      "tool_input_text",
      "inputTextUsdPer1M",
      toolTextIn,
      rates.inputTextUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "tool_output_text",
      "outputTextUsdPer1M",
      toolTextOut,
      rates.outputTextUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "tool_output_image",
      "outputImageUsdPer1M",
      toolUsage.outputImageTokens ?? 0,
      rates.outputImageUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "tool_input_image",
      "inputImageUsdPer1M",
      toolUsage.inputImageTokens ?? 0,
      rates.inputImageUsdPer1M,
    );
    noteParts.push("tool_usage_separate");
  }

  const hasUsableOrchestratorUsage = hasAnyUsage(usage);
  const hasToolUsage =
    !toolUsageAmbiguous && toolUsage !== undefined && hasAnyUsage(toolUsage);

  if (!hasUsableOrchestratorUsage && !hasToolUsage) {
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
      "outputTextUsdPer1M",
      usage.reasoningTokens,
      rates.outputTextUsdPer1M,
    );
    noteParts.push("reasoning_priced_outside_output");
  } else if (reasoningInsideOutput) {
    // Explicitamente NÃO adicionado: já está em outputTokens.
    noteParts.push("reasoning_included_in_output");
  }

  const hasCompleteBreakdown =
    usage.inputBreakdown === "complete" && usage.outputBreakdown === "complete";
  const hasImageBreakdown =
    isPositive(usage.inputImageTokens) || isPositive(usage.outputImageTokens);

  let formula: "A" | "B" | "C" | "E" = "B";

  if (hasCompleteBreakdown && usage.cacheAttribution !== "unattributed") {
    formula = "A";
    const cachedText = usage.cachedTextTokens ?? 0;
    const cachedImage = usage.cachedImageTokens ?? 0;
    addComponent(
      components,
      missingRates,
      "input_text",
      "inputTextUsdPer1M",
      Math.max(0, (usage.inputTextTokens ?? 0) - cachedText),
      rates.inputTextUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "cached_text",
      "cachedTextUsdPer1M",
      cachedText,
      rates.cachedTextUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "input_image",
      "inputImageUsdPer1M",
      Math.max(0, (usage.inputImageTokens ?? 0) - cachedImage),
      rates.inputImageUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "cached_image",
      "cachedImageUsdPer1M",
      cachedImage,
      rates.cachedImageUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "output_text",
      "outputTextUsdPer1M",
      usage.outputTextTokens ?? 0,
      rates.outputTextUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "output_image",
      "outputImageUsdPer1M",
      usage.outputImageTokens ?? 0,
      rates.outputImageUsdPer1M,
    );
  } else if (hasImageBreakdown && usage.cacheAttribution === "unattributed") {
    // Breakdown existe, mas o cache não pode ser atribuído: não precifica
    // silenciosamente imagem/texto com a tarifa errada. Calcula apenas os
    // componentes confirmados e marca a cobertura como parcial.
    formula = "E";
    const textCacheAllocated = Math.min(
      cachedInputTokens,
      usage.inputTextTokens ?? 0,
    );
    const unallocatedCache = cachedInputTokens - textCacheAllocated;
    addComponent(
      components,
      missingRates,
      "input_text",
      "inputTextUsdPer1M",
      Math.max(0, (usage.inputTextTokens ?? 0) - textCacheAllocated),
      rates.inputTextUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "cached_text",
      "cachedTextUsdPer1M",
      textCacheAllocated,
      rates.cachedTextUsdPer1M,
    );
    if (unallocatedCache > 0) {
      noteParts.push("cached_tokens_unattributed_not_priced");
    }
    addComponent(
      components,
      missingRates,
      "input_image",
      "inputImageUsdPer1M",
      usage.inputImageTokens ?? 0,
      rates.inputImageUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "output_text",
      "outputTextUsdPer1M",
      usage.outputTextTokens ?? 0,
      rates.outputTextUsdPer1M,
    );
    addComponent(
      components,
      missingRates,
      "output_image",
      "outputImageUsdPer1M",
      usage.outputImageTokens ?? 0,
      rates.outputImageUsdPer1M,
    );
    noteParts.push("cache_not_attributed_cost_partial");
  } else {
    // Fórmula B — apenas totais. Cache reduz a parcela não cacheada.
    formula = hasToolUsage ? "C" : "B";
    const cached = Math.min(cachedInputTokens, inputTokens);
    if (usage.cacheAttribution === "attributed") {
      // Sem breakdown de imagem, usa as parcelas de cache atribuídas quando o
      // texto é a única dimensão (evita reutilizar tarifa de imagem no texto).
      const cachedText = usage.cachedTextTokens ?? 0;
      addComponent(
        components,
        missingRates,
        "input_text",
        "inputTextUsdPer1M",
        Math.max(0, inputTokens - cached),
        rates.inputTextUsdPer1M,
      );
      addComponent(
        components,
        missingRates,
        "cached_text",
        "cachedTextUsdPer1M",
        cachedText,
        rates.cachedTextUsdPer1M,
      );
    } else {
      addComponent(
        components,
        missingRates,
        "input_text",
        "inputTextUsdPer1M",
        Math.max(0, inputTokens - cached),
        rates.inputTextUsdPer1M,
      );
      addComponent(
        components,
        missingRates,
        "cached_input",
        "cachedTextUsdPer1M",
        cached,
        rates.cachedTextUsdPer1M,
      );
    }
    addComponent(
      components,
      missingRates,
      "output_text",
      "outputTextUsdPer1M",
      outputTokens,
      rates.outputTextUsdPer1M,
    );
  }

  const hasMissingRates = missingRates.length > 0;
  const hasAnyPricedComponent = Object.values(components).some(
    (component) => component.usd !== null && component.usd > 0,
  );

  // Cobertura honesta:
  // - sem tarifa alguma → unknown, sem total inventado;
  // - fórmula B/C com imagem não comprovada → partial;
  // - fórmula A com tudo atribuído e tarifas presentes → complete.
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
    if (hasMissingRates) {
      costCoverage = "partial";
      noteParts.push(`missing_rates=${[...new Set(missingRates)].join(",")}`);
    } else if (
      toolUsageAmbiguous ||
      noteParts.includes("cached_tokens_unattributed_not_priced") ||
      noteParts.includes("input_breakdown_leaves_unattributed_tokens") ||
      noteParts.includes("output_breakdown_leaves_unattributed_tokens")
    ) {
      costCoverage = "partial";
    } else if (formula === "A") {
      costCoverage = "complete";
    } else if (formula === "C") {
      costCoverage = "complete";
    } else {
      // B: a imagem não está comprovadamente incluída nos totais.
      costCoverage = "partial";
      noteParts.push("image_inclusion_unproven");
    }
  }

  if (providerReported !== undefined) {
    // Fórmula D: reportado nunca é sobrescrito pela estimativa.
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
    formula,
  };
}
