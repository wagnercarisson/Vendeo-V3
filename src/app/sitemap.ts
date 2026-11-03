import type { MetadataRoute } from "next";
import { resolveCanonicalOrigin } from "@/lib/seo/origin";
import { isIndexableEnvironment } from "@/lib/seo/environment";
import {
  FLORICULTURAS_CANONICAL_PATH,
  HOME_CANONICAL_PATH,
} from "@/lib/seo/indexation-policy";

/**
 * `sitemap.xml` (F51.2 / D-08).
 *
 * As superfícies indexáveis aprovadas — a home e a página demonstrativa
 * `/floriculturas` — e somente sob produção confirmada + origem canônica
 * validada. Nada mais é indexável: `/api/**`, `/auth/**`, `(app)/**`,
 * `/admin/**`, documentos legais, versões Markdown e URLs com parâmetros ficam
 * de fora (D-08). Fora da condição combinada retorna lista vazia.
 *
 * Sem `lastModified`/`changeFrequency` inventados (evita conteúdo fabricado; a
 * simplicidade é intencional).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const { origin } = resolveCanonicalOrigin();

  if (!isIndexableEnvironment() || origin === null) {
    return [];
  }

  return [
    { url: `${origin}${HOME_CANONICAL_PATH}` },
    { url: `${origin}${FLORICULTURAS_CANONICAL_PATH}` },
  ];
}
