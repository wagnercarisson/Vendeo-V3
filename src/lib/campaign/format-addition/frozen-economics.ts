import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AiModelCatalogReadResult,
  AiModelCatalogRow,
} from "@/lib/ai/ai-model-catalog-service";
import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import {
  isEligibleImageQuality,
  type ImageQuality,
} from "@/lib/ai/image-model-pair";
import {
  isNineSixteenExpansionModel,
  type ExpansionSelection,
  type NineSixteenExpansionModel,
} from "@/lib/ai/nine-sixteen-expansion-model-config";
import { EconomicParameterService } from "@/lib/economic/economic-parameter-service";
import type { EconomicParameterKey } from "@/lib/economic/types";
import {
  evaluatePricingCoverage,
  preflightExpansionToNineSixteen,
  type ExpansionCatalogReader,
  type ExpansionPreflightResult,
  type ExpansionPricingReader,
} from "@/lib/campaign/vertical-expansion/model";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * F62/62-03 — Congelamento da seleção de expansão, catálogo/pricing e economia.
 *
 * A leitura do vigente acontece UMA vez, na abertura. Leitores estáticos
 * devolvem os valores gravados e recusam seleção divergente. Não há fallback
 * para o snapshot econômico da campanha original: os valores de câmbio/credito
 * são lidos dos parâmetros econômicos atuais e, quando indisponíveis, ficam
 * `null` explícitos.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FrozenExpansionSelection {
  readonly model: NineSixteenExpansionModel;
  readonly quality: ImageQuality;
  readonly configVersionId: string;
  readonly selectionOrigin: "configured";
}

export interface FrozenEconomics {
  readonly selection: FrozenExpansionSelection;
  readonly pricingVersionId: string;
  readonly pricing: ModelPricing;
  readonly usdBrlRateAtGeneration: number | null;
  readonly creditValueBrlAtGeneration: number | null;
  readonly capturedAt: string;
}

export interface FrozenEconomicValues {
  readonly usdBrlRateAtGeneration: number | null;
  readonly creditValueBrlAtGeneration: number | null;
}

export type CaptureFrozenEconomicsFailureReason =
  | "invalid_selection"
  | "invalid_selection_origin"
  | "invalid_selection_model"
  | "invalid_selection_quality"
  | "invalid_selection_config_version"
  | "model_unavailable"
  | "pricing_unavailable"
  | "configuration_read_failed";

export type CaptureFrozenEconomicsResult =
  | { readonly ok: true; readonly frozen: FrozenEconomics }
  | {
      readonly ok: false;
      readonly reason: CaptureFrozenEconomicsFailureReason;
      readonly detail?: string;
      readonly missing?: readonly string[];
    };

export type ParseFrozenEconomicsResult =
  | { readonly ok: true; readonly frozen: FrozenEconomics }
  | { readonly ok: false; readonly reason: "invalid_selection" | "invalid_frozen_economics"; readonly detail?: string };

export interface CaptureFrozenEconomicsDeps {
  readonly client?: SupabaseClient;
  readonly catalog?: ExpansionCatalogReader;
  readonly pricing?: ExpansionPricingReader;
  readonly readEconomicValues?: () => Promise<FrozenEconomicValues>;
  readonly now?: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeSelection(
  selection: ExpansionSelection,
):
  | { readonly ok: true; readonly selection: FrozenExpansionSelection }
  | { readonly ok: false; readonly reason: CaptureFrozenEconomicsFailureReason } {
  if (selection.origin !== "configured") {
    return { ok: false, reason: "invalid_selection_origin" };
  }
  if (!isNineSixteenExpansionModel(selection.model)) {
    return { ok: false, reason: "invalid_selection_model" };
  }
  if (!isEligibleImageQuality(selection.quality)) {
    return { ok: false, reason: "invalid_selection_quality" };
  }
  if (
    typeof selection.configVersionId !== "string" ||
    !UUID_RE.test(selection.configVersionId)
  ) {
    return { ok: false, reason: "invalid_selection_config_version" };
  }
  return {
    ok: true,
    selection: Object.freeze({
      model: selection.model,
      quality: selection.quality,
      configVersionId: selection.configVersionId.toLowerCase(),
      selectionOrigin: "configured" as const,
    }),
  };
}

function readEconomicValue(
  rows: readonly { key: EconomicParameterKey; value: number; source: string }[],
  key: EconomicParameterKey,
): number | null {
  const row = rows.find((entry) => entry.key === key);
  if (row === undefined || row.source !== "table") return null;
  return finiteOrNull(row.value);
}

async function defaultReadEconomicValues(
  client: SupabaseClient,
): Promise<FrozenEconomicValues> {
  try {
    const rows = await new EconomicParameterService(client).getAll();
    return {
      usdBrlRateAtGeneration: readEconomicValue(rows, "usd_brl_rate"),
      creditValueBrlAtGeneration: readEconomicValue(rows, "credit_value_brl"),
    };
  } catch {
    return {
      usdBrlRateAtGeneration: null,
      creditValueBrlAtGeneration: null,
    };
  }
}

function mapPreflightFailure(
  failure: ExpansionPreflightResult & { readonly ok: false },
): CaptureFrozenEconomicsResult {
  switch (failure.failure) {
    case "model_unavailable":
      return Object.freeze({
        ok: false as const,
        reason: "model_unavailable" as const,
        detail: failure.reason,
      });
    case "pricing_unavailable":
      return Object.freeze({
        ok: false as const,
        reason: "pricing_unavailable" as const,
        detail: failure.reason,
        missing: failure.missing,
      });
    case "configuration_read_failed":
      return Object.freeze({
        ok: false as const,
        reason: "configuration_read_failed" as const,
        detail: failure.reason,
      });
  }
}

function parseCapturedAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    return null;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? value : null;
}

function parseSelection(value: unknown):
  | { readonly ok: true; readonly selection: FrozenExpansionSelection }
  | { readonly ok: false; readonly detail: string } {
  if (!isRecord(value)) return { ok: false, detail: "selection_not_object" };
  if (value.selectionOrigin !== "configured") {
    return { ok: false, detail: "selection_origin_not_configured" };
  }
  if (typeof value.model !== "string" || !isNineSixteenExpansionModel(value.model)) {
    return { ok: false, detail: "selection_model_invalid" };
  }
  if (
    typeof value.quality !== "string" ||
    !isEligibleImageQuality(value.quality)
  ) {
    return { ok: false, detail: "selection_quality_invalid" };
  }
  if (typeof value.configVersionId !== "string" || !UUID_RE.test(value.configVersionId)) {
    return { ok: false, detail: "selection_config_version_invalid" };
  }
  return {
    ok: true,
    selection: Object.freeze({
      model: value.model,
      quality: value.quality,
      configVersionId: value.configVersionId.toLowerCase(),
      selectionOrigin: "configured" as const,
    }),
  };
}

/**
 * Captura a seleção/pricing/economia UMA vez. Nunca lê a campanha original e
 * nunca lança: falha de configuração/pricing retorna motivo fechado.
 */
export async function captureFrozenEconomics(
  selection: ExpansionSelection,
  deps: CaptureFrozenEconomicsDeps = {},
): Promise<CaptureFrozenEconomicsResult> {
  const normalized = normalizeSelection(selection);
  if (!normalized.ok) {
    return Object.freeze({ ok: false, reason: normalized.reason });
  }

  const client = deps.client ?? supabaseAdmin;
  const preflight = await preflightExpansionToNineSixteen(
    {
      client,
      ...(deps.catalog === undefined ? {} : { catalog: deps.catalog }),
      ...(deps.pricing === undefined ? {} : { pricing: deps.pricing }),
    },
    selection,
  );
  if (!preflight.ok) {
    return mapPreflightFailure(preflight);
  }

  const economicValues: FrozenEconomicValues = await (async () => {
    try {
      return deps.readEconomicValues
        ? await deps.readEconomicValues()
        : await defaultReadEconomicValues(client);
    } catch {
      return {
        usdBrlRateAtGeneration: null,
        creditValueBrlAtGeneration: null,
      };
    }
  })();
  const capturedAt = (deps.now?.() ?? new Date()).toISOString();

  return Object.freeze({
    ok: true as const,
    frozen: Object.freeze({
      selection: normalized.selection,
      pricingVersionId: preflight.versionId,
      pricing: Object.freeze({ ...preflight.pricing }),
      usdBrlRateAtGeneration: finiteOrNull(
        economicValues.usdBrlRateAtGeneration,
      ),
      creditValueBrlAtGeneration: finiteOrNull(
        economicValues.creditValueBrlAtGeneration,
      ),
      capturedAt,
    }),
  });
}

/** Payloads exatos das RPCs de abertura (seleção + economia congelada). */
export function toFormatAdditionRpcPayload(frozen: FrozenEconomics): {
  readonly selection: {
    readonly model: NineSixteenExpansionModel;
    readonly quality: ImageQuality;
    readonly configVersionId: string;
    readonly selectionOrigin: "configured";
  };
  readonly frozenEconomics: {
    readonly pricingVersionId: string;
    readonly pricing: ModelPricing;
    readonly usdBrlRateAtGeneration: number | null;
    readonly creditValueBrlAtGeneration: number | null;
    readonly capturedAt: string;
  };
} {
  return Object.freeze({
    selection: frozen.selection,
    frozenEconomics: Object.freeze({
      pricingVersionId: frozen.pricingVersionId,
      pricing: frozen.pricing,
      usdBrlRateAtGeneration: frozen.usdBrlRateAtGeneration,
      creditValueBrlAtGeneration: frozen.creditValueBrlAtGeneration,
      capturedAt: frozen.capturedAt,
    }),
  });
}

/**
 * Reconstrói o congelado persistido na retomada. Estrutura/seleção inválida
 * bloqueia antes de chamada paga; nunca recalcula valores vigentes.
 */
export function parseFrozenEconomics(
  selection: unknown,
  frozen: unknown,
): ParseFrozenEconomicsResult {
  const parsedSelection = parseSelection(selection);
  if (!parsedSelection.ok) {
    return Object.freeze({
      ok: false as const,
      reason: "invalid_selection" as const,
      detail: parsedSelection.detail,
    });
  }
  if (!isRecord(frozen)) {
    return Object.freeze({
      ok: false as const,
      reason: "invalid_frozen_economics" as const,
      detail: "frozen_not_object",
    });
  }

  const pricingVersionId = frozen.pricingVersionId;
  if (typeof pricingVersionId !== "string" || !UUID_RE.test(pricingVersionId)) {
    return Object.freeze({
      ok: false as const,
      reason: "invalid_frozen_economics" as const,
      detail: "pricing_version_invalid",
    });
  }
  if (!isRecord(frozen.pricing)) {
    return Object.freeze({
      ok: false as const,
      reason: "invalid_frozen_economics" as const,
      detail: "pricing_not_object",
    });
  }
  const pricing = frozen.pricing as ModelPricing;
  const coverage = evaluatePricingCoverage(pricing, pricingVersionId);
  if (!coverage.complete) {
    return Object.freeze({
      ok: false as const,
      reason: "invalid_frozen_economics" as const,
      detail: `pricing_coverage:${coverage.reason ?? "incomplete"}`,
    });
  }

  if (
    !Object.prototype.hasOwnProperty.call(frozen, "usdBrlRateAtGeneration") ||
    !Object.prototype.hasOwnProperty.call(frozen, "creditValueBrlAtGeneration")
  ) {
    return Object.freeze({
      ok: false as const,
      reason: "invalid_frozen_economics" as const,
      detail: "economic_values_missing",
    });
  }
  const usd = frozen.usdBrlRateAtGeneration;
  const credit = frozen.creditValueBrlAtGeneration;
  if (
    !(usd === null || (typeof usd === "number" && Number.isFinite(usd))) ||
    !(credit === null || (typeof credit === "number" && Number.isFinite(credit)))
  ) {
    return Object.freeze({
      ok: false as const,
      reason: "invalid_frozen_economics" as const,
      detail: "economic_values_invalid",
    });
  }

  const capturedAt = parseCapturedAt(frozen.capturedAt);
  if (capturedAt === null) {
    return Object.freeze({
      ok: false as const,
      reason: "invalid_frozen_economics" as const,
      detail: "captured_at_invalid",
    });
  }

  return Object.freeze({
    ok: true as const,
    frozen: Object.freeze({
      selection: parsedSelection.selection,
      pricingVersionId: pricingVersionId.toLowerCase(),
      pricing: Object.freeze({ ...pricing }),
      usdBrlRateAtGeneration: usd,
      creditValueBrlAtGeneration: credit,
      capturedAt,
    }),
  });
}

export interface FrozenExpansionReaders {
  readonly catalog: ExpansionCatalogReader;
  readonly pricing: ExpansionPricingReader;
  readonly readEconomicSnapshot: (input: {
    readonly campaignId: string;
    readonly storeId: string;
    readonly client?: unknown;
  }) => Promise<FrozenEconomicValues>;
  readonly preflightFrozenExpansion: (
    selection: ExpansionSelection,
  ) => Promise<ExpansionPreflightResult>;
}

function frozenCatalogRow(frozen: FrozenEconomics): AiModelCatalogRow {
  const id = `frozen:${frozen.selection.configVersionId}`;
  return Object.freeze({
    id,
    capability: "campaign_product_image",
    segment: "campaign",
    provider: "openai",
    model: frozen.selection.model,
    protocol: "images",
    label: null,
    status: "active",
    source_note: "frozen",
    validated_at: frozen.capturedAt,
    created_at: frozen.capturedAt,
    updated_at: frozen.capturedAt,
  });
}

function matchesFrozenSelection(
  frozen: FrozenEconomics,
  params: { provider: string; model: string; quality?: string },
): boolean {
  return (
    params.provider === "openai" &&
    params.model === frozen.selection.model &&
    (params.quality === undefined || params.quality === frozen.selection.quality)
  );
}

/**
 * Leitores estáticos para retomada: retornam exatamente o congelado e recusam
 * seleção divergente. Nenhuma leitura de catálogo/pricing/campanha é feita.
 */
export function createFrozenExpansionReaders(
  frozen: FrozenEconomics,
): FrozenExpansionReaders {
  const row = frozenCatalogRow(frozen);

  const catalog: ExpansionCatalogReader = {
    async getActiveCatalogRows() {
      return [row];
    },
    async readActiveCatalogRows(): Promise<AiModelCatalogReadResult> {
      return { kind: "ok", rows: [row] };
    },
  };

  const pricing: ExpansionPricingReader = {
    async getModelPricing(params) {
      if (!matchesFrozenSelection(frozen, params)) return null;
      return { pricing: frozen.pricing, versionId: frozen.pricingVersionId };
    },
    async readModelPricing(params) {
      if (!matchesFrozenSelection(frozen, params)) {
        return { kind: "read_failed", reason: "frozen_selection_mismatch" };
      }
      return {
        kind: "found",
        pricing: frozen.pricing,
        versionId: frozen.pricingVersionId,
      };
    },
  };

  const readEconomicSnapshot = async () => ({
    usdBrlRateAtGeneration: frozen.usdBrlRateAtGeneration,
    creditValueBrlAtGeneration: frozen.creditValueBrlAtGeneration,
  });

  return Object.freeze({
    catalog,
    pricing,
    readEconomicSnapshot,
    async preflightFrozenExpansion(selection: ExpansionSelection) {
      return preflightExpansionToNineSixteen({ catalog, pricing }, selection);
    },
  });
}
