import type { MetadataRoute } from "next";
import { resolveCanonicalOrigin } from "@/lib/seo/origin";
import { isIndexableEnvironment } from "@/lib/seo/environment";
import { HOME_CANONICAL_PATH } from "@/lib/seo/indexation-policy";

/**
 * `sitemap.xml` (F51.2 / D-08).
 *
 * Somente a home, e somente sob produção confirmada + origem canônica validada.
 * Nesta fatia nada mais é indexável: `/api/**`, `/auth/**`, `(app)/**`,
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

  return [{ url: `${origin}${HOME_CANONICAL_PATH}` }];
}
