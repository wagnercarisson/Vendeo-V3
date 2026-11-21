/**
 * Barrel local do catálogo COMPARTILHADO de apresentação dos formatos.
 *
 * Deliberadamente não é reexportado por `src/lib/i18n/index.ts`: o catálogo do
 * shell/admin nunca deve carregar os textos de formato. Os namespaces de rota
 * (`campaign-list`, `dashboard`, `campaign-detail`) importam este módulo
 * diretamente e expõem a MESMA referência por locale.
 */

export type {
  CampaignFormatExplanationMessages,
  CampaignFormatLabelMessages,
  CampaignFormatNameMessages,
  CampaignFormatPresentationMessages,
} from "./messages";

export { ptBRCampaignFormatMessages } from "./catalogs/pt-BR";
export { es419CampaignFormatMessages } from "./catalogs/es-419";
export { getCampaignFormatMessages } from "./get-messages";
