/**
 * Fonte única dos destinos de conteúdo do rodapé público.
 *
 * Esta lista é deliberadamente independente de SEO: não é importada por
 * `src/app/sitemap.ts`, pela política de indexação, por metadata ou por robots.
 * Adicionar uma página futura ao rodapé exige alterar somente esta lista.
 */
export const PUBLIC_FOOTER_EXPLORE_LINKS = [
  { href: "/floriculturas", label: "Floriculturas" },
  { href: "/padarias", label: "Padarias" },
  { href: "/campanhas-para-sua-loja", label: "Campanhas sem complicação" },
] as const;

export type PublicFooterPath =
  | "/"
  | (typeof PUBLIC_FOOTER_EXPLORE_LINKS)[number]["href"];
