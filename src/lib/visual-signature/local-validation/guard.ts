import "server-only";

import { readValidationApiKey } from "@/lib/ai/api-keys";
import { resolveCanonicalInstanceIdentity } from "@/lib/product-1-1/authorization/instance-identity";
import {
  VisualSignatureLocalEnvironmentError,
  resolveLocalSupabaseEndpoints,
} from "./environment-contract";

/**
 * F47.1 (D5/D6) — Guard server-only do ambiente local aprovado.
 *
 * A configuração experimental da Assinatura Visual só pode ser consumida quando
 * TODAS as condições forem verdadeiras:
 *
 * 1. opt-in explícito (`VENDEO_VS_VALIDATION_ENABLED === "1"`);
 * 2. não-produção e não-Vercel;
 * 3. endpoint Supabase (banco/Storage) em host loopback com porta explícita,
 *    validado por `assertLocalSupabaseEndpoint` do plano 01;
 * 4. identidade canônica (`resolveCanonicalInstanceIdentity()`) exatamente igual
 *    a `VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE` (API host:port);
 * 5. credencial dedicada de provider presente (`VENDEO_VS_VALIDATION_OPENAI_API_KEY`).
 *
 * A allowlist de identidade é uma SEGUNDA condição — nunca substitui a prova de
 * loopback. Nenhuma chave é logada, persistida ou devolvida em metadata; o
 * objeto retornado carrega a chave apenas em memória para o adapter.
 */

export type VisualSignatureValidationGuardErrorCode =
  | "visual_signature_validation_disabled"
  | "visual_signature_validation_not_local"
  | "visual_signature_validation_endpoint_not_loopback"
  | "visual_signature_validation_instance_mismatch"
  | "visual_signature_validation_provider_key_missing";

export class VisualSignatureValidationGuardError extends Error {
  readonly code: VisualSignatureValidationGuardErrorCode;

  constructor(code: VisualSignatureValidationGuardErrorCode, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "VisualSignatureValidationGuardError";
    this.code = code;
  }
}

export interface VisualSignatureValidationEnvironment {
  readonly instanceIdentity: string;
  readonly supabaseOrigin: string;
  readonly apiKey: string;
}

/** Opt-in explícito; qualquer outro valor (ausente/inclusively "true") é off. */
export function isVisualSignatureValidationOptedIn(): boolean {
  return process.env.VENDEO_VS_VALIDATION_ENABLED === "1";
}

/**
 * Valida o ambiente local fail-closed, na ordem documentada. Retorna um objeto
 * CONGELADO com identidade/origin e a credencial dedicada (apenas em memória).
 */
export function assertVisualSignatureValidationEnvironment(): VisualSignatureValidationEnvironment {
  if (!isVisualSignatureValidationOptedIn()) {
    throw new VisualSignatureValidationGuardError("visual_signature_validation_disabled");
  }

  if (process.env.NODE_ENV === "production") {
    throw new VisualSignatureValidationGuardError("visual_signature_validation_not_local");
  }

  if (typeof process.env.VERCEL === "string" && process.env.VERCEL !== "") {
    throw new VisualSignatureValidationGuardError("visual_signature_validation_not_local");
  }

  const primaryUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secondaryUrl = process.env.SUPABASE_URL;

  let endpoint: { origin: string };
  try {
    endpoint = resolveLocalSupabaseEndpoints(
      typeof primaryUrl === "string" ? primaryUrl : "",
      typeof secondaryUrl === "string" ? secondaryUrl : undefined,
    );
  } catch (error) {
    // Qualquer falha de endpoint (ausente/inválido/credenciais/remoto/origin
    // divergente) vira erro tipado de loopback — nunca aceita silenciosamente.
    throw new VisualSignatureValidationGuardError(
      "visual_signature_validation_endpoint_not_loopback",
      { cause: error instanceof VisualSignatureLocalEnvironmentError ? error.code : error },
    );
  }

  const expectedIdentity = (process.env.VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE ?? "").trim();
  let actualIdentity: string;
  try {
    actualIdentity = resolveCanonicalInstanceIdentity();
  } catch (error) {
    throw new VisualSignatureValidationGuardError(
      "visual_signature_validation_instance_mismatch",
      { cause: error },
    );
  }

  if (expectedIdentity === "" || actualIdentity !== expectedIdentity) {
    throw new VisualSignatureValidationGuardError(
      "visual_signature_validation_instance_mismatch",
    );
  }

  let apiKey: string;
  try {
    apiKey = readValidationApiKey("openai");
  } catch (error) {
    throw new VisualSignatureValidationGuardError(
      "visual_signature_validation_provider_key_missing",
      { cause: error },
    );
  }

  return Object.freeze({
    instanceIdentity: actualIdentity,
    supabaseOrigin: endpoint.origin,
    apiKey,
  });
}
