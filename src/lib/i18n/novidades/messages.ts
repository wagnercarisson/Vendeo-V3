/**
 * Tipos explícitos do namespace de textos da página de novidades.
 *
 * Namespace próprio da rota `/novidades`, fora do catálogo global do shell.
 * Sem index signature e sem `any`: o catálogo `es-419` é verificado contra
 * exatamente a mesma estrutura de `pt-BR`.
 */

export interface NovidadesCardMessages {
  readonly categoryFeature: string;
  readonly categoryImprovement: string;
  readonly categoryFix: string;
  readonly important: string;
}

export interface NovidadesMessages {
  readonly title: string;
  readonly breadcrumbHome: string;
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly listEmpty: string;
  readonly card: NovidadesCardMessages;
}
