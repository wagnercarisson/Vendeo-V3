/**
 * Resolvedor do namespace de textos da página de novidades.
 *
 * Reutiliza o `SupportedUiLocale` da fundação F57.4; não lê preferência nem
 * cria resolvedor concorrente.
 */

import type { SupportedUiLocale } from "@/lib/i18n/locales";

import { es419NovidadesMessages } from "./catalogs/es-419";
import { ptBRNovidadesMessages } from "./catalogs/pt-BR";
import type { NovidadesMessages } from "./messages";

export function getNovidadesMessages(
  locale: SupportedUiLocale,
): NovidadesMessages {
  return locale === "es-419"
    ? es419NovidadesMessages
    : ptBRNovidadesMessages;
}
