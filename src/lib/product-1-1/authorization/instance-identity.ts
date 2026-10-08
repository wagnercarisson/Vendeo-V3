import "server-only";

/**
 * F56.2b1a — Identidade canônica do endpoint (instância Supabase).
 *
 * Fonte ÚNICA, derivada EXCLUSIVAMENTE no servidor, a partir da configuração
 * confiável (`NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL`) — NUNCA do payload do
 * lojista. Usada igualmente pelo runtime (resolução de elegibilidade) e pela
 * API admin (concessão/leitura de autorização).
 *
 * Configuração ausente ou URL inválida FALHA FECHADO (lança), sem identidade
 * padrão. A comparação é EXATA: `localhost` e `127.0.0.1` NÃO são
 * intercambiáveis — ambos os lados usam a mesma configuração server-side.
 *
 * A identidade identifica o ENDPOINT; não substitui o gate de isolamento nem a
 * autorização de estágio.
 */
export function resolveCanonicalInstanceIdentity(): string {
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

  return url.host;
}
