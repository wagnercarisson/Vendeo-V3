/**
 * F60.6 — Contrato PURO da configuração administrativa da expansão 9:16.
 *
 * A configuração da expansão é **própria e independente**: uma única seleção
 * modelo + qualidade, sem par principal/auxiliar, sem `gpt-image-2` e sem
 * qualquer default em código. A lista é FECHADA e congelada em runtime.
 *
 * Este módulo é contrato/tipos e validação pura, reusado pela rota
 * administrativa e por ferramentas de prova. Nenhuma chamada a banco, provider
 * ou crédito acontece aqui.
 */

import {
  ELIGIBLE_IMAGE_QUALITIES,
  isEligibleImageQuality,
  type ImageQuality,
} from "@/lib/ai/image-model-pair";

/**
 * Lista FECHADA e congelada (runtime) dos modelos elegíveis **da expansão**.
 *
 * Exatamente duas famílias; `gpt-image-2` NÃO pertence a esta lista (o fluxo
 * Produto 1:1 tem catálogo próprio e não é reutilizado aqui).
 */
export const NINE_SIXTEEN_EXPANSION_MODELS = Object.freeze([
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
] as const);

export type NineSixteenExpansionModel = (typeof NINE_SIXTEEN_EXPANSION_MODELS)[number];

/**
 * Origem da seleção efetiva:
 * - `configured`: linha administrativa vigente, congelada em operação v2;
 * - `legacy_sunburst_low`: operação `contract_version = 1` (comportamento
 *   original Sunburst low), sem linha persistida e sem backfill.
 */
export type ExpansionSelectionOrigin = "configured" | "legacy_sunburst_low";

/** Seleção efetiva da expansão 9:16 (uma única combinação). */
export interface ExpansionSelection {
  model: NineSixteenExpansionModel;
  quality: ImageQuality;
  /** Versão da configuração congelada; `null` apenas no legado explícito. */
  configVersionId: string | null;
  origin: ExpansionSelectionOrigin;
}

/**
 * Seleção explícita das operações anteriores à F60.6 (`contract_version = 1`).
 *
 * É o comportamento original (Sunburst low) declarado como origem — nunca um
 * default aplicado por conveniência e nunca uma versão de configuração inventada.
 */
export const LEGACY_SUNBURST_LOW: ExpansionSelection = Object.freeze({
  model: "gpt-image-2.5-sunburst",
  quality: "low",
  configVersionId: null,
  origin: "legacy_sunburst_low",
});

/** Linha vigente singleton de `nine_sixteen_expansion_model_config`. */
export interface NineSixteenExpansionConfigRow {
  scope: "expansion";
  model: string;
  quality: string;
  config_version_id: string;
  reason: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

/** Código determinístico de modelo/qualidade fora da lista fechada. */
export const NINE_SIXTEEN_EXPANSION_MODEL_NOT_ELIGIBLE =
  "nine_sixteen_expansion_model_not_eligible" as const;

/** Código determinístico de configuração ausente (fail-closed, sem default). */
export const NINE_SIXTEEN_EXPANSION_CONFIG_MISSING =
  "nine_sixteen_expansion_config_missing" as const;

/** Código determinístico de linha divergente do contrato autorado. */
export const NINE_SIXTEEN_EXPANSION_CONFIG_DIVERGENT =
  "nine_sixteen_expansion_config_divergent" as const;

/** Campo da linha destacado por um erro de resolução. */
export type NineSixteenExpansionConfigField =
  | "model"
  | "quality"
  | "scope"
  | "config_version_id";

/** Erro tipado: modelo ou qualidade fora das listas fechadas (sem correção). */
export class NineSixteenExpansionModelNotEligibleError extends Error {
  readonly code = NINE_SIXTEEN_EXPANSION_MODEL_NOT_ELIGIBLE;
  readonly field: "model" | "quality";
  readonly value: string;

  constructor(field: "model" | "quality", value: string) {
    super(`${NINE_SIXTEEN_EXPANSION_MODEL_NOT_ELIGIBLE}:${field}`);
    this.name = "NineSixteenExpansionModelNotEligibleError";
    this.field = field;
    this.value = value;
  }
}

/** Erro tipado: configuração ausente — fail-closed, nunca origem `default`. */
export class NineSixteenExpansionConfigMissingError extends Error {
  readonly code = NINE_SIXTEEN_EXPANSION_CONFIG_MISSING;

  constructor() {
    super(NINE_SIXTEEN_EXPANSION_CONFIG_MISSING);
    this.name = "NineSixteenExpansionConfigMissingError";
  }
}

/** Erro tipado: linha presente mas divergente do contrato (corrupção). */
export class NineSixteenExpansionConfigDivergentError extends Error {
  readonly code = NINE_SIXTEEN_EXPANSION_CONFIG_DIVERGENT;
  readonly field: NineSixteenExpansionConfigField;

  constructor(field: NineSixteenExpansionConfigField) {
    super(`${NINE_SIXTEEN_EXPANSION_CONFIG_DIVERGENT}:${field}`);
    this.name = "NineSixteenExpansionConfigDivergentError";
    this.field = field;
  }
}

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** `true` quando o valor é um UUID v4 textual (versão de configuração). */
export function isNineSixteenConfigVersionId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_PATTERN.test(value);
}

/** `true` quando o modelo pertence à lista fechada da expansão. */
export function isNineSixteenExpansionModel(
  model: string,
): model is NineSixteenExpansionModel {
  return (NINE_SIXTEEN_EXPANSION_MODELS as readonly string[]).includes(model);
}

/**
 * Resolve a seleção efetiva a partir da linha vigente de forma **fail-closed**:
 * - linha ausente → `nine_sixteen_expansion_config_missing`;
 * - modelo/qualidade fora das listas → `nine_sixteen_expansion_model_not_eligible`
 *   com o campo violado (nunca corrige o valor);
 * - escopo ou versão divergentes → `nine_sixteen_expansion_config_divergent`.
 */
export function resolveNineSixteenExpansionConfigFromRow(
  row: NineSixteenExpansionConfigRow | null,
): ExpansionSelection {
  if (row === null || row === undefined) {
    throw new NineSixteenExpansionConfigMissingError();
  }

  const candidate: unknown = row;
  if (typeof candidate !== "object") {
    throw new NineSixteenExpansionConfigDivergentError("config_version_id");
  }

  const record = candidate as Record<string, unknown>;

  if (record.scope !== "expansion") {
    throw new NineSixteenExpansionConfigDivergentError("scope");
  }

  const model = typeof record.model === "string" ? record.model : "";
  if (!isNineSixteenExpansionModel(model)) {
    throw new NineSixteenExpansionModelNotEligibleError("model", model);
  }

  const quality = typeof record.quality === "string" ? record.quality : "";
  if (!isEligibleImageQuality(quality)) {
    throw new NineSixteenExpansionModelNotEligibleError("quality", quality);
  }

  const configVersionId = record.config_version_id;
  if (!isNineSixteenConfigVersionId(configVersionId)) {
    throw new NineSixteenExpansionConfigDivergentError("config_version_id");
  }

  return {
    model,
    quality,
    configVersionId,
    origin: "configured",
  };
}

/**
 * Guard estrito para fronteiras (planos 02/03): valida a forma completa da
 * seleção, inclusive a consistência entre origem e versão congelada.
 */
export function isExpansionSelection(value: unknown): value is ExpansionSelection {
  if (value === null || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  const model = typeof candidate.model === "string" ? candidate.model : "";
  if (!isNineSixteenExpansionModel(model)) return false;
  if (typeof candidate.quality !== "string" || !isEligibleImageQuality(candidate.quality)) {
    return false;
  }

  if (candidate.origin === LEGACY_SUNBURST_LOW.origin) {
    return (
      candidate.configVersionId === null &&
      model === LEGACY_SUNBURST_LOW.model &&
      candidate.quality === LEGACY_SUNBURST_LOW.quality
    );
  }

  if (candidate.origin !== "configured") return false;

  return isNineSixteenConfigVersionId(candidate.configVersionId);
}

/** Lista fechada das qualidades (reexportada para consumidores do contrato). */
export { ELIGIBLE_IMAGE_QUALITIES };
