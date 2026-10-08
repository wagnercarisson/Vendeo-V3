import type {
  ProductFlowEnvironment,
  ProductFlowScope,
} from "@/lib/product-1-1/authorization/types";
import { resolveCanonicalInstanceIdentity } from "@/lib/product-1-1/authorization/instance-identity";

/**
 * F56.2b1a — Contexto de elegibilidade derivado SOMENTE de fontes server-side.
 *
 * - `requestedScope`: dos dados confiáveis da loja (`stores.is_test_store`).
 * - `expectedInstanceIdentity` / `expectedEnvironment`: da configuração
 *   server-side (`NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL`) — NUNCA do payload.
 *
 * Ausência/ invalidez de configuração lança erro; o chamador deve falhar fechado.
 */
export interface ProductFlowEligibilityContext {
  readonly requestedScope: ProductFlowScope;
  readonly expectedInstanceIdentity: string;
  readonly expectedEnvironment: ProductFlowEnvironment;
}

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "0.0.0.0"]);

export function resolveEligibilityContext(store: {
  readonly is_test_store: boolean;
}): ProductFlowEligibilityContext {
  // Identidade canônica compartilhada (server-only, fail-closed, mesma fonte do admin).
  const expectedInstanceIdentity = resolveCanonicalInstanceIdentity();

  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const hostname = new URL(rawUrl).hostname;

  return Object.freeze({
    requestedScope: store.is_test_store === true ? "test_stores" : "all_stores",
    expectedInstanceIdentity,
    expectedEnvironment: LOOPBACK_HOSTNAMES.has(hostname)
      ? "isolated"
      : "operational",
  });
}
