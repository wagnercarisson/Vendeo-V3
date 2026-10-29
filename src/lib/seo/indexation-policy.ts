/**
 * Política de indexação por superfície (F51.2 / D-05 / D-06 / D-09).
 *
 * Módulo puro com exports nomeados: constantes `Metadata["robots"]` (objeto,
 * nunca string), superfícies privadas/legais/transitórias, o caminho canônico da
 * home e as **únicas** fontes dos valores literais de `X-Robots-Tag`
 * (`NOINDEX_TAG`, `NOINDEX_TAG_GLOBAL`), consumidas por `robots-headers.ts`.
 *
 * `getSurfacePolicy(pathname)` retorna o contrato único `{ robots, inSitemap }`,
 * com o default fail-closed `noindex, nofollow` + fora do sitemap para qualquer
 * pathname não reconhecido. A home é a única exceção (aplicável somente sob a
 * condição combinada de produção confirmada e origem validada — decisão do
 * consumidor via `isIndexableEnvironment()`).
 */

import type { Metadata } from "next";

/** `robots` indexável (objeto — nunca a string `"index, follow"`). */
export const INDEX_ROBOTS = { index: true, follow: true } as const satisfies Metadata["robots"];

/** `robots` não indexável (objeto — nunca a string `"noindex, nofollow"`). */
export const NOINDEX_ROBOTS = { index: false, follow: false } as const satisfies Metadata["robots"];

/** Caminho canônico da home (única superfície candidata ao índice). */
export const HOME_CANONICAL_PATH = "/";

/** Valor de `X-Robots-Tag` para superfícies transitórias/privadas. */
export const NOINDEX_TAG = "noindex";

/** Valor de `X-Robots-Tag` da regra global fora de produção confirmada. */
export const NOINDEX_TAG_GLOBAL = "noindex, nofollow";

/** Contrato único da política de uma superfície. */
export interface SurfacePolicy {
  robots: typeof INDEX_ROBOTS | typeof NOINDEX_ROBOTS;
  inSitemap: boolean;
}

const PRIVATE_AUTH_PATHS = [
  "/login",
  "/signup",
  "/check-email",
  "/forgot-password",
  "/update-password",
] as const;

const PRIVATE_APP_PREFIXES = [
  "/dashboard",
  "/loja",
  "/campanhas",
  "/conta",
  "/configuracoes",
  "/novidades",
  "/legal/reaccept",
  "/cadastro",
  "/admin",
] as const;

const LEGAL_PATHS = ["/termos", "/privacidade", "/uso-aceitavel"] as const;

const TRANSIENT_PREFIXES = ["/auth", "/api", "/docs"] as const;

const INDEX_POLICY: SurfacePolicy = { robots: INDEX_ROBOTS, inSitemap: true };
const NOINDEX_POLICY: SurfacePolicy = { robots: NOINDEX_ROBOTS, inSitemap: false };

function normalizePathname(pathname: string): string {
  let path = pathname.split("?")[0].split("#")[0];
  if (path.length > 1 && path.endsWith("/")) {
    path = path.replace(/\/+$/, "");
  }
  if (path === "") {
    path = "/";
  }
  return path;
}

function includesPath(path: string, paths: readonly string[]): boolean {
  return paths.includes(path);
}

function matchesPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Resolve a política de indexação de uma superfície. A superfície é o **path**
 * (query string e fragmento são removidos; barra final normalizada exceto na
 * raiz). Qualquer pathname desconhecido cai no default fail-closed.
 */
export function getSurfacePolicy(pathname: string): SurfacePolicy {
  const path = normalizePathname(pathname);

  if (path === HOME_CANONICAL_PATH) {
    return INDEX_POLICY;
  }

  if (includesPath(path, PRIVATE_AUTH_PATHS)) return NOINDEX_POLICY;
  if (includesPath(path, LEGAL_PATHS)) return NOINDEX_POLICY;
  if (matchesPrefix(path, TRANSIENT_PREFIXES)) return NOINDEX_POLICY;
  if (matchesPrefix(path, PRIVATE_APP_PREFIXES)) return NOINDEX_POLICY;

  return NOINDEX_POLICY;
}
