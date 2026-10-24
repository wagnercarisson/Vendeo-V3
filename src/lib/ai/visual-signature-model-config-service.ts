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
import type { VisualSignatureEnvironment } from "@/lib/visual-signature/local-validation/environment-contract";
import {
  assertVisualSignatureEnvironmentIdentity,
  isVisualSignatureEnvironmentEnabled,
  resolveVisualSignatureEnvironment,
  VisualSignatureValidationGuardError,
  type VisualSignatureValidationEnvironment,
} from "@/lib/visual-signature/local-validation/guard";
import { readVisualSignatureApiKey } from "@/lib/ai/api-keys";

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

export interface VisualSignatureReleaseRow {
  published_config_version_id: string | null;
  activated_config_version_id: string | null;
  activation_mode: "none" | "pilot" | "general";
  environment_scope: string;
  instance_identity: string;
  updated_at?: string | null;
  last_operation_id?: string | null;
}

export interface VisualSignatureReleaseReader {
  read(): Promise<VisualSignatureReleaseRow | null>;
}

export interface VisualSignaturePilotStoreReader {
  read(): Promise<string[]>;
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

export class VisualSignatureConfigConcurrentChangeError extends Error {
  readonly code = "visual_signature_release_changed_during_read" as const;

  constructor() {
    super("visual_signature_release_changed_during_read");
    this.name = "VisualSignatureConfigConcurrentChangeError";
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
  /** Presentes apenas quando o estado de liberação foi consultado. */
  readonly environment?: VisualSignatureEnvironment;
  readonly publishedConfigVersionId?: string | null;
  readonly activatedConfigVersionId?: string | null;
  readonly activationMode?: "none" | "pilot" | "general";
  readonly pilotEligible?: boolean;
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
  releaseReader?: VisualSignatureReleaseReader;
  pilotStoreReader?: VisualSignaturePilotStoreReader;
  storeId?: string;
  assertEnvironment?: () => VisualSignatureValidationEnvironment;
  assertCredential?: () => void;
  resolveEnvironment?: () => VisualSignatureEnvironment;
  isOptedIn?: () => boolean;
}

/**
 * F47.1 (D10) — diagnóstico discriminado usando as MESMAS regras do runtime.
 *
 * - `inherited/opt_in_disabled`: opt-in desligado; tabela não consultada.
 * - `inherited/absent`: guard válido e ausência confirmada.
 * - `dedicated`: guard, identidade e tuple válidos.
 * - `blocked`: guard, leitura, identidade ou tuple falharam.
 *
 * O diagnóstico não cria um segundo contrato de decisão: `load...Snapshot`
 * consome este mesmo resultado e re-lança o erro original.
 */
export type VisualSignatureModelConfigDiagnostic =
  | {
      status: "dedicated";
      snapshot: VisualSignatureDedicatedConfigSnapshot;
      row: VisualSignatureModelConfigRow;
    }
  | {
      status: "inherited";
      reason: "opt_in_disabled" | "absent" | "not_published" | "not_activated" | "outside_pilot";
    }
  | {
      status: "blocked";
      reason: "guard" | "read_failure" | "identity" | "tuple" | "release_read_failure" | "concurrent_change";
      code: string | null;
      error: unknown;
    };

export async function resolveVisualSignatureModelConfigDiagnostic(
  options: LoadVisualSignatureModelConfigOptions = {},
): Promise<VisualSignatureModelConfigDiagnostic> {
  const resolveEnvironment = options.resolveEnvironment ?? resolveVisualSignatureEnvironment;
  let declaredEnvironment: VisualSignatureEnvironment;
  try {
    declaredEnvironment = resolveEnvironment();
  } catch (error) {
    return {
      status: "blocked",
      reason: "guard",
      code: error instanceof VisualSignatureValidationGuardError ? error.code : null,
      error,
    };
  }

  const enabled = options.isOptedIn
    ? options.isOptedIn()
    : isVisualSignatureEnvironmentEnabled(declaredEnvironment);
  if (!enabled) {
    return { status: "inherited", reason: "opt_in_disabled" };
  }

  const assertEnvironment =
    options.assertEnvironment ?? assertVisualSignatureEnvironmentIdentity;
  let environment: VisualSignatureValidationEnvironment;
  try {
    environment = assertEnvironment();
  } catch (error) {
    return {
      status: "blocked",
      reason: "guard",
      code: error instanceof VisualSignatureValidationGuardError ? error.code : null,
      error,
    };
  }

  const reader = options.reader ?? defaultReader;
  let row: VisualSignatureModelConfigRow | null;
  try {
    row = await reader.read();
  } catch (error) {
    const readError =
      error instanceof VisualSignatureConfigReadError
        ? error
        : new VisualSignatureConfigReadError({ cause: error });
    return {
      status: "blocked",
      reason: "read_failure",
      code: readError.code,
      error: readError,
    };
  }

  if (!row) {
    return { status: "inherited", reason: "absent" };
  }

  if (
    row.environment_scope !== (environment.environment ?? VISUAL_SIGNATURE_ENVIRONMENT_SCOPE) ||
    row.instance_identity !== environment.instanceIdentity
  ) {
    const error = new VisualSignatureConfigOutsideEnvironmentError();
    return { status: "blocked", reason: "identity", code: error.code, error };
  }

  const useRelease = options.releaseReader !== undefined || options.reader === undefined;
  let release: VisualSignatureReleaseRow | null = null;
  let pilotStores: string[] = [];
  if (useRelease) {
    const releaseReader = options.releaseReader ?? defaultReleaseReader;
    try {
      release = await releaseReader.read();
    } catch (error) {
      return {
        status: "blocked",
        reason: "release_read_failure",
        code: "visual_signature_release_read_failed",
        error,
      };
    }

    if (!release) {
      return { status: "inherited", reason: "not_published" };
    }
    const declaredEnvironment = environment.environment ?? VISUAL_SIGNATURE_ENVIRONMENT_SCOPE;
    if (
      release.environment_scope !== declaredEnvironment ||
      release.instance_identity !== environment.instanceIdentity
    ) {
      const error = new VisualSignatureConfigOutsideEnvironmentError();
      return { status: "blocked", reason: "identity", code: error.code, error };
    }
    if (release.published_config_version_id !== row.config_version_id) {
      return { status: "inherited", reason: "not_published" };
    }
    if (
      release.activated_config_version_id !== row.config_version_id ||
      release.activation_mode === "none"
    ) {
      return { status: "inherited", reason: "not_activated" };
    }

    if (release.activation_mode === "pilot") {
      try {
        pilotStores = await (options.pilotStoreReader ?? defaultPilotStoreReader).read();
      } catch (error) {
        return {
          status: "blocked",
          reason: "release_read_failure",
          code: "visual_signature_pilot_read_failed",
          error,
        };
      }
      if (options.storeId === undefined) {
        return { status: "inherited", reason: "outside_pilot" };
      }
      if (!pilotStores.includes(options.storeId)) {
        return { status: "inherited", reason: "outside_pilot" };
      }
    }

    // Consistência entre config/release/allowlist: o release é relido após as
    // consultas independentes. Se mudou, o conjunto é de momentos diferentes.
    try {
      const releaseAgain = await releaseReader.read();
      const signature = (value: VisualSignatureReleaseRow | null) =>
        value
          ? JSON.stringify([
              value.published_config_version_id,
              value.activated_config_version_id,
              value.activation_mode,
              value.environment_scope,
              value.instance_identity,
              value.updated_at ?? null,
              value.last_operation_id ?? null,
            ])
          : "null";
      if (signature(release) !== signature(releaseAgain)) {
        const error = new VisualSignatureConfigConcurrentChangeError();
        return {
          status: "blocked",
          reason: "concurrent_change",
          code: error.code,
          error,
        };
      }
    } catch (error) {
      return {
        status: "blocked",
        reason: "release_read_failure",
        code: "visual_signature_release_read_failed",
        error,
      };
    }
  }

  // A credencial só é exigida quando a operação é elegível para o caminho
  // dedicado; lojas fora do piloto/desativadas seguem no legado sem provider.
  if (useRelease) {
    try {
      if (options.assertCredential) options.assertCredential();
      else if (options.reader === undefined) {
        readVisualSignatureApiKey(
          "openai",
          environment.environment ?? "local_validation",
        );
      }
    } catch (error) {
      return {
        status: "blocked",
        reason: "guard",
        code: error instanceof Error ? error.message : "visual_signature_validation_provider_key_missing",
        error,
      };
    }
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
    const tupleError =
      error instanceof VisualSignatureConfigError
        ? new VisualSignatureConfigDivergentError(error.code, { cause: error })
        : error instanceof VisualSignatureValidationGuardError
          ? error
          : new VisualSignatureConfigDivergentError("invalid_tuple", { cause: error });
    return {
      status: "blocked",
      reason: "tuple",
      code:
        tupleError instanceof VisualSignatureConfigDivergentError
          ? tupleError.detail
          : tupleError instanceof VisualSignatureValidationGuardError
            ? tupleError.code
            : null,
      error: tupleError,
    };
  }

  const snapshot: VisualSignatureDedicatedConfigSnapshot = Object.freeze({
    mode: "dedicated",
    orchestratorModel: row.orchestrator_model as VisualSignatureOrchestrator,
    imagePreset: row.image_preset as VisualSignatureImagePreset,
    imageModel: row.image_model,
    imageQuality: row.image_quality as "low" | "medium",
    reasoningEffort: "low",
    configVersionId: row.config_version_id,
    instanceIdentity: row.instance_identity,
    ...(useRelease && release
      ? {
          environment: (environment.environment ?? VISUAL_SIGNATURE_ENVIRONMENT_SCOPE) as VisualSignatureEnvironment,
          publishedConfigVersionId: release.published_config_version_id,
          activatedConfigVersionId: release.activated_config_version_id,
          activationMode: release.activation_mode,
          pilotEligible:
            release.activation_mode === "general" ||
            (options.storeId !== undefined && pilotStores.includes(options.storeId)),
        }
      : {}),
  });

  return { status: "dedicated", snapshot, row };
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

export async function readVisualSignatureModelConfigReleaseForAdmin(): Promise<VisualSignatureReleaseRow | null> {
  return readReleaseFromSupabase();
}

const defaultReader: VisualSignatureModelConfigReader = { read: readRowFromSupabase };

async function readReleaseFromSupabase(): Promise<VisualSignatureReleaseRow | null> {
  const { supabaseAdmin } = await import("@/lib/supabase/server");
  const { data, error } = await supabaseAdmin
    .from("visual_signature_model_config_release")
    .select("published_config_version_id, activated_config_version_id, activation_mode, environment_scope, instance_identity")
    .eq("scope", VISUAL_SIGNATURE_CONFIG_SCOPE)
    .maybeSingle();
  if (error) throw error;
  return (data as VisualSignatureReleaseRow | null) ?? null;
}

async function readPilotStoresFromSupabase(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/lib/supabase/server");
  const { data, error } = await supabaseAdmin
    .from("visual_signature_model_config_pilot_stores")
    .select("store_id");
  if (error) throw error;
  return (data ?? []).map((row: { store_id: string }) => row.store_id);
}

const defaultReleaseReader: VisualSignatureReleaseReader = { read: readReleaseFromSupabase };
const defaultPilotStoreReader: VisualSignaturePilotStoreReader = { read: readPilotStoresFromSupabase };

export async function loadVisualSignatureModelConfigSnapshot(
  options: LoadVisualSignatureModelConfigOptions = {},
): Promise<VisualSignatureModelConfigSnapshot> {
  const diagnostic = await resolveVisualSignatureModelConfigDiagnostic(options);

  if (diagnostic.status === "dedicated") return diagnostic.snapshot;
  if (diagnostic.status === "inherited") return LEGACY_VISUAL_SIGNATURE_MODEL_CONFIG;

  // Mesmo erro tipado produzido pelas regras do runtime — nunca convertido em
  // ausência/legado.
  if (diagnostic.error instanceof Error) throw diagnostic.error;
  throw new Error("visual_signature_model_config_diagnostic_failed");
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
