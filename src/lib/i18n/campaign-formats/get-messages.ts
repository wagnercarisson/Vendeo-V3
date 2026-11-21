/**
 * Resolvedor do catálogo compartilhado de apresentação dos formatos.
 *
 * Reutiliza o `SupportedUiLocale` da fundação F57.4; não lê preferência nem
 * cria resolvedor concorrente.
 */

import type { SupportedUiLocale } from "@/lib/i18n/locales";

import { es419CampaignFormatMessages } from "./catalogs/es-419";
import { ptBRCampaignFormatMessages } from "./catalogs/pt-BR";
import type { CampaignFormatPresentationMessages } from "./messages";

export function getCampaignFormatMessages(
  locale: SupportedUiLocale,
): CampaignFormatPresentationMessages {
  return locale === "es-419"
    ? es419CampaignFormatMessages
    : ptBRCampaignFormatMessages;
}
