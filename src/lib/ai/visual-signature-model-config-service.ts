import "server-only";

import {
  VISUAL_SIGNATURE_CONFIG_SCOPE,
  VISUAL_SIGNATURE_ENVIRONMENT_SCOPE,
  VisualSignatureConfigError,
  assertVisualSignatureConfigTuple,
  type VisualSignatureImagePreset,
  type VisualSignatureOrchestrator,
  type VisualSignatureReasoningEffort,
} from "./visual-signature-model-config";
import {
  VisualSignatureValidationGuardError,
  assertVisualSignatureValidationEnvironment,
  isVisualSignatureValidationOptedIn,
  type VisualSignatureValidationEnvironment,
} from "@/lib/visual-signature/local-validation/guard";

/**
 * F47.1 (D4) — leitura e classificação da configuração dedicada da VS.
 *
 * Regras invioláveis:
 * - opt-in desligado ⇒ `legacy`, SEM consultar a tabela;
 * - a linha é lida UMA única vez por operação (sem cache compartilhado);
 * - ausência confirmada (sem linha) ⇒ `legacy`;
 * - falha de leitura ⇒ erro explícito (NUNCA tratada como ausência);
 * - linha divergente ⇒ erro explícito;
 * - linha de outro ambiente/identidade ⇒ erro explícito;
 * - sucesso ⇒ snapshot CONGELADO com orquestrador, preset, modelo, qualidade,
 *   reasoning `low`, versão e identidade.
 */

export interface VisualSignatureModelConfigRow {
  scope: string;
  environment_scope: string;
  instance_identity: string;
  orchestrator_model: string;
  image_preset: string;
  image_model: string;
  image_quality: string;
  reasoning_effort: string;
  config_version_id: string;
  /** F47.1 admin (D10): auditoria da configuração vigente. */
  reason?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface VisualSignatureModelConfigReader {
  read(): Promise<VisualSignatureModelConfigRow | null>;
}

export class VisualSignatureConfigReadError extends Error {
  readonly code = "visual_signature_model_config_read_failed" as const;

  constructor(options?: { cause?: unknown }) {
    super("visual_signature_model_config_read_failed", options);
    this.name = "VisualSignatureConfigReadError";
  }
}

export class VisualSignatureConfigDivergentError extends Error {
  readonly code = "visual_signature_model_config_divergent" as const;

  constructor(
    readonly detail: string,
    options?: { cause?: unknown },
  ) {
    super(`visual_signature_model_config_divergent:${detail}`, options);
    this.name = "VisualSignatureConfigDivergentError";
  }
}

export class VisualSignatureConfigOutsideEnvironmentError extends Error {
  readonly code = "visual_signature_config_outside_approved_environment" as const;

  constructor() {
    super("visual_signature_config_outside_approved_environment");
    this.name = "VisualSignatureConfigOutsideEnvironmentError";
  }
}

export interface VisualSignatureDedicatedConfigSnapshot {
  readonly mode: "dedicated";
  readonly orchestratorModel: VisualSignatureOrchestrator;
  readonly imagePreset: VisualSignatureImagePreset;
  readonly imageModel: string;
  readonly imageQuality: "low" | "medium";
  readonly reasoningEffort: VisualSignatureReasoningEffort;
  readonly configVersionId: string;
  readonly instanceIdentity: string;
}

export interface VisualSignatureLegacyConfigSnapshot {
  readonly mode: "legacy";
}

export type VisualSignatureModelConfigSnapshot =
  | VisualSignatureDedicatedConfigSnapshot
  | VisualSignatureLegacyConfigSnapshot;

/** Snapshot legado compartilhado (imutável) — nenhuma linha foi consultada. */
export const LEGACY_VISUAL_SIGNATURE_MODEL_CONFIG: VisualSignatureLegacyConfigSnapshot =
  Object.freeze({ mode: "legacy" });

export interface LoadVisualSignatureModelConfigOptions {
  reader?: VisualSignatureModelConfigReader;
  assertEnvironment?: () => VisualSignatureValidationEnvironment;
  isOptedIn?: () => boolean;
}

async function readRowFromSupabase(): Promise<VisualSignatureModelConfigRow | null> {
  const { supabaseAdmin } = await import("@/lib/supabase/server");
  const { data, error } = await supabaseAdmin
    .from("visual_signature_model_config")
    .select(
      "scope, environment_scope, instance_identity, orchestrator_model, image_preset, image_model, image_quality, reasoning_effort, config_version_id, reason, updated_by, updated_at",
    )
    .eq("scope", VISUAL_SIGNATURE_CONFIG_SCOPE)
    .maybeSingle();

  if (error) throw new VisualSignatureConfigReadError({ cause: error });
  return (data as VisualSignatureModelConfigRow | null) ?? null;
}

/**
 * F47.1 (D10) — leitura ADMIN da linha vigente (somente leitura).
 *
 * Diferente de `loadVisualSignatureModelConfigSnapshot`, NÃO aplica o guard de
 * opt-in: a tela administrativa precisa diagnosticar a configuração mesmo
 * quando o opt-in está desligado. Nenhuma escrita ocorre aqui.
 */
export async function readVisualSignatureModelConfigRowForAdmin(): Promise<VisualSignatureModelConfigRow | null> {
  return readRowFromSupabase();
}

const defaultReader: VisualSignatureModelConfigReader = { read: readRowFromSupabase };

export async function loadVisualSignatureModelConfigSnapshot(
  options: LoadVisualSignatureModelConfigOptions = {},
): Promise<VisualSignatureModelConfigSnapshot> {
  const isOptedIn = options.isOptedIn ?? isVisualSignatureValidationOptedIn;

  // Opt-in desligado: a configuração dedicada NÃO é consumida (legado puro).
  if (!isOptedIn()) return LEGACY_VISUAL_SIGNATURE_MODEL_CONFIG;

  // Opt-in ligado: qualquer falha do guard propaga (fail-closed ANTES de
  // débito/provider). A opção injetável existe apenas para testes.
  const assertEnvironment = options.assertEnvironment ?? assertVisualSignatureValidationEnvironment;
  const environment = assertEnvironment();

  const reader = options.reader ?? defaultReader;
  let row: VisualSignatureModelConfigRow | null;
  try {
    row = await reader.read();
  } catch (error) {
    if (error instanceof VisualSignatureConfigReadError) throw error;
    throw new VisualSignatureConfigReadError({ cause: error });
  }

  // Ausência CONFIRMADA (sem linha) ⇒ legado.
  if (!row) return LEGACY_VISUAL_SIGNATURE_MODEL_CONFIG;

  if (
    row.environment_scope !== VISUAL_SIGNATURE_ENVIRONMENT_SCOPE ||
    row.instance_identity !== environment.instanceIdentity
  ) {
    throw new VisualSignatureConfigOutsideEnvironmentError();
  }

  try {
    assertVisualSignatureConfigTuple({
      orchestratorModel: row.orchestrator_model,
      imagePreset: row.image_preset,
      imageModel: row.image_model,
      imageQuality: row.image_quality,
      reasoningEffort: row.reasoning_effort,
    });
  } catch (error) {
    if (error instanceof VisualSignatureConfigError) {
      throw new VisualSignatureConfigDivergentError(error.code, { cause: error });
    }
    if (error instanceof VisualSignatureValidationGuardError) throw error;
    throw new VisualSignatureConfigDivergentError("invalid_tuple", { cause: error });
  }

  return Object.freeze({
    mode: "dedicated",
    orchestratorModel: row.orchestrator_model as VisualSignatureOrchestrator,
    imagePreset: row.image_preset as VisualSignatureImagePreset,
    imageModel: row.image_model,
    imageQuality: row.image_quality as "low" | "medium",
    reasoningEffort: "low",
    configVersionId: row.config_version_id,
    instanceIdentity: row.instance_identity,
  });
}

/**
 * Ponto ÚNICO de invalidação de cache da configuração dedicada.
 *
 * Hoje NÃO existe cache persistente (cada operação lê a linha uma única vez).
 * A API admin do plano 04 chama esta função após mutação para que qualquer
 * cache futuro não sirva dado velho.
 */
export function invalidateVisualSignatureModelConfigCache(): void {
  // intencionalmente vazio (sem cache hoje)
}
