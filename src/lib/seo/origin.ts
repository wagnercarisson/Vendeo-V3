/**
 * Resolução da origem canônica por ambiente (F51.2 / D-02).
 *
 * Fonte única de origem para `metadataBase`, canonical, OG/Twitter, `robots.ts`
 * e `sitemap.ts`. Pura (apenas lê `process.env`), sem efeitos colaterais, sem
 * registro de log e **nunca lança** em nenhuma entrada de ambiente.
 *
 * Invariantes (obrigatórios):
 * - `resolveCanonicalOrigin()` nunca lança em nenhuma entrada de ambiente.
 * - `result.origin` é sempre `null` ou uma URL absoluta sintaticamente válida,
 *   de modo que `new URL(result.origin ?? FALLBACK_ORIGIN)` é seguro no consumidor.
 * - `origin === CANONICAL_ORIGIN` **somente** sob produção confirmada
 *   (`VERCEL_ENV === "production"`) com `NEXT_PUBLIC_SITE_URL` exatamente
 *   canônica; em preview/local `origin` nunca é `CANONICAL_ORIGIN` nem um host da
 *   família `vendeo.tech`/`www.vendeo.tech` (fallback seguro).
 * - `indexable` é `true` somente no caso canônico de produção válida.
 * - O `diagnostic` não ecoa o valor bruto de `NEXT_PUBLIC_SITE_URL`/`VERCEL_URL`
 *   (apenas nomes de variáveis e o status), evitando exposição de configuração.
 * - O helper não registra log: o `diagnostic` é **retornado**; quem o torna
 *   observável é o consumidor (`src/app/layout.tsx`, plano 03).
 *
 * Não importar o helper compartilhado de autenticação (ele lança se a env faltar).
 */

export type CanonicalOriginStatus = "valid" | "missing" | "invalid" | "non_canonical";

export interface CanonicalOriginResult {
  origin: string | null;
  status: CanonicalOriginStatus;
  indexable: boolean;
  diagnostic?: string;
}

/** Origem canônica de produção (sem `www`). */
export const CANONICAL_ORIGIN = "https://vendeo.tech";

/** Fallback seguro fora de produção (apenas para montar URLs absolutas). */
export const FALLBACK_ORIGIN = "http://localhost:3000";

const NON_PRODUCTION_DIAGNOSTIC =
  "[seo/origin] ambiente não confirmado como produção (VERCEL_ENV ausente ou diferente de production); origem usada apenas para URLs absolutas";

/**
 * Resolve a origem canônica conforme o ambiente, sem lançar e sem emitir URL
 * divergente. Veja os invariantes no topo do módulo.
 */
export function resolveCanonicalOrigin(): CanonicalOriginResult {
  const productionConfirmed = process.env.VERCEL_ENV === "production";

  if (productionConfirmed) {
    const raw = process.env.NEXT_PUBLIC_SITE_URL;

    if (raw === undefined || raw === "") {
      return {
        origin: null,
        status: "missing",
        indexable: false,
        diagnostic: "[seo/origin] NEXT_PUBLIC_SITE_URL ausente em produção (fail-closed)",
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return {
        origin: null,
        status: "invalid",
        indexable: false,
        diagnostic:
          "[seo/origin] NEXT_PUBLIC_SITE_URL inválida em produção (não é URL absoluta; fail-closed)",
      };
    }

    // (a) host divergente do canônico (www, alias, outro domínio).
    if (parsed.hostname !== "vendeo.tech") {
      return {
        origin: null,
        status: "non_canonical",
        indexable: false,
        diagnostic:
          "[seo/origin] NEXT_PUBLIC_SITE_URL não canônica em produção (host divergente da origem canônica; fail-closed)",
      };
    }

    // (b) protocolo/caminho/query/fragmento proibidos.
    if (
      parsed.protocol !== "https:" ||
      parsed.pathname !== "/" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      return {
        origin: null,
        status: "invalid",
        indexable: false,
        diagnostic:
          "[seo/origin] NEXT_PUBLIC_SITE_URL inválida em produção (exige https sem caminho/query/fragmento; fail-closed)",
      };
    }

    // (c) forma não canônica (ex.: barra final) — só a string exata é aceita.
    if (raw !== CANONICAL_ORIGIN) {
      return {
        origin: null,
        status: "non_canonical",
        indexable: false,
        diagnostic:
          "[seo/origin] NEXT_PUBLIC_SITE_URL não canônica em produção (não corresponde à forma canônica exata; fail-closed)",
      };
    }

    // (d) válida.
    return {
      origin: CANONICAL_ORIGIN,
      status: "valid",
      indexable: true,
    };
  }

  // Não produção (preview/local — nunca indexável). Derivar uma origem
  // sintaticamente válida por parsing inequívoco, nunca por heurística.
  const raw = process.env.VERCEL_URL;

  if (raw === undefined || raw.trim() === "") {
    return {
      origin: FALLBACK_ORIGIN,
      status: "valid",
      indexable: false,
      diagnostic:
        "[seo/origin] VERCEL_URL ausente fora de produção; usando FALLBACK_ORIGIN para URLs absolutas",
    };
  }

  const malformed =
    raw.includes("://") ||
    raw.includes("@") ||
    raw.includes("/") ||
    raw.includes("?") ||
    raw.includes("#") ||
    /\s/.test(raw) ||
    !/^[A-Za-z0-9.-]+$/.test(raw);

  if (malformed) {
    return {
      origin: FALLBACK_ORIGIN,
      status: "valid",
      indexable: false,
      diagnostic:
        "[seo/origin] VERCEL_URL inválida fora de produção; usando FALLBACK_ORIGIN para URLs absolutas",
    };
  }

  try {
    const candidate = new URL(`https://${raw}`);
    if (!candidate.hostname || candidate.host !== raw) {
      return {
        origin: FALLBACK_ORIGIN,
        status: "valid",
        indexable: false,
        diagnostic:
          "[seo/origin] VERCEL_URL inválida fora de produção; usando FALLBACK_ORIGIN para URLs absolutas",
      };
    }

    // Anti-vazamento da origem canônica em preview: nunca emitir a família de
    // produção fora de produção confirmada.
    if (candidate.hostname === "vendeo.tech" || candidate.hostname === "www.vendeo.tech") {
      return {
        origin: FALLBACK_ORIGIN,
        status: "valid",
        indexable: false,
        diagnostic:
          "[seo/origin] VERCEL_URL aponta para a família da origem de produção fora de produção; usando FALLBACK_ORIGIN (fail-closed)",
      };
    }

    return {
      origin: `https://${candidate.host}`,
      status: "valid",
      indexable: false,
      diagnostic: NON_PRODUCTION_DIAGNOSTIC,
    };
  } catch {
    return {
      origin: FALLBACK_ORIGIN,
      status: "valid",
      indexable: false,
      diagnostic:
        "[seo/origin] VERCEL_URL inválida fora de produção; usando FALLBACK_ORIGIN para URLs absolutas",
    };
  }
}
