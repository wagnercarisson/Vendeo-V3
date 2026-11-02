/**
 * Catálogo es-419 do namespace dashboard — espanhol neutro LATAM (F58).
 *
 * `satisfies DashboardMessages` garante paridade estrutural no typecheck.
 * A copy es-419 é uma proposta pendente de revisão humana (RESEARCH A1);
 * placeholders e chaves são idênticos ao pt-BR.
 */

import type { DashboardMessages } from "../messages";

export const es419DashboardMessages = Object.freeze({
  greeting: Object.freeze({
    morning: "Buenos días",
    afternoon: "Buenas tardes",
    evening: "Buenas noches",
    neutral: "Hola",
    welcome: "Bienvenido a Vendeo",
    nameSeparator: ", ",
  }),
  header: Object.freeze({
    subtitleDesktop:
      "Tus campañas e información esencial en un solo lugar.",
    subtitleMobile: "Tus campañas en un solo lugar.",
  }),
  credits: Object.freeze({
    sectionLabel: "Créditos disponibles",
    unitSingular: "crédito",
    unitPlural: "créditos",
    zero: "0 créditos",
    unavailable: "Saldo no disponible",
    description: "Saldo actual de tu tienda",
    detailsLink: "Ver créditos y extracto",
    detailsAria: "Ver créditos y extracto",
  }),
  campaigns: Object.freeze({
    sectionLabel: "Campañas recientes",
    countSingular: "{count} campaña disponible",
    countPlural: "{count} campañas disponibles",
    emptyTitle: "No hay campañas disponibles",
    emptyBody:
      "Cuando una campaña esté lista, aparecerá aquí. Crea una nueva campaña para empezar.",
    emptyCta: "Crear campaña",
    viewAll: "Ver todas",
    open: "Abrir campaña",
    failureTitle: "No se pudieron cargar las campañas",
    failureBody: "Inténtalo de nuevo en unos instantes o abre la lista completa.",
    cardAria: "Abrir campaña {product}, {date}",
    orientation:
      "Abre una campaña para ver el contenido completo y descargarlo para publicar.",
  }),
  shortcut: Object.freeze({
    title: "¿Qué tal crear tu próxima campaña?",
    cta: "Crear campaña",
  }),
  news: Object.freeze({
    sectionLabel: "Novedades",
    view: "Ver novedades",
    close: "Cerrar anuncio",
  }),
  banners: Object.freeze({
    review: "Tus créditos de bienvenida están en verificación de registro.",
    approved: "¡Tus créditos de bienvenida fueron liberados!",
    approvedDismiss: "Cerrar",
    readinessTitle: "Tu tienda aún no está lista para generar campañas",
    readinessCadastroFiscal: "Registro fiscal (CNPJ)",
    readinessBrandProfile: "Dirección visual",
    readinessCta: "Configurar ahora",
  }),
  loading: Object.freeze({
    statusLabel: "Cargando el panel",
  }),
  noStore: Object.freeze({
    title: "Tu tienda aún no está configurada",
    body: "Configura los datos de la tienda para crear tu primera campaña.",
    cta: "Configurar tienda",
  }),
}) satisfies DashboardMessages;
