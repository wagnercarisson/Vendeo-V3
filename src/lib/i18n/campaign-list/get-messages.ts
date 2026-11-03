/**
 * Resolvedor do namespace de textos da listagem de campanhas.
 *
 * Reutiliza o `SupportedUiLocale` da fundação F57.4; não lê preferência nem
 * cria resolvedor concorrente.
 */

import type { SupportedUiLocale } from "@/lib/i18n/locales";

import { es419CampaignListMessages } from "./catalogs/es-419";
import { ptBRCampaignListMessages } from "./catalogs/pt-BR";
import type { CampaignListMessages } from "./messages";

export function getCampaignListMessages(
  locale: SupportedUiLocale,
): CampaignListMessages {
  return locale === "es-419"
    ? es419CampaignListMessages
    : ptBRCampaignListMessages;
}
