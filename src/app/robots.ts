import type { MetadataRoute } from "next";
import { resolveCanonicalOrigin } from "@/lib/seo/origin";
import { isIndexableEnvironment } from "@/lib/seo/environment";

/**
 * `robots.txt` (F51.2 / D-03 / D-07).
 *
 * Sob produção confirmada + origem canônica validada (`isIndexableEnvironment()`),
 * a home é a única superfície indexável: o `robots.txt` permite crawling
 * (`allow: "/"`) e referencia o sitemap absoluto `${origin}/sitemap.xml`, além
 * do `host` canônico.
 *
 * Fora da condição combinada, o `robots.txt` permanece **permissivo** para que o
 * robô consiga ler o `X-Robots-Tag: noindex`/metadata `noindex`; `Disallow`
 * impediria a leitura e contrariaria D-06/D-07. Também não referencia um sitemap
 * divergente.
 *
 * O ambiente é lido dentro da função (nunca no escopo do módulo) para permitir
 * stubbing nos testes.
 */
export default function robots(): MetadataRoute.Robots {
  const { origin } = resolveCanonicalOrigin();

  if (isIndexableEnvironment() && origin !== null) {
    return {
      rules: [{ userAgent: "*", allow: "/" }],
      sitemap: `${origin}/sitemap.xml`,
      host: origin,
    };
  }

  // Fora da condição combinada: permissivo, sem `Disallow` e sem `sitemap`.
  return {
    rules: [{ userAgent: "*", allow: "/" }],
  };
}
