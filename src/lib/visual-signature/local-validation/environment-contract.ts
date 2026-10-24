/**
 * F47.1 (D5) — Contrato PURO de endpoint local (loopback) do Supabase.
 *
 * Não importa `server-only`, não lê env e não conhece porta de API/DB: pode ser
 * exercitado por scripts de preflight, testes e pelo guard server-only do
 * plano 02 (que o consome).
 *
 * A allowlist de identidade é uma SEGUNDA condição. Ela nunca substitui a
 * prova de que o endpoint é loopback: um processo local apontando para uma URL
 * Supabase de produção deve ser recusado mesmo que a identidade coincida.
 */

/** Hosts loopback aceitos. Comparação exata após normalização de `::1`. */
export const LOCAL_SUPABASE_HOSTS = ["127.0.0.1", "localhost", "::1"] as const;

export type LocalSupabaseHost = (typeof LOCAL_SUPABASE_HOSTS)[number];

export interface LocalSupabaseEndpoint {
  /** Origin normalizado (`scheme://host:port`), pronto para comparação. */
  origin: string;
  host: LocalSupabaseHost;
  port: string;
}

export const VISUAL_SIGNATURE_LOCAL_ERRORS = {
  endpoint_missing: "visual_signature_local_endpoint_missing",
  endpoint_invalid: "visual_signature_local_endpoint_invalid",
  endpoint_not_loopback: "visual_signature_local_endpoint_not_loopback",
  endpoint_credentials_forbidden:
    "visual_signature_local_endpoint_credentials_forbidden",
  endpoints_origin_mismatch: "visual_signature_local_endpoints_origin_mismatch",
  database_endpoint_missing: "visual_signature_local_database_endpoint_missing",
  database_endpoint_invalid: "visual_signature_local_database_endpoint_invalid",
  database_endpoint_not_loopback:
    "visual_signature_local_database_endpoint_not_loopback",
  database_endpoint_port_mismatch:
    "visual_signature_local_database_endpoint_port_mismatch",
} as const;

export type VisualSignatureLocalErrorCode =
  (typeof VISUAL_SIGNATURE_LOCAL_ERRORS)[keyof typeof VISUAL_SIGNATURE_LOCAL_ERRORS];

export class VisualSignatureLocalEnvironmentError extends Error {
  constructor(readonly code: VisualSignatureLocalErrorCode) {
    super(code);
    this.name = "VisualSignatureLocalEnvironmentError";
  }
}

function normalizeHost(hostname: string): string {
  // WHATWG mantém colchetes no hostname IPv6 (`[::1]`).
  return hostname.replace(/^\[(.*)\]$/, "$1");
}

function assertNotRemoteHost(host: string): void {
  const lower = host.toLowerCase();
  if (
    lower === "supabase.co" ||
    lower.endsWith(".supabase.co") ||
    lower === "vercel.app" ||
    lower.endsWith(".vercel.app")
  ) {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_not_loopback,
    );
  }
}

/**
 * Valida uma URL de endpoint Supabase e retorna `{ origin, host, port }`
 * normalizado. Aceita SOMENTE http(s) em host loopback com porta explícita;
 * recusa URL ausente/inválida, credenciais embutidas, `*.supabase.co`,
 * `*.vercel.app` e qualquer host não-loopback.
 */
export function assertLocalSupabaseEndpoint(url: string): LocalSupabaseEndpoint {
  if (typeof url !== "string" || url.trim() === "") {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_missing,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_invalid,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_invalid,
    );
  }

  if (parsed.username !== "" || parsed.password !== "") {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_credentials_forbidden,
    );
  }

  const host = normalizeHost(parsed.hostname);
  assertNotRemoteHost(host);

  if (!(LOCAL_SUPABASE_HOSTS as readonly string[]).includes(host)) {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_not_loopback,
    );
  }

  if (!parsed.port) {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_invalid,
    );
  }

  return {
    origin: parsed.origin,
    host: host as LocalSupabaseHost,
    port: parsed.port,
  };
}

/**
 * Resolve o endpoint primário e, quando a URL secundária existir, exige o
 * MESMO origin local. Retorna apenas o endpoint primário normalizado.
 */
export function resolveLocalSupabaseEndpoints(
  primaryUrl: string,
  secondaryUrl?: string,
): LocalSupabaseEndpoint {
  const primary = assertLocalSupabaseEndpoint(primaryUrl);

  if (secondaryUrl !== undefined && secondaryUrl.trim() !== "") {
    const secondary = assertLocalSupabaseEndpoint(secondaryUrl);
    if (secondary.origin !== primary.origin) {
      throw new VisualSignatureLocalEnvironmentError(
        VISUAL_SIGNATURE_LOCAL_ERRORS.endpoints_origin_mismatch,
      );
    }
  }

  return primary;
}

/**
 * Valida o destino Postgres ANTES de qualquer conexão. Aceita somente
 * `postgres://`/`postgresql://` em host loopback com porta explícita e igual à
 * porta esperada do workdir. Não imprime/retorna a connection string.
 */
export function assertLocalPostgresEndpoint(
  url: string,
  expectedPort: string,
): { host: LocalSupabaseHost; port: string } {
  if (typeof url !== "string" || url.trim() === "") {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.database_endpoint_missing,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.database_endpoint_invalid,
    );
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.database_endpoint_invalid,
    );
  }

  const host = normalizeHost(parsed.hostname);
  // Não reutiliza `assertNotRemoteHost` aqui: o código de erro deve ser o de
  // destino Postgres, não o de endpoint HTTP.
  if (!(LOCAL_SUPABASE_HOSTS as readonly string[]).includes(host)) {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.database_endpoint_not_loopback,
    );
  }
  if (!parsed.port) {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.database_endpoint_invalid,
    );
  }
  if (expectedPort.trim() === "" || parsed.port !== expectedPort.trim()) {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.database_endpoint_port_mismatch,
    );
  }

  return { host: host as LocalSupabaseHost, port: parsed.port };
}

/** Estágio do preflight (pré/pós aplicação da migration local). */
export type LocalValidationStage = "pre-migration" | "post-migration";

export interface LocalValidationCatalogState {
  gpt55Present: boolean;
  lunaPresent: boolean;
  lunaIntegrityOk: boolean;
}

/**
 * Regra PURA de catálogo por estágio:
 * - `pre-migration` ALLOWS `gpt-6-luna` ausente, mas falha se presente e
 *   divergente; exige `gpt-5.5` ativo.
 * - `post-migration` EXIGE `gpt-6-luna` ativo e íntegro.
 */
export function evaluateLocalValidationStage(
  stage: LocalValidationStage,
  catalog: LocalValidationCatalogState,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  if (!catalog.gpt55Present) failures.push("gpt_5_5_catalog_missing");
  if (catalog.lunaPresent && !catalog.lunaIntegrityOk) {
    failures.push("luna_catalog_divergent");
  }
  if (stage === "post-migration" && !catalog.lunaIntegrityOk) {
    failures.push("luna_catalog_missing_after_migration");
  }

  return { ok: failures.length === 0, failures };
}
