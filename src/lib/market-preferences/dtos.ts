import {
  isSupportedCurrency,
  isSupportedLocale,
  isSupportedMarket,
  isSupportedTimeZone,
  resolveUiLocale,
  type SupportedContentLocale,
  type SupportedCurrency,
  type SupportedMarket,
  type SupportedTimeZone,
} from "@/lib/market-context";
import { StoredPreferencesInvalidError } from "./errors";

/**
 * F57.2 — DTOs allowlisted das preferências de mercado.
 *
 * A linha crua contém chaves internas (`user_id`, `store_id`, `created_at`,
 * `updated_at`) e nomes snake_case. O DTO é construído por allowlist explícita,
 * nunca por spread. Mapa de renomeação:
 *
 *   ui_locale                  -> uiLocale
 *   ui_locale_source           -> source
 *   country_code               -> countryCode
 *   country_source             -> countrySource
 *   default_campaign_market    -> defaultCampaignMarket
 *   default_campaign_market_source -> defaultCampaignMarketSource
 *   default_content_locale     -> defaultContentLocale
 *   default_content_locale_source  -> defaultContentLocaleSource
 *   default_currency           -> defaultCurrency
 *   default_currency_source    -> defaultCurrencySource
 *   time_zone                  -> timeZone
 *   time_zone_source           -> timeZoneSource
 *   context_version            -> contextVersion
 *   settings_version           -> settingsVersion
 */

export type DbStoreFieldSource = "explicit" | "default" | "legacy_br";
export type DbCountrySource =
  | "assumed_default"
  | "fiscal_confirmation"
  | "legacy_br";

export interface UserLocalePreferenceDTO {
  uiLocale: SupportedContentLocale;
  source: "explicit" | "legacy_br";
  version: number;
}

export interface StoreMarketSettingsDTO {
  countryCode: SupportedMarket;
  countrySource: DbCountrySource;
  defaultCampaignMarket: SupportedMarket;
  defaultCampaignMarketSource: DbStoreFieldSource;
  defaultContentLocale: SupportedContentLocale;
  defaultContentLocaleSource: DbStoreFieldSource;
  defaultCurrency: SupportedCurrency;
  defaultCurrencySource: DbStoreFieldSource;
  timeZone: SupportedTimeZone;
  timeZoneSource: DbStoreFieldSource;
  contextVersion: number;
  settingsVersion: number;
}

const STORE_FIELD_SOURCES: readonly DbStoreFieldSource[] = [
  "explicit",
  "default",
  "legacy_br",
];

const COUNTRY_SOURCES: readonly DbCountrySource[] = [
  "assumed_default",
  "fiscal_confirmation",
  "legacy_br",
];

function asStoreFieldSource(value: unknown, field: string): DbStoreFieldSource {
  if (!STORE_FIELD_SOURCES.includes(value as DbStoreFieldSource)) {
    throw new Error(`Fonte inválida persistida em ${field}`);
  }
  return value as DbStoreFieldSource;
}

function asCountrySource(value: unknown): DbCountrySource {
  if (!COUNTRY_SOURCES.includes(value as DbCountrySource)) {
    throw new Error("Fonte de país inválida persistida");
  }
  return value as DbCountrySource;
}

/**
 * Inteiro estrito de linha persistida: aceita número inteiro seguro >= 0 ou
 * string composta apenas por dígitos. Rejeita null/boolean/""/float/negativo.
 */
export function parseStoredInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string") {
    if (!/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function asInteger(value: unknown, field: string): number {
  const parsed = parseStoredInteger(value);
  if (parsed === null) {
    throw new Error(`Valor inteiro inválido persistido em ${field}`);
  }
  return parsed;
}

export function assertSupportedUiLocale(
  value: unknown,
): value is SupportedContentLocale {
  return isSupportedLocale(value);
}

export function toUserLocalePreferenceDTO(
  raw: Record<string, unknown>,
): UserLocalePreferenceDTO {
  const locale = raw.ui_locale;
  const source = raw.ui_locale_source;
  const version = parseStoredInteger(raw.version);
  if (version === null) throw new StoredPreferencesInvalidError();

  if (locale === null && source === "legacy_br") {
    const resolution = resolveUiLocale({ kind: "legacy" });
    if (!resolution.ok) throw new StoredPreferencesInvalidError(resolution.error);
    return { uiLocale: resolution.uiLocale, source: "legacy_br", version };
  }

  if (locale !== null && source === "explicit") {
    const resolution = resolveUiLocale({ kind: "explicit", uiLocale: locale });
    if (!resolution.ok) throw new StoredPreferencesInvalidError(resolution.error);
    return { uiLocale: resolution.uiLocale, source: "explicit", version };
  }

  throw new StoredPreferencesInvalidError();
}

export function toStoreMarketSettingsDTO(
  raw: Record<string, unknown>,
): StoreMarketSettingsDTO {
  const market = raw.default_campaign_market;
  const locale = raw.default_content_locale;
  const currency = raw.default_currency;
  const timeZone = raw.time_zone;
  const country = raw.country_code;
  if (!isSupportedMarket(market)) throw new Error("Mercado inválido persistido");
  if (!isSupportedLocale(locale)) throw new Error("Locale inválido persistido");
  if (!isSupportedCurrency(currency)) throw new Error("Moeda inválida persistida");
  if (!isSupportedTimeZone(timeZone)) throw new Error("Fuso inválido persistido");
  if (!isSupportedMarket(country)) throw new Error("País inválido persistido");
  return {
    countryCode: country,
    countrySource: asCountrySource(raw.country_source),
    defaultCampaignMarket: market,
    defaultCampaignMarketSource: asStoreFieldSource(
      raw.default_campaign_market_source,
      "default_campaign_market_source",
    ),
    defaultContentLocale: locale,
    defaultContentLocaleSource: asStoreFieldSource(
      raw.default_content_locale_source,
      "default_content_locale_source",
    ),
    defaultCurrency: currency,
    defaultCurrencySource: asStoreFieldSource(
      raw.default_currency_source,
      "default_currency_source",
    ),
    timeZone,
    timeZoneSource: asStoreFieldSource(
      raw.time_zone_source,
      "time_zone_source",
    ),
    contextVersion: asInteger(raw.context_version, "context_version"),
    settingsVersion: asInteger(raw.settings_version, "settings_version"),
  };
}
