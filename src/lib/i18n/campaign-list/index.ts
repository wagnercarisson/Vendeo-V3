/**
 * Barrel local do namespace da listagem de campanhas.
 *
 * Deliberadamente não é reexportado por `src/lib/i18n/index.ts`: o catálogo da
 * listagem nunca deve entrar no payload global do shell/admin.
 */

export type {
  CampaignListActionMessages,
  CampaignListEmptyMessages,
  CampaignListFilterMessages,
  CampaignListMessages,
  CampaignListNoStoreMessages,
  CampaignListPaginationMessages,
  CampaignListSearchMessages,
  CampaignListStatusMessages,
} from "./messages";

export { ptBRCampaignListMessages } from "./catalogs/pt-BR";
export { es419CampaignListMessages } from "./catalogs/es-419";
export { getCampaignListMessages } from "./get-messages";
export { formatCampaignListDate } from "./format-date";
