/**
 * Barrel local do namespace da campanha pronta.
 *
 * Deliberadamente não é reexportado por `src/lib/i18n/index.ts`: o catálogo da
 * rota nunca deve entrar no payload global do shell/admin.
 */

export type {
  CampaignDetailCopyMessages,
  CampaignDetailMessages,
} from "./messages";

export { ptBRCampaignDetailMessages } from "./catalogs/pt-BR";
export { es419CampaignDetailMessages } from "./catalogs/es-419";
export { getCampaignDetailMessages } from "./get-messages";
