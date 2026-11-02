/**
 * Barrel local do namespace dashboard (F58).
 *
 * Deliberadamente não é reexportado por `src/lib/i18n/index.ts`: o catálogo do
 * dashboard nunca deve entrar no payload global do shell/admin.
 */

export type {
  DashboardBannersMessages,
  DashboardCampaignsMessages,
  DashboardCreditsMessages,
  DashboardGreetingMessages,
  DashboardHeaderMessages,
  DashboardLoadingMessages,
  DashboardMessages,
  DashboardNewsMessages,
  DashboardNoStoreMessages,
  DashboardShortcutMessages,
} from "./messages";

export { ptBRDashboardMessages } from "./catalogs/pt-BR";
export { es419DashboardMessages } from "./catalogs/es-419";
export { getDashboardMessages } from "./get-messages";
