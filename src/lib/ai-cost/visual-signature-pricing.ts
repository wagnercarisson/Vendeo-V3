import "server-only";

import {
  resolveVisualSignaturePreset,
  type VisualSignatureImagePreset,
} from "@/lib/ai/visual-signature-model-config";
import { getModelPricing, type ModelPricing } from "./ai-model-pricing";
import type { VisualSignatureRates } from "./visual-signature-usage";

/**
 * F47.1 (D8) — pricing quality-aware do preset da Assinatura Visual.
 *
 * Fontes:
 * - linha vigente de `ai_model_pricing` por `(provider, model, quality)`;
 * - NUNCA `responses:image_generation` (valor provisório `0.065`);
 * - NUNCA `fallback_static` genérico.
 *
 * `0.036`/`0.044` são apenas referências históricas LOCAIS do caminho
 * `images`, usadas na nota quando falta usage. Jamais viram tarifa, custo
 * estimado, custo reportado ou teto.
 */

export const VISUAL_SIGNATURE_HISTORICAL_ESTIMATES = Object.freeze({
  low: 0.036,
  medium: 0.044,
  source: "local_historical_images",
  date: "2026-10",
});

export type VisualSignaturePricingStatus = "complete" | "partial" | "missing";

export interface VisualSignaturePricingResult {
  status: VisualSignaturePricingStatus;
  preset: VisualSignatureImagePreset | null;
  model: string | null;
  quality: "low" | "medium" | null;
  provider: string;
  rates: VisualSignatureRates;
  pricingVersion: string | null;
  missingRates: string[];
  /** Referência histórica local (somente low/medium), nunca tarifa. */
  historicalReferenceUsd: number | null;
}

const REQUIRED_RATES = [
  "inputTextUsdPer1M",
  "outputTextUsdPer1M",
  "cachedTextUsdPer1M",
  "inputImageUsdPer1M",
  "outputImageUsdPer1M",
] as const;

function mapPricing(pricing: ModelPricing): VisualSignatureRates {
  return {
    inputTextUsdPer1M: pricing.inputCostUsd,
    outputTextUsdPer1M: pricing.outputCostUsd,
    cachedTextUsdPer1M: pricing.cachedInputCostUsd,
    // O schema atual possui UMA tarifa de imagem por token. Ela é usada tanto
    // para entrada quanto para saída; nunca é reutilizada como tarifa de texto.
    inputImageUsdPer1M: pricing.imageTokenUsdPer1M,
    outputImageUsdPer1M: pricing.imageTokenUsdPer1M,
  };
}

function classify(params: {
  preset: VisualSignatureImagePreset | null;
  model: string | null;
  quality: "low" | "medium" | null;
  provider: string;
  result: { pricing: ModelPricing; versionId: string } | null;
}): VisualSignaturePricingResult {
  const rates = params.result ? mapPricing(params.result.pricing) : {};
  const missingRates = REQUIRED_RATES.filter(
    (name) => rates[name] === undefined || rates[name] === null,
  );

  const status: VisualSignaturePricingStatus =
    params.result === null
      ? "missing"
      : missingRates.length === 0
        ? "complete"
        : missingRates.length === REQUIRED_RATES.length
          ? "missing"
          : "partial";

  const historicalReferenceUsd =
    params.quality === "low"
      ? VISUAL_SIGNATURE_HISTORICAL_ESTIMATES.low
      : params.quality === "medium"
        ? VISUAL_SIGNATURE_HISTORICAL_ESTIMATES.medium
        : null;

  return {
    status,
    preset: params.preset,
    model: params.model,
    quality: params.quality,
    provider: params.provider,
    rates,
    pricingVersion: params.result?.versionId ?? null,
    missingRates: [...missingRates],
    historicalReferenceUsd,
  };
}

/**
 * Resolve o par modelo/qualidade do preset e lê a tarifa específica.
 * Sem linha de qualidade ⇒ `missing` (nunca bootstrap genérico nem 0.065).
 */
export async function getVisualSignaturePresetPricing(params: {
  preset: VisualSignatureImagePreset;
  provider?: string;
}): Promise<VisualSignaturePricingResult> {
  const provider = params.provider ?? "openai";
  const resolved = resolveVisualSignaturePreset(params.preset);
  const result = await getModelPricing({
    provider,
    model: resolved.model,
    quality: resolved.quality,
  });

  return classify({
    preset: resolved.preset,
    model: resolved.model,
    quality: resolved.quality,
    provider,
    result,
  });
}

/**
 * Mesma leitura quality-aware quando o caller informa modelo/qualidade
 * explicitamente (sem preset fechado). Ainda exige `quality` — nunca usa a
 * linha legada `quality IS NULL`.
 */
export async function getVisualSignatureModelPricing(params: {
  provider: string;
  model: string;
  quality: "low" | "medium";
}): Promise<VisualSignaturePricingResult> {
  const result = await getModelPricing({
    provider: params.provider,
    model: params.model,
    quality: params.quality,
  });

  return classify({
    preset: null,
    model: params.model,
    quality: params.quality,
    provider: params.provider,
    result,
  });
}

export type { ModelPricing };
