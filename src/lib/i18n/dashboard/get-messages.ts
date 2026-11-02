/**
 * Resolvedor do namespace de textos do dashboard (F58).
 *
 * Reutiliza o `SupportedUiLocale` da fundação F57.4; não lê preferência nem
 * cria resolvedor concorrente.
 */

import { es419DashboardMessages } from "./catalogs/es-419";
import { ptBRDashboardMessages } from "./catalogs/pt-BR";
import type { DashboardMessages } from "./messages";
import type { SupportedUiLocale } from "@/lib/i18n/locales";

export function getDashboardMessages(locale: SupportedUiLocale): DashboardMessages {
  return locale === "es-419" ? es419DashboardMessages : ptBRDashboardMessages;
}
