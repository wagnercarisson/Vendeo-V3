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
 * `code_default`) e as tarifas de usage APLICÁVEIS ao protocolo. Para
 * `images.edit`, a saída é imagem (`imageTokenUsdPer1M`); `outputCostUsd` é
 * tarifa de saída TEXTUAL e só é exigida quando o protocolo/modelo pode
 * produzir tokens textuais positivos. O calculador pós-chamada
 * (`calculateProductOneToOneImageUsageCost`) segue a mesma regra: só exige
 * `outputCostUsd` quando `outputTextTokens > 0`. Qualquer ausência aplicável de
 * tarifa de usage bloqueia antes da chamada (T-60.3-05).
 *
 * `image_unit_usd` NÃO compõe a cobertura de usage: ele é apenas a estimativa
 * pré-chamada (teto/auditoria). Quando ausente, a estimativa permanece
 * explicitamente indisponível (`null`) e nunca vira zero, cópia de outra linha
 * ou custo efetivo; o custo pós-chamada continua sendo o de usage × tarifas.
 * A autorização de gasto do fluxo 9:16 continua sendo a reserva de 1 crédito,
 * não a estimativa por unidade.
 *
 * Este módulo é server-only porque constrói serviços com `supabaseAdmin` como
 * default; os leitores são injetáveis nos testes (`catalog`/`pricing`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AiModelCatalogService,
  type AiModelCatalogReadResult,
  type AiModelCatalogRow,
} from "@/lib/ai/ai-model-catalog-service";
import {
  AiModelPricingService,
  type ModelPricing,
  type ModelPricingReadResult,
} from "@/lib/ai-cost/ai-model-pricing";
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
  /** Leitura estrita opcional (preflight): distingue falha de leitura. */
  readActiveCatalogRows?(): Promise<AiModelCatalogReadResult>;
}

/** Leitor de pricing injetável (default: serviço real com `supabaseAdmin`). */
export interface ExpansionPricingReader {
  getModelPricing(params: {
    provider: string;
    model: string;
    quality?: string;
  }): Promise<{ pricing: ModelPricing; versionId: string } | null>;
  /** Leitura estrita opcional (preflight): distingue falha de leitura. */
  readModelPricing?(params: {
    provider: string;
    model: string;
    quality?: string;
  }): Promise<ModelPricingReadResult>;
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
      /**
       * Estimativa pré-chamada (`image_unit_usd`). `null` quando a linha não
       * cobre essa dimensão — a estimativa permanece indisponível, nunca zero.
       */
      readonly imageUnitUsd: number | null;
      readonly estimateAvailable: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: ExpansionPricingCoverageReason;
      readonly missing: readonly string[];
    };

/**
 * Estimativa pré-chamada (`image_unit_usd`), SEPARADA da cobertura de uso.
 * Ausente/zero/negativa ⇒ indisponível (`null`), nunca zero nem custo efetivo.
 */
export interface ExpansionPreCallEstimate {
  readonly available: boolean;
  readonly imageUnitUsd: number | null;
  readonly reason?: "image_unit_usd";
}

/** Preflight read-only de modelo + pricing da expansão (nenhuma chamada paga). */
export type ExpansionPreflightResult =
  | {
      readonly ok: true;
      readonly provider: "openai";
      readonly model: string;
      readonly protocol: "images";
      readonly quality: "low";
      readonly pricing: ModelPricing;
      readonly versionId: string;
      readonly imageUnitUsd: number | null;
      readonly estimateAvailable: boolean;
    }
  | {
      readonly ok: false;
      readonly failure: "model_unavailable";
      readonly reason: ExpandTargetFailureReason;
      readonly detail?: string;
    }
  | {
      readonly ok: false;
      readonly failure: "pricing_unavailable";
      readonly reason: ExpansionPricingCoverageReason;
      readonly missing: readonly string[];
    }
  | {
      readonly ok: false;
      readonly failure: "configuration_read_failed";
      readonly reason: "catalog_read_failed" | "pricing_read_failed";
    };

/**
 * Tarifas de usage obrigatórias para o cálculo no protocolo `images`: entrada
 * textual, cache textual, entrada de imagem, saída de imagem e cache de imagem.
 * `image_unit_usd` NÃO entra: é estimativa pré-chamada, não tarifa de usage.
 * `outputCostUsd` (saída textual) NÃO entra por padrão: modelos de imagem usam
 * `-` nessa dimensão e o calculador só a exige quando há tokens textuais de
 * saída positivos.
 */
const REQUIRED_PRICING_FIELDS = Object.freeze([
  "inputCostUsd",
  "cachedInputCostUsd",
  "imageInputTokenUsdPer1M",
  "imageTokenUsdPer1M",
  "imageCachedInputTokenUsdPer1M",
] as const);

export interface PricingCoverageOptions {
  /**
   * `true` somente quando o protocolo/modelo pode produzir saída textual
   * positiva e, portanto, `outputCostUsd` é aplicável. Default `false` para
   * `images.edit`.
   */
  readonly requiresTextOutputRate?: boolean;
}

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

function resolveTargetFromRows(
  rows: readonly AiModelCatalogRow[],
): ExpandTargetResolution {
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

  return resolveTargetFromRows(rows);
}

/**
 * Cobertura de tarifas de usage pré-chamada (T-60.3-05): a linha precisa
 * existir, não pode ser `code_default` e precisa cobrir as tarifas aplicáveis ao
 * protocolo. `outputCostUsd` é exigida apenas quando `requiresTextOutputRate` é
 * `true`. `image_unit_usd` sozinho nunca é completo e também não é exigido:
 * quando ausente, a estimativa é tratada por `evaluatePreCallEstimate`.
 */
export function evaluatePricingCoverage(
  pricing: ModelPricing | null,
  versionId: string | null,
  options: PricingCoverageOptions = {},
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

  const requiredFields: readonly (keyof ModelPricing)[] =
    options.requiresTextOutputRate === true
      ? [...REQUIRED_PRICING_FIELDS, "outputCostUsd"]
      : REQUIRED_PRICING_FIELDS;

  for (const field of requiredFields) {
    const value = pricing[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      missing.push(field);
    }
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
 * Avalia SOMENTE a estimativa pré-chamada. Ausente/zero/negativa/NaN ⇒
 * indisponível (`imageUnitUsd: null`), nunca `0` e nunca custo efetivo.
 */
export function evaluatePreCallEstimate(
  pricing: ModelPricing | null,
): ExpansionPreCallEstimate {
  const imageUnitCostUsd = pricing?.imageUnitCostUsd;
  if (
    typeof imageUnitCostUsd === "number" &&
    Number.isFinite(imageUnitCostUsd) &&
    imageUnitCostUsd > 0
  ) {
    return Object.freeze({
      available: true,
      imageUnitUsd: imageUnitCostUsd,
    });
  }
  return Object.freeze({
    available: false,
    imageUnitUsd: null,
    reason: "image_unit_usd" as const,
  });
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

  const estimate = evaluatePreCallEstimate(read.pricing);

  return Object.freeze({
    ok: true as const,
    pricing: read.pricing,
    versionId: read.versionId,
    imageUnitUsd: estimate.imageUnitUsd,
    estimateAvailable: estimate.available,
  });
}

/**
 * Preflight read-only de modelo + pricing da expansão. Nunca lança e nunca
 * chama provider: resolve a linha ativa do catálogo e a cobertura de tarifas de
 * usage (estimativa pré-chamada é reportada à parte, podendo estar indisponível).
 *
 * Distingue config comprovadamente ausente/incompleta de falha/indeterminação
 * de leitura: os leitores estritos dos serviços preservam o erro de banco; os
 * leitores legados injetados continuam suportados (exceção → falha de leitura,
 * `null` → linha ausente).
 */
export async function preflightExpansionToNineSixteen(
  deps: {
    readonly catalog?: ExpansionCatalogReader;
    readonly pricing?: ExpansionPricingReader;
    readonly client?: SupabaseClient;
  } = {},
): Promise<ExpansionPreflightResult> {
  const catalog = await readPreflightCatalog(deps);
  if (catalog.kind === "read_failed") {
    return Object.freeze({
      ok: false as const,
      failure: "configuration_read_failed" as const,
      reason: "catalog_read_failed" as const,
    });
  }

  const target = resolveTargetFromRows(catalog.rows);
  if (!target.ok) {
    return Object.freeze({
      ok: false as const,
      failure: "model_unavailable" as const,
      reason: target.reason,
      ...(target.detail === undefined ? {} : { detail: target.detail }),
    });
  }

  const pricing = await readPreflightPricing(deps, target);
  if (pricing.kind === "read_failed") {
    return Object.freeze({
      ok: false as const,
      failure: "configuration_read_failed" as const,
      reason: "pricing_read_failed" as const,
    });
  }
  if (pricing.kind === "row_missing") {
    return Object.freeze({
      ok: false as const,
      failure: "pricing_unavailable" as const,
      reason: "row_missing" as const,
      missing: Object.freeze(["pricing_row"]),
    });
  }
  if (pricing.kind === "code_default") {
    return Object.freeze({
      ok: false as const,
      failure: "pricing_unavailable" as const,
      reason: "code_default" as const,
      missing: Object.freeze(["pricing_code_default"]),
    });
  }

  const coverage = evaluatePricingCoverage(pricing.pricing, pricing.versionId);
  if (!coverage.complete) {
    return Object.freeze({
      ok: false as const,
      failure: "pricing_unavailable" as const,
      reason: coverage.reason ?? "incomplete_coverage",
      missing: coverage.missing,
    });
  }

  const estimate = evaluatePreCallEstimate(pricing.pricing);

  return Object.freeze({
    ok: true as const,
    provider: target.provider,
    model: target.model,
    protocol: target.protocol,
    quality: target.quality,
    pricing: pricing.pricing,
    versionId: pricing.versionId,
    imageUnitUsd: estimate.imageUnitUsd,
    estimateAvailable: estimate.available,
  });
}

async function readPreflightCatalog(deps: {
  readonly catalog?: ExpansionCatalogReader;
  readonly client?: SupabaseClient;
}): Promise<
  | { readonly kind: "ok"; readonly rows: readonly AiModelCatalogRow[] }
  | { readonly kind: "read_failed" }
> {
  const reader: ExpansionCatalogReader =
    deps.catalog ?? new AiModelCatalogService(deps.client);
  try {
    if (typeof reader.readActiveCatalogRows === "function") {
      const result = await reader.readActiveCatalogRows();
      return result.kind === "ok"
        ? { kind: "ok" as const, rows: result.rows }
        : { kind: "read_failed" as const };
    }
    const rows = await reader.getActiveCatalogRows();
    if (!Array.isArray(rows)) return { kind: "read_failed" as const };
    return { kind: "ok" as const, rows };
  } catch {
    return { kind: "read_failed" as const };
  }
}

async function readPreflightPricing(
  deps: {
    readonly pricing?: ExpansionPricingReader;
    readonly client?: SupabaseClient;
  },
  target: {
    readonly provider: string;
    readonly model: string;
    readonly quality: "low";
  },
): Promise<ModelPricingReadResult> {
  const reader: ExpansionPricingReader =
    deps.pricing ?? new AiModelPricingService(deps.client);
  try {
    if (typeof reader.readModelPricing === "function") {
      return await reader.readModelPricing({
        provider: target.provider,
        model: target.model,
        quality: target.quality,
      });
    }
    const legacy = await reader.getModelPricing({
      provider: target.provider,
      model: target.model,
      quality: target.quality,
    });
    if (legacy === null) return { kind: "row_missing" as const };
    return {
      kind: "found" as const,
      pricing: legacy.pricing,
      versionId: legacy.versionId,
    };
  } catch {
    return { kind: "read_failed" as const, reason: "legacy_reader_exception" };
  }
}
