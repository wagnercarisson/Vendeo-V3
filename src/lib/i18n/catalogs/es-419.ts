/**
 * Catálogo es-419 — espanhol neutro LATAM (F57.4).
 *
 * `satisfies Messages` garante paridade estrutural com pt-BR no typecheck.
 * Sem `vosotros` e sem regionalismos rio-platenses. Congelado em todos os
 * níveis.
 */

import type { Messages } from "../messages";

export const es419Messages = Object.freeze({
  common: Object.freeze({
    save: "Guardar cambios",
    retry: "Reintentar",
    loading: "Cargando...",
  }),
  shell: Object.freeze({
    nav: Object.freeze({
      dashboard: "Panel",
      campaigns: "Campañas",
      store: "Tienda",
      account: "Cuenta",
      news: "Novedades",
      ariaLabel: "Navegación principal",
    }),
    drawer: Object.freeze({
      close: "Cerrar menú",
      dialogLabel: "Menú de navegación",
    }),
    topbar: Object.freeze({
      openMenu: "Abrir menú de navegación",
      newCampaign: "Nueva campaña",
      newCampaignAria: "Crear nueva campaña",
    }),
    account: Object.freeze({
      trigger: "Menú de la cuenta",
      fallbackUser: "Usuario",
      settings: "Configuración",
      logout: "Cerrar sesión",
    }),
    badge: Object.freeze({
      available: "Novedades disponibles",
      view: "Ver novedades",
    }),
    notifications: Object.freeze({
      label: "Notificaciones",
      unread: "Notificaciones no leídas: {count}",
    }),
  }),
  settings: Object.freeze({
    title: "Configuración",
    breadcrumbDashboard: "Panel",
    languageSection: "Idioma de la aplicación",
    optionPtBr: "Português (Brasil)",
    optionEs419: "Español (Latinoamérica)",
    saved: "Idioma actualizado.",
    saving: "Guardando...",
    reload: "Recargar",
    login: "Iniciar sesión",
    error: Object.freeze({
      load: "No fue posible cargar tus preferencias.",
      validation: "No fue posible validar la selección.",
      session: "Tu sesión expiró. Inicia sesión de nuevo.",
      forbidden:
        "No fue posible confirmar el origen de la solicitud. Recarga la página.",
      conflict: "El idioma se modificó en otra sesión.",
      unavailable: "El servicio no está disponible. Inténtalo de nuevo.",
      connection: "Error de conexión. Verifica tu red e inténtalo de nuevo.",
    }),
  }),
}) satisfies Messages;
