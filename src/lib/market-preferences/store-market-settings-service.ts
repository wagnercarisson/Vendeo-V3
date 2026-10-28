import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";
import { StoreNotFoundError } from "@/lib/auth/store-ownership";
import {
  MARKET_PROFILES,
  parseStoreMarketContext,
  resolveStoreMarketContext,
  type SupportedContentLocale,
  type SupportedCurrency,
  type SupportedMarket,
  type SupportedTimeZone,
} from "@/lib/market-context";
import {
  CountryNotMutableError,
  PreferencesUnavailableError,
  PreferencesValidationError,
  PreferencesVersionConflictError,
  StoredPreferencesInvalidError,
  isCountryNotMutable,
  isSettingsVersionConflict,
  versionFromPgError,
} from "./errors";
import {
  toStoreMarketSettingsDTO,
  type DbCountrySource,
  type DbStoreFieldSource,
  type StoreMarketSettingsDTO,
} from "./dtos";

/**
 * F57.2 — configurações de mercado por loja.
 *
 * O cliente `service_role` é necessário porque a escrita só existe pela RPC
 * `write_store_market_settings` e a leitura precisa distinguir ausência de erro.
 * Ownership vem sempre do servidor (`userId` autenticado); nunca do corpo.
 */

export const DB_TO_LIB_SOURCE: Record<DbStoreFieldSource, "configured" | "default" | "legacy_br"> = {
  explicit: "configured",
  default: "default",
  legacy_br: "legacy_br",
};

export const LIB_TO_DB_SOURCE: Record<"configured" | "default" | "legacy_br", DbStoreFieldSource> = {
  configured: "explicit",
  default: "default",
  legacy_br: "legacy_br",
};

export type OwnedStoreLookup =
  | { kind: "found"; storeId: string; ownerId: string }
  | { kind: "not_found" }
  | { kind: "read_error" };

export interface StoreMarketSettingsState {
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

/**
 * Semântica do patch:
 * - `undefined` (omitido): não tocar, preservando valor E fonte;
 * - `null`: limpar override e recomputar o padrão com fonte `default`;
 * - valor suportado: definir com fonte `explicit`.
 * `expectedVersion` é obrigatório. O tipo NÃO aceita país, storeId, userId,
 * contextVersion nem settingsVersion; a rota rejeita chaves desconhecidas.
 */
export type StoreMarketSettingsPatch = {
  defaultCampaignMarket?: SupportedMarket | null;
  defaultContentLocale?: SupportedContentLocale | null;
  defaultCurrency?: SupportedCurrency | null;
  timeZone?: SupportedTimeZone | null;
  expectedVersion: number;
};

const SETTINGS_COLUMNS =
  "country_code, country_source, default_campaign_market, default_campaign_market_source, default_content_locale, default_content_locale_source, default_currency, default_currency_source, time_zone, time_zone_source, context_version, settings_version";

const DB_FIELD_SOURCES: readonly DbStoreFieldSource[] = [
  "explicit",
  "default",
  "legacy_br",
];
const COUNTRY_SOURCES: readonly DbCountrySource[] = [
  "assumed_default",
  "fiscal_confirmation",
  "legacy_br",
];

function isDbFieldSource(value: unknown): value is DbStoreFieldSource {
  return DB_FIELD_SOURCES.includes(value as DbStoreFieldSource);
}

function asDbFieldSource(value: unknown): DbStoreFieldSource {
  if (!isDbFieldSource(value)) throw new StoredPreferencesInvalidError();
  return value;
}

function isCountrySource(value: unknown): value is DbCountrySource {
  return COUNTRY_SOURCES.includes(value as DbCountrySource);
}

function asSupportedMarket(value: unknown): SupportedMarket {
  if (value === "BR" || value === "PY") return value;
  throw new StoredPreferencesInvalidError();
}

function asContentLocale(value: unknown): SupportedContentLocale {
  if (value === "pt-BR" || value === "es-PY") return value;
  throw new StoredPreferencesInvalidError();
}

function asCurrency(value: unknown): SupportedCurrency {
  if (value === "BRL" || value === "PYG") return value;
  throw new StoredPreferencesInvalidError();
}

function asTimeZone(value: unknown): SupportedTimeZone {
  if (value === "America/Sao_Paulo" || value === "America/Asuncion") return value;
  throw new StoredPreferencesInvalidError();
}

function asVersion(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  throw new StoredPreferencesInvalidError();
}

export function legacyStoreMarketSettingsState(): StoreMarketSettingsState {
  return {
    countryCode: "BR",
    countrySource: "legacy_br",
    defaultCampaignMarket: "BR",
    defaultCampaignMarketSource: "legacy_br",
    defaultContentLocale: "pt-BR",
    defaultContentLocaleSource: "legacy_br",
    defaultCurrency: "BRL",
    defaultCurrencySource: "legacy_br",
    timeZone: "America/Sao_Paulo",
    timeZoneSource: "legacy_br",
    contextVersion: 1,
    settingsVersion: 0,
  };
}

function stateFromRow(raw: Record<string, unknown>): StoreMarketSettingsState {
  if (!isCountrySource(raw.country_source)) throw new StoredPreferencesInvalidError();
  const sources = [
    raw.default_campaign_market_source,
    raw.default_content_locale_source,
    raw.default_currency_source,
    raw.time_zone_source,
  ];
  if (!sources.every(isDbFieldSource)) throw new StoredPreferencesInvalidError();
  return {
    countryCode: asSupportedMarket(raw.country_code),
    countrySource: raw.country_source,
    defaultCampaignMarket: asSupportedMarket(raw.default_campaign_market),
    defaultCampaignMarketSource: asDbFieldSource(raw.default_campaign_market_source),
    defaultContentLocale: asContentLocale(raw.default_content_locale),
    defaultContentLocaleSource: asDbFieldSource(raw.default_content_locale_source),
    defaultCurrency: asCurrency(raw.default_currency),
    defaultCurrencySource: asDbFieldSource(raw.default_currency_source),
    timeZone: asTimeZone(raw.time_zone),
    timeZoneSource: asDbFieldSource(raw.time_zone_source),
    contextVersion: asVersion(raw.context_version),
    settingsVersion: asVersion(raw.settings_version),
  };
}

function stateToDto(state: StoreMarketSettingsState): StoreMarketSettingsDTO {
  return toStoreMarketSettingsDTO({
    country_code: state.countryCode,
    country_source: state.countrySource,
    default_campaign_market: state.defaultCampaignMarket,
    default_campaign_market_source: state.defaultCampaignMarketSource,
    default_content_locale: state.defaultContentLocale,
    default_content_locale_source: state.defaultContentLocaleSource,
    default_currency: state.defaultCurrency,
    default_currency_source: state.defaultCurrencySource,
    time_zone: state.timeZone,
    time_zone_source: state.timeZoneSource,
    context_version: state.contextVersion,
    settings_version: state.settingsVersion,
  });
}

function validateCompleteState(state: StoreMarketSettingsState): void {
  const input = {
    kind: "configured" as const,
    country: state.countryCode,
    defaultCampaignMarket: state.defaultCampaignMarket,
    defaultContentLocale: state.defaultContentLocale,
    defaultCurrency: state.defaultCurrency,
    timeZone: state.timeZone,
  };
  const resolved = resolveStoreMarketContext(input);
  if (!resolved.ok) throw new StoredPreferencesInvalidError(resolved.error);
  const parsed = parseStoreMarketContext({
    contextVersion: state.contextVersion,
    country: state.countryCode,
    defaultCampaignMarket: state.defaultCampaignMarket,
    defaultContentLocale: state.defaultContentLocale,
    defaultCurrency: state.defaultCurrency,
    timeZone: state.timeZone,
  });
  if (!parsed.ok) throw new StoredPreferencesInvalidError(parsed.error);
}

export async function loadOwnedStoreForMarketSettings(
  userId: string,
): Promise<OwnedStoreLookup> {
  const { data, error } = await supabaseAdmin
    .from("stores")
    .select("id, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { kind: "read_error" };
  if (!data) return { kind: "not_found" };
  const row = data as { id: string; user_id: string };
  return { kind: "found", storeId: row.id, ownerId: row.user_id };
}

async function readStoreState(storeId: string): Promise<StoreMarketSettingsState | null> {
  const { data, error } = await supabaseAdmin
    .from("store_market_settings")
    .select(SETTINGS_COLUMNS)
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) throw new PreferencesUnavailableError();
  if (!data) return null;
  const state = stateFromRow(data as Record<string, unknown>);
  // Estado persistido é validado por completo ANTES de qualquer retorno/PATCH.
  // context_version desconhecida, versões inválidas ou combinação incoerente
  // devem falhar fechado (500), nunca ser reinterpretadas como v1.
  validateCompleteState(state);
  return state;
}

async function requireStoreId(userId: string): Promise<string> {
  const lookup = await loadOwnedStoreForMarketSettings(userId);
  if (lookup.kind === "read_error") throw new PreferencesUnavailableError();
  if (lookup.kind === "not_found") {
    throw new StoreNotFoundError();
  }
  return lookup.storeId;
}

export async function getStoreMarketSettings(
  userId: string,
): Promise<StoreMarketSettingsDTO> {
  const storeId = await requireStoreId(userId);
  const state = await readStoreState(storeId);
  if (!state) return stateToDto(legacyStoreMarketSettingsState());
  validateCompleteState(state);
  return stateToDto(state);
}

function assertNoCountryInPatch(patch: Record<string, unknown>): void {
  if ("country" in patch || "country_code" in patch) {
    throw new CountryNotMutableError();
  }
}

export function recomposeStoreMarketSettings(
  current: StoreMarketSettingsState,
  patch: Omit<StoreMarketSettingsPatch, "expectedVersion">,
): StoreMarketSettingsState {
  assertNoCountryInPatch(patch as Record<string, unknown>);

  let defaultCampaignMarket = current.defaultCampaignMarket;
  let defaultCampaignMarketSource = current.defaultCampaignMarketSource;
  if (patch.defaultCampaignMarket !== undefined) {
    if (patch.defaultCampaignMarket === null) {
      defaultCampaignMarket = current.countryCode;
      defaultCampaignMarketSource = "default";
    } else {
      defaultCampaignMarket = patch.defaultCampaignMarket;
      defaultCampaignMarketSource = "explicit";
    }
  }

  const marketChanged =
    patch.defaultCampaignMarket !== undefined &&
    defaultCampaignMarket !== current.defaultCampaignMarket;

  let defaultContentLocale = current.defaultContentLocale;
  let defaultContentLocaleSource = current.defaultContentLocaleSource;
  let defaultCurrency = current.defaultCurrency;
  let defaultCurrencySource = current.defaultCurrencySource;

  if (marketChanged) {
    const profile = MARKET_PROFILES[defaultCampaignMarket];
    if (defaultContentLocaleSource === "default" || defaultContentLocaleSource === "legacy_br") {
      defaultContentLocale = profile.defaultContentLocale;
      defaultContentLocaleSource = "default";
    }
    if (defaultCurrencySource === "default" || defaultCurrencySource === "legacy_br") {
      defaultCurrency = profile.defaultCurrency;
      defaultCurrencySource = "default";
    }
  }

  if (patch.defaultContentLocale !== undefined) {
    if (patch.defaultContentLocale === null) {
      defaultContentLocale = MARKET_PROFILES[defaultCampaignMarket].defaultContentLocale;
      defaultContentLocaleSource = "default";
    } else {
      defaultContentLocale = patch.defaultContentLocale;
      defaultContentLocaleSource = "explicit";
    }
  }

  if (patch.defaultCurrency !== undefined) {
    if (patch.defaultCurrency === null) {
      defaultCurrency = MARKET_PROFILES[defaultCampaignMarket].defaultCurrency;
      defaultCurrencySource = "default";
    } else {
      defaultCurrency = patch.defaultCurrency;
      defaultCurrencySource = "explicit";
    }
  }

  let timeZone = current.timeZone;
  let timeZoneSource = current.timeZoneSource;
  if (patch.timeZone !== undefined) {
    if (patch.timeZone === null) {
      timeZone = MARKET_PROFILES[current.countryCode].defaultTimeZone;
      timeZoneSource = "default";
    } else {
      timeZone = patch.timeZone;
      timeZoneSource = "explicit";
    }
  }

  const next: StoreMarketSettingsState = {
    countryCode: current.countryCode,
    countrySource: current.countrySource,
    defaultCampaignMarket,
    defaultCampaignMarketSource,
    defaultContentLocale,
    defaultContentLocaleSource,
    defaultCurrency,
    defaultCurrencySource,
    timeZone,
    timeZoneSource,
    contextVersion: 1,
    settingsVersion: current.settingsVersion,
  };
  validateCompleteState(next);
  return next;
}

function hasPatchFields(patch: StoreMarketSettingsPatch): boolean {
  return (
    patch.defaultCampaignMarket !== undefined ||
    patch.defaultContentLocale !== undefined ||
    patch.defaultCurrency !== undefined ||
    patch.timeZone !== undefined
  );
}

export async function updateStoreMarketSettings(
  userId: string,
  patch: StoreMarketSettingsPatch,
): Promise<StoreMarketSettingsDTO> {
  assertNoCountryInPatch(patch as unknown as Record<string, unknown>);
  if (!Number.isSafeInteger(patch.expectedVersion) || patch.expectedVersion < 0) {
    throw new PreferencesValidationError({
      expectedVersion: "expectedVersion deve ser inteiro >= 0",
    });
  }

  const storeId = await requireStoreId(userId);
  const currentState = await readStoreState(storeId);

  if (!hasPatchFields(patch)) {
    const currentVersion = currentState?.settingsVersion ?? 0;
    if (currentVersion !== patch.expectedVersion) {
      throw new PreferencesVersionConflictError(currentVersion);
    }
    return stateToDto(currentState ?? legacyStoreMarketSettingsState());
  }

  const base = currentState ?? legacyStoreMarketSettingsState();
  const next = recomposeStoreMarketSettings(base, patch);

  const { data, error } = await supabaseAdmin.rpc("write_store_market_settings", {
    p_store_id: storeId,
    p_default_campaign_market: next.defaultCampaignMarket,
    p_default_campaign_market_source: next.defaultCampaignMarketSource,
    p_default_content_locale: next.defaultContentLocale,
    p_default_content_locale_source: next.defaultContentLocaleSource,
    p_default_currency: next.defaultCurrency,
    p_default_currency_source: next.defaultCurrencySource,
    p_time_zone: next.timeZone,
    p_time_zone_source: next.timeZoneSource,
    p_country_code: next.countryCode,
    p_country_source: next.countrySource,
    p_context_version: 1,
    p_expected_version: patch.expectedVersion,
  });

  if (error) {
    if (isSettingsVersionConflict(error)) {
      const hinted = versionFromPgError(error);
      if (hinted !== null) throw new PreferencesVersionConflictError(hinted);
      const reread = await readStoreState(storeId);
      throw new PreferencesVersionConflictError(reread?.settingsVersion ?? 0);
    }
    if (isCountryNotMutable(error)) throw new CountryNotMutableError();
    const message = String((error as { message?: unknown }).message ?? "");
    if (message.includes("store_not_found")) {
      throw new StoreNotFoundError();
    }
    throw new PreferencesUnavailableError();
  }

  const raw = Array.isArray(data) ? data[0] : data;
  if (typeof raw !== "object" || raw === null) throw new StoredPreferencesInvalidError();
  const state = stateFromRow(raw as Record<string, unknown>);
  validateCompleteState(state);
  return stateToDto(state);
}
