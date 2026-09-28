import type { TokenUsage } from "@/lib/ai-cost/types";
import {
  BENCH_PRICING_RULE_VERSION,
  resolveBenchPricing,
  type BenchPricingCoverage,
  type BenchPricingMode,
  type BenchPricingResolution,
  type BenchTokenRates,
} from "../domain/bench-pricing";
import type { BenchPreset } from "../domain/preset-registry";

/**
 * Resolvedor de custo **local da bancada** (F48.2.2, D11/D12) — módulo **puro**,
 * sem I/O e **sem reutilizar o resolvedor de custo produtivo**.
 *
 * O custo é chaveado pelo **preset completo** (`provider + model + protocol +
 * quality + size`) sobre o pricing local (`bench-pricing.ts`, somente em código).
 * O resolvedor produtivo (chaveado apenas por `provider + model`) **não** é a
 * fonte da estimativa da bancada e permanece intocado — este módulo **não** o
 * importa nem o invoca.
 *
 * ## Três noções distintas (nunca confundidas)
 *
 * - **usage do provider** (`usageReported`) — preservado em campo **separado**;
 * - **custo reportado pelo provider** (`providerReportedCostUsd`) — mantido
 *   **separado**, nunca substituído pelo cálculo local;
 * - **custo calculado/estimado** (`estimatedCostUsd`) — pelo **modo** confirmado
 *   (`per_image` = preço fixo por imagem, **sem** multiplicação por tokens;
 *   `token_based` = taxas por token × usage). Sem usage suficiente, é **estimado**
 *   pelo preset completo (`isEstimate: true`) — nunca apresentado como faturado.
 *
 * É **proibida** qualquer multiplicação genérica `usage × unitPriceUsd`: o modo
 * `token_based` usa taxas por componente e o modo `per_image` ignora tokens.
 */

/** Origem do custo local da bancada (persistida em `cost_source`). */
export const BENCH_COST_SOURCE = "bench_local_pricing" as const;

export type BenchCostSource = typeof BENCH_COST_SOURCE;

/** Componentes de tokens usados no cálculo `token_based` (auditoria). */
export interface BenchCostCalculation {
  inputTextTokens: number;
  inputImageTokens: number;
  outputImageTokens: number;
  tokenRates: BenchTokenRates;
}

/** Resultado do resolvedor local de custo da bancada. */
export interface BenchCostResolution {
  costSource: BenchCostSource;
  costRuleVersion: string;
  mode: BenchPricingMode;
  coverage: BenchPricingCoverage;
  /** Custo calculado/estimado (USD) — `null` quando não há valor comprovado. */
  estimatedCostUsd: number | null;
  /** `true` quando o valor veio do ramo estimado (sem usage suficiente). */
  isEstimate: boolean;
  /** Usage do provider, preservado em campo **separado**. */
  usageReported?: TokenUsage;
  /** Custo reportado pelo provider, preservado em campo **separado**. */
  providerReportedCostUsd?: number;
  /** Componentes do cálculo `token_based` (quando aplicável). */
  calculation?: BenchCostCalculation;
}

export interface ResolveBenchCostParams {
  preset: BenchPreset;
  /** Usage do provider (opcional — ausente aciona o ramo estimado). */
  usage?: TokenUsage;
  /** Custo reportado pelo provider (opcional — mantido separado). */
  providerReportedCostUsd?: number;
  /** Override do pricing (testes); default = pricing local do preset completo. */
  pricing?: BenchPricingResolution;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function tokenComponents(usage: TokenUsage): Omit<BenchCostCalculation, "tokenRates"> {
  const inputTextTokens =
    finiteNumber(usage.inputTextTokens) ?? finiteNumber(usage.promptTokens) ?? 0;
  const inputImageTokens = finiteNumber(usage.inputImageTokens) ?? 0;
  const outputImageTokens =
    finiteNumber(usage.outputImageTokens) ??
    finiteNumber(usage.imageTokens) ??
    finiteNumber(usage.completionTokens) ??
    0;
  return { inputTextTokens, inputImageTokens, outputImageTokens };
}

function hasUsableUsage(usage: TokenUsage | undefined): usage is TokenUsage {
  if (!usage || typeof usage !== "object") return false;
  const components = tokenComponents(usage);
  return (
    components.inputTextTokens > 0 ||
    components.inputImageTokens > 0 ||
    components.outputImageTokens > 0
  );
}

/** Taxas por token × tokens do usage (nunca `usage × unitPriceUsd`). */
function computeTokenBasedCost(calculation: BenchCostCalculation): number {
  const { tokenRates } = calculation;
  const cost =
    (calculation.inputTextTokens * tokenRates.inputTextUsdPerMillion +
      calculation.inputImageTokens * tokenRates.inputImageUsdPerMillion +
      calculation.outputImageTokens * tokenRates.outputImageUsdPerMillion) /
    1_000_000;
  return Number(cost.toFixed(6));
}

/**
 * Resolve o custo da bancada pelo preset completo.
 *
 * `estimatedCostUsd` reflete **exclusivamente** o resolvedor local da bancada:
 * (1) modo `per_image` (preço fixo, sem tokens); (2) modo `token_based` com usage
 * suficiente (taxas × usage); (3) ramo estimado pelo preset completo
 * (`isEstimate: true`); (4) sem valor comprovado (`coverage: missing`).
 *
 * O custo reportado pelo provider (`providerReportedCostUsd`) é mantido em campo
 * **separado** e **nunca** substitui o cálculo local (D11) — nenhuma das noções
 * "usage do provider", "custo calculado" e "custo estimado" é confundida.
 */
export function resolveBenchCost(params: ResolveBenchCostParams): BenchCostResolution {
  const pricing =
    params.pricing ??
    resolveBenchPricing({
      provider: params.preset.provider,
      model: params.preset.model,
      protocol: params.preset.protocol,
      quality: params.preset.quality,
      size: params.preset.size,
    });

  const base: Omit<
    BenchCostResolution,
    "estimatedCostUsd" | "isEstimate" | "providerReportedCostUsd" | "calculation"
  > = {
    costSource: BENCH_COST_SOURCE,
    costRuleVersion: pricing.ruleVersion || BENCH_PRICING_RULE_VERSION,
    mode: pricing.mode,
    coverage: pricing.coverage,
    ...(params.usage ? { usageReported: params.usage } : {}),
  };

  // O custo reportado pelo provider é SEMPRE mantido em campo separado e NUNCA
  // substitui o cálculo local: `estimatedCostUsd` reflete exclusivamente o
  // resolvedor local da bancada (calculado com usage, ou estimado pelo preset).
  const withProviderCost =
    typeof params.providerReportedCostUsd === "number"
      ? { ...base, providerReportedCostUsd: params.providerReportedCostUsd }
      : base;

  // (1) Modo `per_image`: preço fixo por imagem — SEM multiplicação por tokens.
  if (pricing.mode === "per_image" && typeof pricing.unitPriceUsd === "number") {
    return { ...withProviderCost, estimatedCostUsd: pricing.unitPriceUsd, isEstimate: false };
  }

  // (2) Modo `token_based` com usage suficiente: taxas por token × usage.
  if (pricing.mode === "token_based" && pricing.tokenRates && hasUsableUsage(params.usage)) {
    const calculation: BenchCostCalculation = {
      ...tokenComponents(params.usage),
      tokenRates: pricing.tokenRates,
    };
    return {
      ...withProviderCost,
      estimatedCostUsd: computeTokenBasedCost(calculation),
      isEstimate: false,
      calculation,
    };
  }

  // (3) Ramo estimado: sem usage suficiente, estima pelo preset completo.
  if (typeof pricing.unitPriceUsd === "number") {
    return { ...withProviderCost, estimatedCostUsd: pricing.unitPriceUsd, isEstimate: true };
  }

  // (4) Sem valor comprovado (coverage missing): estimativa indisponível.
  return { ...withProviderCost, estimatedCostUsd: null, isEstimate: true };
}
