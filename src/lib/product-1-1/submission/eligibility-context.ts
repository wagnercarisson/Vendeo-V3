import type {
  ProductFlowEnvironment,
  ProductFlowScope,
} from "@/lib/product-1-1/authorization/types";

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
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";

  if (rawUrl.trim() === "") {
    throw new Error("product_flow_instance_config_missing");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("product_flow_instance_config_invalid");
  }

  if (!url.host) {
    throw new Error("product_flow_instance_config_invalid");
  }

  return Object.freeze({
    requestedScope: store.is_test_store === true ? "test_stores" : "all_stores",
    expectedInstanceIdentity: url.host,
    expectedEnvironment: LOOPBACK_HOSTNAMES.has(url.hostname)
      ? "isolated"
      : "operational",
  });
}
