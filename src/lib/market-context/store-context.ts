import { MARKET_PROFILES } from "./market-profiles";
import {
  STORE_CONTEXT_VERSION,
  type MarketContextError,
  type StoreFieldSource,
  type StoreMarketContext,
  type StoreMarketContextParseResult,
  type StoreMarketContextResult,
  type StoreMarketSources,
  type SupportedContentLocale,
  type SupportedCurrency,
  type SupportedMarket,
  type SupportedTimeZone,
} from "./types";
import {
  createError,
  isPlainObject,
  isSupportedCurrency,
  isSupportedLocale,
  isSupportedMarket,
  isSupportedTimeZone,
  receivedValue,
} from "./validation";

const STORE_CONTEXT_KEYS = [
  "contextVersion",
  "country",
  "defaultCampaignMarket",
  "defaultContentLocale",
  "defaultCurrency",
  "timeZone",
] as const;

function resolveFailure(error: MarketContextError): StoreMarketContextResult {
  const result: StoreMarketContextResult = { ok: false, error };
  return Object.freeze(result);
}

function parseFailure(
  error: MarketContextError,
): StoreMarketContextParseResult {
  const result: StoreMarketContextParseResult = { ok: false, error };
  return Object.freeze(result);
}

function incomplete(field: string): StoreMarketContextParseResult {
  return parseFailure(
    createError("invalid_input", { field, reason: "incomplete" }),
  );
}

function buildContext(fields: {
  readonly country: SupportedMarket;
  readonly defaultCampaignMarket: SupportedMarket;
  readonly defaultContentLocale: SupportedContentLocale;
  readonly defaultCurrency: SupportedCurrency;
  readonly timeZone: SupportedTimeZone;
}): StoreMarketContext {
  return Object.freeze({
    contextVersion: STORE_CONTEXT_VERSION,
    country: fields.country,
    defaultCampaignMarket: fields.defaultCampaignMarket,
    defaultContentLocale: fields.defaultContentLocale,
    defaultCurrency: fields.defaultCurrency,
    timeZone: fields.timeZone,
  });
}

/**
 * Resolve a configuração da loja.
 *
 * - idioma e moeda padrão derivam do MERCADO PADRÃO das campanhas;
 * - fuso deriva do PAÍS cadastral;
 * - overrides explícitos vencem os padrões;
 * - `legacy` é declaração explícita e produz BR com proveniência `legacy_br`.
 */
export function resolveStoreMarketContext(
  input: unknown,
): StoreMarketContextResult {
  if (!isPlainObject(input)) {
    return resolveFailure(
      createError("invalid_input", {
        reason: "not_an_object",
        received: receivedValue(input),
      }),
    );
  }

  const kind = input.kind;

  if (kind === "legacy") {
    const profile = MARKET_PROFILES.BR;
    const context = buildContext({
      country: profile.market,
      defaultCampaignMarket: profile.market,
      defaultContentLocale: profile.defaultContentLocale,
      defaultCurrency: profile.defaultCurrency,
      timeZone: profile.defaultTimeZone,
    });
    const sources: StoreMarketSources = Object.freeze({
      country: "legacy_br" as StoreFieldSource,
      defaultCampaignMarket: "legacy_br" as StoreFieldSource,
      defaultContentLocale: "legacy_br" as StoreFieldSource,
      defaultCurrency: "legacy_br" as StoreFieldSource,
      timeZone: "legacy_br" as StoreFieldSource,
    });
    const result: StoreMarketContextResult = {
      ok: true,
      context,
      provenance: "legacy_br",
      sources,
    };
    return Object.freeze(result);
  }

  if (kind !== "configured") {
    return resolveFailure(
      createError("invalid_input", {
        field: "kind",
        reason: "invalid_field",
        received: receivedValue(kind),
      }),
    );
  }

  const rawCountry = input.country;
  if (rawCountry === undefined || rawCountry === null) {
    return resolveFailure(createError("missing_country", { field: "country" }));
  }
  if (!isSupportedMarket(rawCountry)) {
    return resolveFailure(
      createError("unsupported_market", {
        field: "country",
        reason: "invalid_field",
        received: receivedValue(rawCountry),
      }),
    );
  }
  const country = rawCountry;

  const rawMarket = input.defaultCampaignMarket;
  let defaultCampaignMarket: SupportedMarket;
  let marketSource: StoreFieldSource;
  if (rawMarket === undefined || rawMarket === null) {
    defaultCampaignMarket = country;
    marketSource = "default";
  } else if (isSupportedMarket(rawMarket)) {
    defaultCampaignMarket = rawMarket;
    marketSource = "configured";
  } else {
    return resolveFailure(
      createError("unsupported_market", {
        field: "defaultCampaignMarket",
        reason: "invalid_field",
        received: receivedValue(rawMarket),
      }),
    );
  }

  const marketProfile = MARKET_PROFILES[defaultCampaignMarket];

  const rawLocale = input.defaultContentLocale;
  let defaultContentLocale: SupportedContentLocale;
  let localeSource: StoreFieldSource;
  if (rawLocale === undefined || rawLocale === null) {
    defaultContentLocale = marketProfile.defaultContentLocale;
    localeSource = "default";
  } else if (isSupportedLocale(rawLocale)) {
    defaultContentLocale = rawLocale;
    localeSource = "configured";
  } else {
    return resolveFailure(
      createError("unsupported_locale", {
        field: "defaultContentLocale",
        reason: "invalid_field",
        received: receivedValue(rawLocale),
      }),
    );
  }

  const rawCurrency = input.defaultCurrency;
  let defaultCurrency: SupportedCurrency;
  let currencySource: StoreFieldSource;
  if (rawCurrency === undefined || rawCurrency === null) {
    defaultCurrency = marketProfile.defaultCurrency;
    currencySource = "default";
  } else if (isSupportedCurrency(rawCurrency)) {
    defaultCurrency = rawCurrency;
    currencySource = "configured";
  } else {
    return resolveFailure(
      createError("unsupported_currency", {
        field: "defaultCurrency",
        reason: "invalid_field",
        received: receivedValue(rawCurrency),
      }),
    );
  }

  const rawTimeZone = input.timeZone;
  let timeZone: SupportedTimeZone;
  let timeZoneSource: StoreFieldSource;
  if (rawTimeZone === undefined || rawTimeZone === null) {
    timeZone = MARKET_PROFILES[country].defaultTimeZone;
    timeZoneSource = "default";
  } else if (isSupportedTimeZone(rawTimeZone)) {
    timeZone = rawTimeZone;
    timeZoneSource = "configured";
  } else {
    return resolveFailure(
      createError("unsupported_time_zone", {
        field: "timeZone",
        reason: "invalid_field",
        received: receivedValue(rawTimeZone),
      }),
    );
  }

  const context = buildContext({
    country,
    defaultCampaignMarket,
    defaultContentLocale,
    defaultCurrency,
    timeZone,
  });
  const sources: StoreMarketSources = Object.freeze({
    country: "configured" as StoreFieldSource,
    defaultCampaignMarket: marketSource,
    defaultContentLocale: localeSource,
    defaultCurrency: currencySource,
    timeZone: timeZoneSource,
  });
  const result: StoreMarketContextResult = {
    ok: true,
    context,
    provenance: "configured",
    sources,
  };
  return Object.freeze(result);
}

/**
 * Parser estrito do valor já resolvido/persistido. NÃO aplica padrões:
 * objeto ausente, vazio, incompleto, com campo desconhecido ou versão ≠ 1
 * retorna erro tipado.
 */
export function parseStoreMarketContext(
  value: unknown,
): StoreMarketContextParseResult {
  if (!isPlainObject(value)) {
    return parseFailure(
      createError("invalid_input", {
        reason: "not_an_object",
        received: receivedValue(value),
      }),
    );
  }

  const extraKey = Object.keys(value).find(
    (key) => !(STORE_CONTEXT_KEYS as readonly string[]).includes(key),
  );
  if (extraKey !== undefined) {
    return parseFailure(
      createError("invalid_input", {
        field: extraKey,
        reason: "invalid_field",
        received: receivedValue(value[extraKey]),
      }),
    );
  }

  if (!("contextVersion" in value)) {
    return incomplete("contextVersion");
  }
  if (value.contextVersion !== STORE_CONTEXT_VERSION) {
    return parseFailure(
      createError("unsupported_context_version", {
        field: "contextVersion",
        reason: "unsupported_version",
        received: receivedValue(value.contextVersion),
      }),
    );
  }

  if (!("country" in value)) return incomplete("country");
  const country = value.country;
  if (!isSupportedMarket(country)) {
    return parseFailure(
      createError("unsupported_market", {
        field: "country",
        reason: "invalid_field",
        received: receivedValue(country),
      }),
    );
  }

  if (!("defaultCampaignMarket" in value)) {
    return incomplete("defaultCampaignMarket");
  }
  const defaultCampaignMarket = value.defaultCampaignMarket;
  if (!isSupportedMarket(defaultCampaignMarket)) {
    return parseFailure(
      createError("unsupported_market", {
        field: "defaultCampaignMarket",
        reason: "invalid_field",
        received: receivedValue(defaultCampaignMarket),
      }),
    );
  }

  if (!("defaultContentLocale" in value)) {
    return incomplete("defaultContentLocale");
  }
  const defaultContentLocale = value.defaultContentLocale;
  if (!isSupportedLocale(defaultContentLocale)) {
    return parseFailure(
      createError("unsupported_locale", {
        field: "defaultContentLocale",
        reason: "invalid_field",
        received: receivedValue(defaultContentLocale),
      }),
    );
  }

  if (!("defaultCurrency" in value)) return incomplete("defaultCurrency");
  const defaultCurrency = value.defaultCurrency;
  if (!isSupportedCurrency(defaultCurrency)) {
    return parseFailure(
      createError("unsupported_currency", {
        field: "defaultCurrency",
        reason: "invalid_field",
        received: receivedValue(defaultCurrency),
      }),
    );
  }

  if (!("timeZone" in value)) return incomplete("timeZone");
  const timeZone = value.timeZone;
  if (!isSupportedTimeZone(timeZone)) {
    return parseFailure(
      createError("unsupported_time_zone", {
        field: "timeZone",
        reason: "invalid_field",
        received: receivedValue(timeZone),
      }),
    );
  }

  const context = buildContext({
    country,
    defaultCampaignMarket,
    defaultContentLocale,
    defaultCurrency,
    timeZone,
  });
  const result: StoreMarketContextParseResult = { ok: true, context };
  return Object.freeze(result);
}
