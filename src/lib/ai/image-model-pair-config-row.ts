import {
  assertEligibleModelPair,
  ImageModelPairNotEligibleError,
  type ImageModelPair,
  type ImageModelPairConfig,
  type ImagePairConfigOrigin,
  type ImageQuality,
} from "./image-model-pair";

/**
 * F59 — Contrato PURO da linha vigente de `image_model_pair_config` e sua
 * resolução fail-closed.
 *
 * Este módulo não tem `server-only` para permitir que ferramentas de prova
 * (CLI/harness) leiam a MESMA configuração efetiva do fluxo 1:1. O serviço
 * server-side reexporta estes contratos; nenhum comportamento do 1:1 muda.
 */

/** Linha vigente singleton de `image_model_pair_config` (scope `new_flow`). */
export interface ImageModelPairConfigRow {
  scope: string;
  primary_model: string;
  primary_quality: string;
  fallback_model: string;
  fallback_quality: string;
  config_version_id: string;
  reason: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

/** Configuração vigente resolvida: par + versão + origem. */
export interface ResolvedImageModelPairConfig extends ImageModelPairConfig {
  configVersionId: string;
  origin: ImagePairConfigOrigin;
  updatedBy: string | null;
  updatedAt: string;
  reason: string | null;
}

/** Código determinístico de configuração ausente/incompleta (D-06). */
export const IMAGE_MODEL_PAIR_CONFIG_MISSING =
  "image_model_pair_config_missing" as const;

/** Erro tipado: configuração ausente ou incompleta — fail-closed, sem default. */
export class ImageModelPairConfigMissingError extends Error {
  readonly code = IMAGE_MODEL_PAIR_CONFIG_MISSING;

  constructor() {
    super(IMAGE_MODEL_PAIR_CONFIG_MISSING);
    this.name = "ImageModelPairConfigMissingError";
  }
}

/** Código determinístico de configuração divergente do catálogo elegível (D-06). */
export const IMAGE_MODEL_PAIR_CONFIG_DIVERGENT =
  "image_model_pair_config_divergent" as const;

/** Erro tipado: configuração aponta para modelo/qualidade fora do catálogo. */
export class ImageModelPairConfigDivergentError extends Error {
  readonly code = IMAGE_MODEL_PAIR_CONFIG_DIVERGENT;
  readonly field: "model" | "quality";
  readonly pair: ImageModelPair;

  constructor(pair: ImageModelPair, field: "model" | "quality") {
    super(`${IMAGE_MODEL_PAIR_CONFIG_DIVERGENT}:${field}`);
    this.name = "ImageModelPairConfigDivergentError";
    this.field = field;
    this.pair = pair;
  }
}

function isCompleteRow(row: ImageModelPairConfigRow): boolean {
  return Boolean(
    row.primary_model &&
      row.primary_quality &&
      row.fallback_model &&
      row.fallback_quality &&
      row.config_version_id,
  );
}

/**
 * Origem da configuração vigente. Presença de autor registra decisão humana;
 * sem autor (linha semeada manualmente) a procedência é a seleção.
 */
export function resolveImageModelPairConfigOrigin(
  row: ImageModelPairConfigRow,
): ImagePairConfigOrigin {
  return row.updated_by ? "human_decision" : "selection";
}

/**
 * Resolve a configuração a partir da linha vigente de forma fail-closed:
 * linha ausente/incompleta → missing; par fora do catálogo → divergent.
 */
export function resolveImageModelPairConfigFromRow(
  row: ImageModelPairConfigRow | null,
): ResolvedImageModelPairConfig {
  if (!row) throw new ImageModelPairConfigMissingError();
  if (!isCompleteRow(row)) throw new ImageModelPairConfigMissingError();

  const primary: ImageModelPair = {
    model: row.primary_model,
    quality: row.primary_quality as ImageQuality,
  };
  const fallback: ImageModelPair = {
    model: row.fallback_model,
    quality: row.fallback_quality as ImageQuality,
  };

  try {
    assertEligibleModelPair(primary);
    assertEligibleModelPair(fallback);
  } catch (error) {
    if (error instanceof ImageModelPairNotEligibleError) {
      throw new ImageModelPairConfigDivergentError(error.pair, error.field);
    }
    throw error;
  }

  return {
    primary,
    fallback,
    configVersionId: row.config_version_id,
    origin: resolveImageModelPairConfigOrigin(row),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    reason: row.reason,
  };
}
