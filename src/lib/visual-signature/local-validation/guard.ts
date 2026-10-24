import "server-only";

import { readVisualSignatureApiKey } from "@/lib/ai/api-keys";
import {
  VISUAL_SIGNATURE_ENVIRONMENT_ERRORS,
  VisualSignatureEnvironmentError,
  VisualSignatureLocalEnvironmentError,
  resolveSupabaseEndpointForEnvironment,
  type VisualSignatureEnvironment,
} from "./environment-contract";

/**
 * F47.2 — Guard server-only do ambiente operacional da Assinatura Visual.
 *
 * Produção é selecionada exclusivamente por VERCEL_ENV; preview é sempre
 * recusado. As proteções locais e a credencial dedicada de validação permanecem.
 */

export type VisualSignatureValidationGuardErrorCode =
  | "visual_signature_validation_disabled"
  | "visual_signature_validation_not_local"
  | "visual_signature_validation_endpoint_not_loopback"
  | "visual_signature_validation_instance_mismatch"
  | "visual_signature_validation_provider_key_missing"
  | "visual_signature_environment_missing"
  | "visual_signature_environment_invalid"
  | "visual_signature_preview_forbidden"
  | "visual_signature_production_disabled"
  | "visual_signature_production_ref_missing"
  | "visual_signature_production_ref_mismatch"
  | "visual_signature_production_endpoint_invalid";

export class VisualSignatureValidationGuardError extends Error {
  readonly code: VisualSignatureValidationGuardErrorCode;

  constructor(code: VisualSignatureValidationGuardErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "VisualSignatureValidationGuardError";
    this.code = code;
  }
}

export interface VisualSignatureValidationEnvironment {
  readonly environment?: VisualSignatureEnvironment;
  readonly instanceIdentity: string;
  readonly supabaseOrigin: string;
  readonly apiKey?: string;
}

/** Opt-in explícito do laboratório; qualquer outro valor é off. */
export function isVisualSignatureValidationOptedIn(): boolean {
  return process.env.VENDEO_VS_VALIDATION_ENABLED === "1";
}

/** Produção é determinada pelo ambiente Vercel; validação local segue opt-in. */
export function isVisualSignatureEnvironmentEnabled(
  environment: VisualSignatureEnvironment,
): boolean {
  return environment === "production" || isVisualSignatureValidationOptedIn();
}

/**
 * Seleciona produção somente em Vercel Production; preview é bloqueado e os
 * demais ambientes continuam no caminho de validação local.
 */
export function resolveVisualSignatureEnvironment(
  env: Record<string, string | undefined> = process.env,
): VisualSignatureEnvironment {
  if (env.VERCEL_ENV === "preview") {
    throw new VisualSignatureValidationGuardError("visual_signature_preview_forbidden");
  }

  if (env.VERCEL_ENV === "production") return "production";
  return "local_validation";
}

function deriveProjectRef(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("invalid_supabase_url");
  }
  const match = parsed.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
  if (!match) throw new Error("invalid_supabase_project_ref");
  return match[1];
}

function mapEndpointError(error: unknown): VisualSignatureValidationGuardError {
  if (error instanceof VisualSignatureEnvironmentError) {
    const code =
      error.code === VISUAL_SIGNATURE_ENVIRONMENT_ERRORS.production_ref_missing
        ? "visual_signature_production_ref_missing"
        : error.code === VISUAL_SIGNATURE_ENVIRONMENT_ERRORS.production_ref_mismatch
          ? "visual_signature_production_ref_mismatch"
          : "visual_signature_production_endpoint_invalid";
    return new VisualSignatureValidationGuardError(code, { cause: error });
  }
  return new VisualSignatureValidationGuardError(
    "visual_signature_validation_endpoint_not_loopback",
    { cause: error instanceof VisualSignatureLocalEnvironmentError ? error.code : error },
  );
}

function resolveCanonicalInstanceIdentity(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw || raw.trim() === "") {
    throw new Error("instance_identity_missing");
  }
  const url = new URL(raw);
  if (!url.host) throw new Error("instance_identity_invalid");
  return url.host;
}

export function assertVisualSignatureEnvironmentIdentity(): VisualSignatureValidationEnvironment {
  const environment = resolveVisualSignatureEnvironment();

  if (!isVisualSignatureEnvironmentEnabled(environment)) {
    throw new VisualSignatureValidationGuardError(
      environment === "production"
        ? "visual_signature_production_disabled"
        : "visual_signature_validation_disabled",
    );
  }

  if (environment === "local_validation") {
    if (process.env.NODE_ENV === "production") {
      throw new VisualSignatureValidationGuardError("visual_signature_validation_not_local");
    }
    if (typeof process.env.VERCEL === "string" && process.env.VERCEL !== "") {
      throw new VisualSignatureValidationGuardError("visual_signature_validation_not_local");
    }
  }

  const primaryUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secondaryUrl = process.env.SUPABASE_URL;
  let projectRef = "";
  if (environment === "production") {
    try {
      if (!primaryUrl || !primaryUrl.trim()) throw new Error("missing_supabase_url");
      projectRef = deriveProjectRef(primaryUrl);
      if (secondaryUrl?.trim() && deriveProjectRef(secondaryUrl) !== projectRef) {
        throw new Error("supabase_urls_disagree");
      }
    } catch (error) {
      throw new VisualSignatureValidationGuardError(
        "visual_signature_production_endpoint_invalid",
        { cause: error },
      );
    }
  }

  let endpoint: { origin: string };
  try {
    endpoint = resolveSupabaseEndpointForEnvironment(
      typeof primaryUrl === "string" ? primaryUrl : "",
      environment,
      projectRef,
    );
    if (typeof secondaryUrl === "string" && secondaryUrl.trim() !== "") {
      const secondary = resolveSupabaseEndpointForEnvironment(
        secondaryUrl,
        environment,
        projectRef,
      );
      if (secondary.origin !== endpoint.origin) {
        throw new VisualSignatureLocalEnvironmentError(
          "visual_signature_local_endpoints_origin_mismatch",
        );
      }
    }
  } catch (error) {
    throw mapEndpointError(error);
  }

  let instanceIdentity: string;
  if (environment === "production") {
    if (projectRef === "") {
      throw new VisualSignatureValidationGuardError("visual_signature_production_ref_missing");
    }
    instanceIdentity = projectRef;
  } else {
    const expectedIdentity = (
      process.env.VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE ?? ""
    ).trim();
    try {
      instanceIdentity = resolveCanonicalInstanceIdentity();
    } catch (error) {
      throw new VisualSignatureValidationGuardError(
        "visual_signature_validation_instance_mismatch",
        { cause: error },
      );
    }
    if (expectedIdentity === "" || instanceIdentity !== expectedIdentity) {
      throw new VisualSignatureValidationGuardError(
        "visual_signature_validation_instance_mismatch",
      );
    }
  }

  return Object.freeze({
    ...(environment === "production" ? { environment } : {}),
    instanceIdentity,
    supabaseOrigin: endpoint.origin,
  });
}

/** Autorização administrativa não exige credencial de provider. */
export const assertVisualSignatureAdminEnvironment =
  assertVisualSignatureEnvironmentIdentity;

export function assertVisualSignatureValidationEnvironment(): VisualSignatureValidationEnvironment {
  const identity = assertVisualSignatureEnvironmentIdentity();
  const environment = identity.environment ?? "local_validation";

  let apiKey: string;
  try {
    apiKey = readVisualSignatureApiKey("openai", environment);
  } catch (error) {
    throw new VisualSignatureValidationGuardError(
      "visual_signature_validation_provider_key_missing",
      { cause: error },
    );
  }

  return Object.freeze({ ...identity, apiKey });
}
