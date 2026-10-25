import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * F47.3 — leitura da configuração dedicada da Assinatura Visual
 * (`visual_signature_model_config`, singleton `scope='visual_signature'`).
 *
 * Fronteira: a linha é gravada exclusivamente pela RPC v3 (`SECURITY DEFINER`)
 * e o runtime apenas a lê com `service_role` (grant só SELECT). O conteúdo é
 * tratado como NÃO confiável: listas fechadas, preset recalculado e
 * comparação com o persistido. Nada além da única leitura acontece aqui — sem
 * cache, sem flags, sem checagem de publicação/ativação/piloto/ambiente.
 */

export const VISUAL_SIGNATURE_ORCHESTRATOR_MODELS = ["gpt-5.5", "gpt-6-luna"] as const;
export const VISUAL_SIGNATURE_IMAGE_MODELS = [
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
] as const;
export const VISUAL_SIGNATURE_IMAGE_QUALITIES = ["low", "medium"] as const;

export type VisualSignatureOrchestratorModel =
  (typeof VISUAL_SIGNATURE_ORCHESTRATOR_MODELS)[number];
export type VisualSignatureImageModel = (typeof VISUAL_SIGNATURE_IMAGE_MODELS)[number];
export type VisualSignatureImageQuality = (typeof VISUAL_SIGNATURE_IMAGE_QUALITIES)[number];
export type VisualSignatureImagePreset =
  | "flare_low"
  | "flare_medium"
  | "sunburst_low"
  | "sunburst_medium";

/** Snapshot imutável consumido por UMA operação (uma resolução por operação). */
export interface VisualSignatureGenerationConfig {
  orchestratorModel: VisualSignatureOrchestratorModel;
  imageModel: VisualSignatureImageModel;
  imageQuality: VisualSignatureImageQuality;
  imagePreset: VisualSignatureImagePreset;
  configVersionId: string;
}

/**
 * Resolução da configuração: `dedicated` quando a linha existe e é válida;
 * `legacy` quando a ausência é CONFIRMADA (data null, error null) — caminho
 * legítimo que preserva byte-a-byte o comportamento anterior.
 */
export type VisualSignatureGenerationConfigResolution =
  | { source: "dedicated"; config: VisualSignatureGenerationConfig }
  | { source: "legacy"; config: null };

export const VISUAL_SIGNATURE_MODEL_CONFIG_READ_FAILED =
  "visual_signature_model_config_read_failed" as const;
export const VISUAL_SIGNATURE_MODEL_CONFIG_INVALID =
  "visual_signature_model_config_invalid" as const;

/**
 * Erro tipado de configuração. A mensagem carrega apenas `code` + detalhe do
 * campo (`code:detail`) — nunca a linha completa, credenciais ou URL.
 */
export class VisualSignatureModelConfigError extends Error {
  readonly code:
    | typeof VISUAL_SIGNATURE_MODEL_CONFIG_READ_FAILED
    | typeof VISUAL_SIGNATURE_MODEL_CONFIG_INVALID;

  constructor(
    code:
      | typeof VISUAL_SIGNATURE_MODEL_CONFIG_READ_FAILED
      | typeof VISUAL_SIGNATURE_MODEL_CONFIG_INVALID,
    detail?: string,
  ) {
    super(detail ? `${code}:${detail}` : code);
    this.name = "VisualSignatureModelConfigError";
    this.code = code;
  }
}

/** Linha lida (snake_case) — todos os campos podem vir nulos do banco. */
interface VisualSignatureModelConfigRow {
  orchestrator_model: string | null;
  image_model: string | null;
  image_quality: string | null;
  image_preset: string | null;
  config_version_id: string | null;
}

const PRESET_TABLE: Record<string, VisualSignatureImagePreset> = {
  "gpt-image-2.5-flare|low": "flare_low",
  "gpt-image-2.5-flare|medium": "flare_medium",
  "gpt-image-2.5-sunburst|low": "sunburst_low",
  "gpt-image-2.5-sunburst|medium": "sunburst_medium",
};

/**
 * Deriva o preset a partir do par `modelo|qualidade`. Fonte ÚNICA do preset no
 * runtime: o valor persistido nunca é aceito como fonte independente. Qualquer
 * par fora da tabela fechada lança `invalid`.
 */
export function deriveVisualSignaturePreset(
  imageModel: string,
  imageQuality: string,
): VisualSignatureImagePreset {
  const preset = PRESET_TABLE[`${imageModel}|${imageQuality}`];
  if (!preset) {
    throw new VisualSignatureModelConfigError(
      VISUAL_SIGNATURE_MODEL_CONFIG_INVALID,
      "invalid_preset_tuple",
    );
  }
  return preset;
}

function includes<T extends string>(list: readonly T[], value: string | null): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/**
 * Resolve a configuração dedicada. `client` é injetável apenas para testes; o
 * default é o client `service_role` do servidor.
 */
export async function resolveVisualSignatureGenerationConfig(
  client: Pick<SupabaseClient, "from"> = supabaseAdmin,
): Promise<VisualSignatureGenerationConfigResolution> {
  const { data, error } = await client
    .from("visual_signature_model_config")
    .select("orchestrator_model,image_model,image_quality,image_preset,config_version_id")
    .eq("scope", "visual_signature")
    .maybeSingle();

  if (error) {
    throw new VisualSignatureModelConfigError(
      VISUAL_SIGNATURE_MODEL_CONFIG_READ_FAILED,
      error.message,
    );
  }

  if (!data) {
    return { source: "legacy", config: null };
  }

  const row = data as unknown as VisualSignatureModelConfigRow;

  if (!includes(VISUAL_SIGNATURE_ORCHESTRATOR_MODELS, row.orchestrator_model)) {
    throw new VisualSignatureModelConfigError(
      VISUAL_SIGNATURE_MODEL_CONFIG_INVALID,
      "orchestrator_model",
    );
  }
  const orchestratorModel = row.orchestrator_model;

  if (!includes(VISUAL_SIGNATURE_IMAGE_MODELS, row.image_model)) {
    throw new VisualSignatureModelConfigError(
      VISUAL_SIGNATURE_MODEL_CONFIG_INVALID,
      "image_model",
    );
  }
  const imageModel = row.image_model;

  if (!includes(VISUAL_SIGNATURE_IMAGE_QUALITIES, row.image_quality)) {
    throw new VisualSignatureModelConfigError(
      VISUAL_SIGNATURE_MODEL_CONFIG_INVALID,
      "image_quality",
    );
  }
  const imageQuality = row.image_quality;

  if (typeof row.config_version_id !== "string" || row.config_version_id.trim() === "") {
    throw new VisualSignatureModelConfigError(
      VISUAL_SIGNATURE_MODEL_CONFIG_INVALID,
      "config_version_id",
    );
  }
  const configVersionId = row.config_version_id;

  const expectedPreset = deriveVisualSignaturePreset(imageModel, imageQuality);
  if (row.image_preset !== expectedPreset) {
    throw new VisualSignatureModelConfigError(
      VISUAL_SIGNATURE_MODEL_CONFIG_INVALID,
      "image_preset",
    );
  }

  return {
    source: "dedicated",
    config: {
      orchestratorModel,
      imageModel,
      imageQuality,
      imagePreset: expectedPreset,
      configVersionId,
    },
  };
}
