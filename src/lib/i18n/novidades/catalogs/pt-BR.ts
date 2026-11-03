/**
 * Catálogo pt-BR do namespace da página de novidades — fonte de verdade.
 *
 * Congelado em todos os níveis. Apenas textos fixos de interface; título,
 * corpo, milestone e data das entradas editoriais nunca entram aqui.
 */

import type { NovidadesMessages } from "../messages";

export const ptBRNovidadesMessages: NovidadesMessages = Object.freeze({
  title: "Novidades",
  breadcrumbHome: "Dashboard",
  emptyTitle: "Nenhuma novidade por enquanto",
  emptyBody: "Quando o Vendeo lançar algo novo, você verá aqui.",
  listEmpty: "Nenhuma novidade por enquanto.",
  card: Object.freeze({
    categoryFeature: "Nova funcionalidade",
    categoryImprovement: "Melhoria",
    categoryFix: "Correção",
    important: "Importante",
  }),
});
