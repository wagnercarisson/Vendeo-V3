/**
 * Barrel local do namespace da página de novidades.
 *
 * Deliberadamente não é reexportado por `src/lib/i18n/index.ts`: o catálogo de
 * novidades nunca deve entrar no payload global do shell/admin.
 */

export type {
  NovidadesCardMessages,
  NovidadesMessages,
} from "./messages";

export { ptBRNovidadesMessages } from "./catalogs/pt-BR";
export { es419NovidadesMessages } from "./catalogs/es-419";
export { getNovidadesMessages } from "./get-messages";
