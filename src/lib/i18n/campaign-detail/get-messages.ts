/**
 * Resolvedor do namespace de textos da campanha pronta.
 *
 * Reutiliza o `SupportedUiLocale` da fundação F57.4; não lê preferência nem
 * cria resolvedor concorrente.
 */

import type { SupportedUiLocale } from "@/lib/i18n/locales";

import { es419CampaignDetailMessages } from "./catalogs/es-419";
import { ptBRCampaignDetailMessages } from "./catalogs/pt-BR";
import type { CampaignDetailMessages } from "./messages";

export function getCampaignDetailMessages(
  locale: SupportedUiLocale,
): CampaignDetailMessages {
  return locale === "es-419"
    ? es419CampaignDetailMessages
    : ptBRCampaignDetailMessages;
}
