import "server-only";

/**
 * F60.3 — Resolução server-only do alvo de expansão e cobertura de pricing.
 *
 * O alvo efetivo (`gpt-image-2.5-sunburst` + `low`) é resolvido por uma linha
 * ATIVA de `ai_model_catalog` na capability `campaign_product_image`, provider
 * `openai` e protocolo `images`. `provider`/`model`/`protocol` são copiados da
 * linha casada — nunca montados por literal nem substituídos por outro modelo
 * elegível. Não há seletor administrativo, modelo alternativo, preset de
 * bancada nem configuração paralela de par de modelos.
 *
 * Pricing: a cobertura pré-chamada exige a linha vigente da qualidade (nunca
 * `code_default`) e TODAS as tarifas de usage (entrada/saída textual,
 * entrada/saída de imagem e cache textual/imagem) além de `image_unit_usd`
 * positivo. Qualquer ausência bloqueia antes da chamada (T-60.3-05).
 *
 * Este módulo é server-only porque constrói serviços com `supabaseAdmin` como
 * default; os leitores são injetáveis nos testes (`catalog`/`pricing`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AiModelCatalogService,
  type AiModelCatalogRow,
} from "@/lib/ai/ai-model-catalog-service";
import { AiModelPricingService, type ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import { isEligibleImageModel, isEligibleImageQuality } from "@/lib/ai/image-model-pair";

import {
  EXPANSION_CAPABILITY,
  EXPANSION_PROVIDER,
  EXPANSION_PROTOCOL,
  EXPANSION_QUALITY,
  EXPECTED_MODEL,
} from "./policy";

/** Tupla esperada desta fatia, derivada das constantes de `policy.ts`. */
export const EXPECTED_EXPANSION_TARGET = Object.freeze({
  capability: EXPANSION_CAPABILITY,
  provider: EXPANSION_PROVIDER,
  protocol: EXPANSION_PROTOCOL,
  model: EXPECTED_MODEL,
  quality: EXPANSION_QUALITY,
});

/** Leitor de catálogo injetável (default: serviço real com `supabaseAdmin`). */
export interface ExpansionCatalogReader {
  getActiveCatalogRows(): Promise<AiModelCatalogRow[]>;
}

/** Leitor de pricing injetável (default: serviço real com `supabaseAdmin`). */
export interface ExpansionPricingReader {
  getModelPricing(params: {
    provider: string;
    model: string;
    quality?: string;
  }): Promise<{ pricing: ModelPricing; versionId: string } | null>;
}

export type ExpandTargetFailureReason =
  | "catalog_row_missing"
  | "catalog_read_failed"
  | "unsupported_protocol"
  | "quality_not_eligible";

export type ExpandTargetResolution =
  | {
      readonly ok: true;
      readonly provider: "openai";
      readonly model: string;
      readonly protocol: "images";
      readonly quality: "low";
      readonly catalogRow: AiModelCatalogRow;
    }
  | {
      readonly ok: false;
      readonly reason: ExpandTargetFailureReason;
      readonly detail?: string;
    };

export type ExpansionPricingCoverageReason =
  | "row_missing"
  | "code_default"
  | "incomplete_coverage";

export interface ExpansionPricingCoverage {
  readonly complete: boolean;
  readonly reason?: ExpansionPricingCoverageReason;
  readonly missing: readonly string[];
}

export type ExpansionPricingResolution =
  | {
      readonly ok: true;
      readonly pricing: ModelPricing;
      readonly versionId: string;
      readonly imageUnitUsd: number;
    }
  | {
      readonly ok: false;
      readonly reason: ExpansionPricingCoverageReason;
      readonly missing: readonly string[];
    };

/** Tarifas obrigatórias para o cálculo por usage tokens (D9/F60.3). */
const REQUIRED_PRICING_FIELDS = Object.freeze([
  "inputCostUsd",
  "outputCostUsd",
  "cachedInputCostUsd",
  "imageInputTokenUsdPer1M",
  "imageTokenUsdPer1M",
  "imageCachedInputTokenUsdPer1M",
] as const);

function targetFailure(
  reason: ExpandTargetFailureReason,
  detail?: string,
): ExpandTargetResolution {
  return Object.freeze(
    detail === undefined
      ? { ok: false as const, reason }
      : { ok: false as const, reason, detail },
  );
}

/** Igualdade estrita da linha com a tupla esperada; nenhum campo é inferido. */
function isExpectedActiveRow(row: AiModelCatalogRow): boolean {
  return (
    row.status === "active" &&
    row.capability === EXPECTED_EXPANSION_TARGET.capability &&
    row.provider === EXPECTED_EXPANSION_TARGET.provider &&
    row.model === EXPECTED_EXPANSION_TARGET.model
  );
}

/**
 * `true` somente quando a linha é ativa, casa capability/provider/protocolo da
 * tupla esperada e o modelo/qualidade pertencem às listas fechadas da F56.1.
 */
export function isEligibleExpansionTarget(row: AiModelCatalogRow): boolean {
  return (
    row.status === "active" &&
    row.capability === EXPECTED_EXPANSION_TARGET.capability &&
    row.provider === EXPECTED_EXPANSION_TARGET.provider &&
    row.protocol === EXPECTED_EXPANSION_TARGET.protocol &&
    row.model === EXPECTED_EXPANSION_TARGET.model &&
    isEligibleImageModel(row.model) &&
    isEligibleImageQuality(EXPECTED_EXPANSION_TARGET.quality)
  );
}

/**
 * Resolve o alvo efetivo no catálogo. Nunca lança: exceção ou retorno que não é
 * array vira `catalog_read_failed`; ausência de linha Sunburst vira
 * `catalog_row_missing` mesmo que existam outros modelos elegíveis.
 */
export async function resolveExpansionTarget(
  deps: {
    readonly catalog?: ExpansionCatalogReader;
    readonly client?: SupabaseClient;
  } = {},
): Promise<ExpandTargetResolution> {
  const reader: ExpansionCatalogReader =
    deps.catalog ?? new AiModelCatalogService(deps.client);

  let rows: readonly AiModelCatalogRow[];
  try {
    const loaded = await reader.getActiveCatalogRows();
    if (!Array.isArray(loaded)) return targetFailure("catalog_read_failed");
    rows = loaded;
  } catch {
    return targetFailure("catalog_read_failed");
  }

  const row = rows.find((candidate) => isExpectedActiveRow(candidate));
  if (row === undefined) return targetFailure("catalog_row_missing");

  if (!isEligibleImageQuality(EXPANSION_QUALITY)) {
    return targetFailure("quality_not_eligible");
  }

  if (row.protocol !== EXPANSION_PROTOCOL) {
    return targetFailure("unsupported_protocol");
  }

  if (!isEligibleImageModel(row.model)) {
    return targetFailure("catalog_row_missing", "model_not_eligible");
  }

  if (row.provider !== EXPANSION_PROVIDER) {
    return targetFailure("catalog_row_missing");
  }

  return Object.freeze({
    ok: true as const,
    provider: row.provider,
    model: row.model,
    protocol: row.protocol,
    quality: EXPANSION_QUALITY,
    catalogRow: row,
  });
}

/**
 * Cobertura de pricing pré-chamada (T-60.3-05): a linha precisa existir, não
 * pode ser `code_default` e precisa cobrir as seis tarifas de usage mais um
 * `image_unit_usd` positivo. `image_unit_usd` sozinho nunca é completo.
 */
export function evaluatePricingCoverage(
  pricing: ModelPricing | null,
  versionId: string | null,
): ExpansionPricingCoverage {
  if (versionId === "code_default") {
    return Object.freeze({
      complete: false,
      reason: "code_default" as const,
      missing: Object.freeze(["pricing_code_default"]),
    });
  }

  if (pricing === null) {
    return Object.freeze({
      complete: false,
      reason: "row_missing" as const,
      missing: Object.freeze(["pricing_row"]),
    });
  }

  const missing: string[] = [];

  for (const field of REQUIRED_PRICING_FIELDS) {
    const value = pricing[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      missing.push(field);
    }
  }

  const imageUnitCostUsd = pricing.imageUnitCostUsd;
  if (
    typeof imageUnitCostUsd !== "number" ||
    !Number.isFinite(imageUnitCostUsd) ||
    imageUnitCostUsd <= 0
  ) {
    missing.push("image_unit_usd");
  }

  if (missing.length > 0) {
    return Object.freeze({
      complete: false,
      reason: "incomplete_coverage" as const,
      missing: Object.freeze(missing),
    });
  }

  return Object.freeze({ complete: true, missing: Object.freeze([]) });
}

/**
 * Lê o pricing do alvo resolvido repassando `provider`/`model`/`quality` sem
 * trocar nada, e aplica a cobertura pré-chamada. Nunca lança.
 */
export async function resolveExpansionPricing(
  target: {
    readonly provider: string;
    readonly model: string;
    readonly quality: "low";
  },
  deps: {
    readonly pricing?: ExpansionPricingReader;
    readonly client?: SupabaseClient;
  } = {},
): Promise<ExpansionPricingResolution> {
  const reader: ExpansionPricingReader =
    deps.pricing ?? new AiModelPricingService(deps.client);

  let read: { pricing: ModelPricing; versionId: string } | null = null;
  try {
    read = await reader.getModelPricing({
      provider: target.provider,
      model: target.model,
      quality: target.quality,
    });
  } catch {
    read = null;
  }

  if (read === null) {
    return Object.freeze({
      ok: false as const,
      reason: "row_missing" as const,
      missing: Object.freeze(["pricing_row"]),
    });
  }

  const coverage = evaluatePricingCoverage(read.pricing, read.versionId);
  if (!coverage.complete) {
    return Object.freeze({
      ok: false as const,
      reason: coverage.reason ?? "incomplete_coverage",
      missing: coverage.missing,
    });
  }

  return Object.freeze({
    ok: true as const,
    pricing: read.pricing,
    versionId: read.versionId,
    imageUnitUsd: read.pricing.imageUnitCostUsd as number,
  });
}
