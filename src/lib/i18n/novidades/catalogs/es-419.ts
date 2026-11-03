/**
 * Catálogo es-419 do namespace da página de novidades — espanhol neutro LATAM.
 *
 * `satisfies NovidadesMessages` garante paridade estrutural no typecheck.
 * Apenas textos fixos de interface; conteúdo editorial permanece em pt-BR.
 */

import type { NovidadesMessages } from "../messages";

export const es419NovidadesMessages = Object.freeze({
  title: "Novedades",
  breadcrumbHome: "Panel",
  emptyTitle: "Aún no hay novedades",
  emptyBody: "Cuando Vendeo lance algo nuevo, lo verás aquí.",
  listEmpty: "Aún no hay novedades.",
  card: Object.freeze({
    categoryFeature: "Nueva funcionalidad",
    categoryImprovement: "Mejora",
    categoryFix: "Corrección",
    important: "Importante",
  }),
}) satisfies NovidadesMessages;
