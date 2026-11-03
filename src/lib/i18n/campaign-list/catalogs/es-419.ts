/**
 * Catálogo es-419 do namespace da listagem de campanhas — espanhol neutro
 * LATAM.
 *
 * `satisfies CampaignListMessages` garante paridade estrutural no typecheck.
 * Chaves e placeholders são idênticos ao pt-BR; as strings abaixo são a
 * proposta aprovada no plano (Lista/Listas, No completada).
 */

import type { CampaignListMessages } from "../messages";

export const es419CampaignListMessages = Object.freeze({
  title: "Campañas",
  search: Object.freeze({
    placeholder: "Buscar campañas...",
    ariaLabel: "Buscar campañas",
  }),
  filters: Object.freeze({
    periodLabel: "Período",
    sortLabel: "Ordenar por",
    statusAll: "Todas",
    statusReady: "Listas",
    statusError: "Error",
    periodAll: "Todas",
    period7d: "7 días",
    period30d: "30 días",
    period90d: "90 días",
    periodYear: "Este año",
    sortNewest: "Más recientes",
    sortOldest: "Más antiguas",
    sortNameAsc: "Nombre A-Z",
    sortNameDesc: "Nombre Z-A",
  }),
  status: Object.freeze({
    ready: "Lista",
    incomplete: "No completada",
    error: "Error",
  }),
  actions: Object.freeze({
    open: "Abrir",
    download: "Descargar",
  }),
  empty: Object.freeze({
    noCampaignsTitle: "Aún no hay campañas",
    noCampaignsBody:
      "Crea tu primera campaña y empieza a promocionar tus productos.",
    noCampaignsCta: "Crear campaña",
    searchTitle: "No se encontraron campañas",
    searchBody: "Intenta ajustar la búsqueda o limpiar los filtros.",
  }),
  noStore: Object.freeze({
    title: "Configura tu tienda",
    body: "Tus campañas aparecerán aquí después de configurar tu tienda.",
    cta: "Configurar tienda",
  }),
  pagination: Object.freeze({
    previous: "<< Anterior",
    next: "Siguiente >>",
  }),
}) satisfies CampaignListMessages;
