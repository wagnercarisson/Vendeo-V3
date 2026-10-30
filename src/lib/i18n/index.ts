/**
 * Barrel client-safe de i18n (F57.4).
 *
 * Nunca reexporta `server.ts`: nenhum bundle cliente deve puxar `server-only`
 * nem a leitura de preferência.
 */

export { SUPPORTED_UI_LOCALES, DEFAULT_UI_LOCALE, UI_LOCALE_OPTIONS } from "./locales";
export type { SupportedUiLocale, UiLocaleOption } from "./locales";

export type {
  CommonMessages,
  ShellMessages,
  SettingsMessages,
  Messages,
} from "./messages";

export { ptBRMessages } from "./catalogs/pt-BR";
export { es419Messages } from "./catalogs/es-419";

export { getCatalog } from "./get-catalog";
export { formatMessage, translate } from "./translate";
export type { MessageParams } from "./translate";
