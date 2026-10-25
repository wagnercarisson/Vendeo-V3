import "server-only";

/**
 * Ambiente/identidade administrativa da Assinatura Visual — server-only e
 * fail-closed.
 *
 * A identidade é derivada LOCALMENTE da URL do Supabase
 * (`NEXT_PUBLIC_SUPABASE_URL ?? SUPABASE_URL`) no mesmo formato `url.host`
 * (host + porta). Nenhum módulo de domínio do Produto 1:1 é importado: a
 * duplicação deliberada evita acoplar esta superfície ao Produto 1:1.
 *
 * Classificação:
 * - `local_validation`: hostname loopback (`localhost`, `127.0.0.1`, `::1`).
 *   Homolog local com porta (`127.0.0.1:57781`) também é `local_validation`.
 * - `production`: qualquer outro host (banco remoto).
 *
 * Sem cache e sem novas variáveis de ambiente.
 */

export interface VisualSignatureAdminEnvironment {
  environmentScope: "local_validation" | "production";
  instanceIdentity: string;
}

export const VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_MISSING =
  "visual_signature_environment_config_missing" as const;
export const VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_INVALID =
  "visual_signature_environment_config_invalid" as const;

type VisualSignatureAdminEnvironmentErrorCode =
  | typeof VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_MISSING
  | typeof VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_INVALID;

function environmentError(code: VisualSignatureAdminEnvironmentErrorCode): Error {
  const error = new Error(code);
  (error as Error & { code: VisualSignatureAdminEnvironmentErrorCode }).code = code;
  return error;
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function resolveVisualSignatureAdminEnvironment(): VisualSignatureAdminEnvironment {
  const raw = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  ).trim();

  if (raw === "") {
    throw environmentError(VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_MISSING);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw environmentError(VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_INVALID);
  }

  if (!url.host) {
    throw environmentError(VISUAL_SIGNATURE_ENVIRONMENT_CONFIG_INVALID);
  }

  const hostname = url.hostname.toLowerCase();

  return {
    environmentScope: LOCAL_HOSTNAMES.has(hostname) ? "local_validation" : "production",
    instanceIdentity: url.host,
  };
}
