import "server-only";

import {
  resolveVisualSignaturePreset,
  type VisualSignatureImagePreset,
} from "@/lib/ai/visual-signature-model-config";
import { getModelPricing, type ModelPricing } from "./ai-model-pricing";
import type {
  VisualSignatureImageRates,
  VisualSignatureOrchestratorRates,
} from "./visual-signature-usage";

/**
 * F47.1 (D8) — pricing quality-aware do preset da Assinatura Visual.
 *
 * Fontes:
 * - orquestrador: `ai_model_pricing` por `(provider, model)` — GPT-5.5/Luna;
 * - imagem: `ai_model_pricing` por `(provider, model, quality)` do preset;
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

export interface VisualSignatureImagePricingResult {
  status: VisualSignaturePricingStatus;
  preset: VisualSignatureImagePreset | null;
  model: string | null;
  quality: "low" | "medium" | null;
  provider: string;
  rates: VisualSignatureImageRates;
  pricingVersion: string | null;
  missingRates: string[];
  /** Referência histórica local (somente low/medium), nunca tarifa. */
  historicalReferenceUsd: number | null;
}

export interface VisualSignatureOrchestratorPricingResult {
  status: VisualSignaturePricingStatus;
  model: string;
  provider: string;
  rates: VisualSignatureOrchestratorRates;
  pricingVersion: string | null;
  missingRates: string[];
}

/** Strip de sufixo de data (mesma regra do estimador legado). */
function normalizeModel(model: string): string {
  return model.replace(/(-\d{4}-\d{2}-\d{2})+$/g, "");
}

function mapOrchestratorPricing(pricing: ModelPricing): VisualSignatureOrchestratorRates {
  return {
    inputTextUsdPer1M: pricing.inputCostUsd,
    outputTextUsdPer1M: pricing.outputCostUsd,
    cachedTextUsdPer1M: pricing.cachedInputCostUsd,
  };
}

function mapImagePricing(pricing: ModelPricing): VisualSignatureImageRates {
  return {
    // O schema atual possui UMA tarifa de imagem por token. Ela NÃO é copiada
    // para entrada E saída: o cálculo só a usa quando a direção é inequívoca.
    imageTokenUsdPer1M: pricing.imageTokenUsdPer1M,
    // Tarifas separadas só existem se o pricing as expuser explicitamente.
    cachedImageUsdPer1M: undefined,
  };
}

function classifyImage(params: {
  preset: VisualSignatureImagePreset | null;
  model: string | null;
  quality: "low" | "medium" | null;
  provider: string;
  result: { pricing: ModelPricing; versionId: string } | null;
}): VisualSignatureImagePricingResult {
  const rates = params.result ? mapImagePricing(params.result.pricing) : {};
  const missingRates = rates.imageTokenUsdPer1M === undefined ? ["image.imageTokenUsdPer1M"] : [];
  const status: VisualSignaturePricingStatus =
    params.result === null
      ? "missing"
      : missingRates.length === 0
        ? "complete"
        : "missing";

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
    missingRates,
    historicalReferenceUsd,
  };
}

/**
 * Tarifas do ORQUESTRADOR (texto). Separadas das tarifas de imagem/tool.
 * A leitura sem qualidade mantém o comportamento legado do catálogo
 * (`quality IS NULL` + bootstrap `code_default`).
 */
export async function getVisualSignatureOrchestratorPricing(params: {
  provider: string;
  model: string;
}): Promise<VisualSignatureOrchestratorPricingResult> {
  const result = await getModelPricing({
    provider: params.provider,
    model: normalizeModel(params.model),
  });
  const rates = result ? mapOrchestratorPricing(result.pricing) : {};
  const missingRates: string[] = [];
  if (rates.inputTextUsdPer1M === undefined) missingRates.push("orchestrator.inputTextUsdPer1M");
  if (rates.outputTextUsdPer1M === undefined) missingRates.push("orchestrator.outputTextUsdPer1M");
  if (rates.cachedTextUsdPer1M === undefined) missingRates.push("orchestrator.cachedTextUsdPer1M");

  const status: VisualSignaturePricingStatus =
    result === null ? "missing" : missingRates.length === 0 ? "complete" : "partial";

  return {
    status,
    model: params.model,
    provider: params.provider,
    rates,
    pricingVersion: result?.versionId ?? null,
    missingRates,
  };
}

/**
 * Resolve o par modelo/qualidade do preset e lê a tarifa ESPECÍFICA de imagem.
 * Sem linha de qualidade ⇒ `missing` (nunca bootstrap genérico nem 0.065).
 */
export async function getVisualSignaturePresetPricing(params: {
  preset: VisualSignatureImagePreset;
  provider?: string;
}): Promise<VisualSignatureImagePricingResult> {
  const provider = params.provider ?? "openai";
  const resolved = resolveVisualSignaturePreset(params.preset);
  const result = await getModelPricing({
    provider,
    model: resolved.model,
    quality: resolved.quality,
  });

  return classifyImage({
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
}): Promise<VisualSignatureImagePricingResult> {
  const result = await getModelPricing({
    provider: params.provider,
    model: params.model,
    quality: params.quality,
  });

  return classifyImage({
    preset: null,
    model: params.model,
    quality: params.quality,
    provider: params.provider,
    result,
  });
}

export type { ModelPricing };
