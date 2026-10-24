/**
 * F47.2 — resolve o endpoint Supabase conforme o ambiente declarado.
 * Em produção exige HTTPS no host canônico `${projectRef}.supabase.co`.
 * Em local mantém a prova de loopback da F47.1.
 */
export function resolveSupabaseEndpointForEnvironment(
  url: string,
  environment: VisualSignatureEnvironment,
  expectedProjectRef?: string,
): LocalSupabaseEndpoint {
  if (environment === "local_validation") {
    return assertLocalSupabaseEndpoint(url);
  }

  if (typeof url !== "string" || url.trim() === "") {
    throw new VisualSignatureLocalEnvironmentError(
      VISUAL_SIGNATURE_LOCAL_ERRORS.endpoint_missing,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new VisualSignatureEnvironmentError(
      VISUAL_SIGNATURE_ENVIRONMENT_ERRORS.production_endpoint_invalid,
    );
  }
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "") {
    throw new VisualSignatureEnvironmentError(
      VISUAL_SIGNATURE_ENVIRONMENT_ERRORS.production_endpoint_invalid,
    );
  }
  const ref = (expectedProjectRef ?? "").trim();
  if (ref === "") {
    throw new VisualSignatureEnvironmentError(
      VISUAL_SIGNATURE_ENVIRONMENT_ERRORS.production_ref_missing,
    );
  }
  if (parsed.hostname !== `${ref}.supabase.co`) {
    throw new VisualSignatureEnvironmentError(
      VISUAL_SIGNATURE_ENVIRONMENT_ERRORS.production_ref_mismatch,
    );
  }
  return Object.freeze({
    origin: parsed.origin,
    host: parsed.hostname as LocalSupabaseHost,
    port: parsed.port,
  });
}

/** Hosts loopback aceitos. Comparação exata após normalização de `::1`. */
export const LOCAL_SUPABASE_HOSTS = ["127.0.0.1", "localhost", "::1"] as const;

export type LocalSupabaseHost = (typeof LOCAL_SUPABASE_HOSTS)[number];

/** F47.2 — ambientes operacionais fechados. `preview` não é um valor válido. */
export const VISUAL_SIGNATURE_ENVIRONMENTS = ["local_validation", "production"] as const;

export type VisualSignatureEnvironment = (typeof VISUAL_SIGNATURE_ENVIRONMENTS)[number];

export const VISUAL_SIGNATURE_ENVIRONMENT_ERRORS = {
  environment_missing: "visual_signature_environment_missing",
  environment_invalid: "visual_signature_environment_invalid",
  preview_forbidden: "visual_signature_preview_forbidden",
  production_ref_missing: "visual_signature_production_ref_missing",
  production_ref_mismatch: "visual_signature_production_ref_mismatch",
  production_endpoint_invalid: "visual_signature_production_endpoint_invalid",
} as const;

export type VisualSignatureEnvironmentErrorCode =
  (typeof VISUAL_SIGNATURE_ENVIRONMENT_ERRORS)[keyof typeof VISUAL_SIGNATURE_ENVIRONMENT_ERRORS];

export class VisualSignatureEnvironmentError extends Error {
  constructor(readonly code: VisualSignatureEnvironmentErrorCode) {
    super(code);
    this.name = "VisualSignatureEnvironmentError";
  }
}

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
