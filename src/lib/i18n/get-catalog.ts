/**
 * Único módulo que importa os catálogos completos (F57.4).
 */

import { es419Messages } from "./catalogs/es-419";
import { ptBRMessages } from "./catalogs/pt-BR";
import type { SupportedUiLocale } from "./locales";
import type { Messages } from "./messages";

export function getCatalog(locale: SupportedUiLocale): Messages {
  return locale === "es-419" ? es419Messages : ptBRMessages;
}
