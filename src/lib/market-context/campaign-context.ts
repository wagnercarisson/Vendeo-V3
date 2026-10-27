import { MARKET_PROFILES } from "./market-profiles";
import {
  CAMPAIGN_CONTEXT_VERSION,
  type CampaignFieldSource,
  type CampaignMarketConfig,
  type CampaignMarketContext,
  type CampaignMarketContextReadResult,
  type CampaignMarketResolution,
  type CampaignMarketSources,
  type MarketContextError,
  type SupportedContentLocale,
  type SupportedCurrency,
  type SupportedMarket,
} from "./types";
import { parseStoreMarketContext } from "./store-context";
import {
  createError,
  isPlainObject,
  isSupportedCurrency,
  isSupportedLocale,
  isSupportedMarket,
  receivedValue,
} from "./validation";

const CAMPAIGN_CONTEXT_KEYS = [
  "contextVersion",
  "market",
  "contentLocale",
  "currency",
] as const;

function resolveFailure(error: MarketContextError): CampaignMarketResolution {
  const result: CampaignMarketResolution = { ok: false, error };
  return Object.freeze(result);
}

function incomplete(field: string): MarketContextError {
  return createError("invalid_input", { field, reason: "incomplete" });
}

/**
 * Resolve o contexto de uma campanha nova.
 *
 * Precedência:
 * - mercado: override → mercado padrão da loja
 * - idioma/moeda: override → padrão da loja (se destino = mercado padrão da
 *   loja) → padrão do perfil do mercado de destino
 *
 * Trocar o destino sugere os padrões do destino; override explícito vence.
 */
export function resolveCampaignMarketContext(
  config: CampaignMarketConfig,
): CampaignMarketResolution {
  if (!isPlainObject(config)) {
    return resolveFailure(
      createError("invalid_input", {
        reason: "not_an_object",
        received: receivedValue(config),
      }),
    );
  }

  const storeResult = parseStoreMarketContext(config.store);
  if (!storeResult.ok) {
    return resolveFailure(storeResult.error);
  }
  const store = storeResult.context;

  const storeIsLegacy = config.storeIsLegacy;
  if (storeIsLegacy !== undefined && typeof storeIsLegacy !== "boolean") {
    return resolveFailure(
      createError("invalid_input", {
        field: "storeIsLegacy",
        reason: "invalid_field",
        received: receivedValue(storeIsLegacy),
      }),
    );
  }
  const isLegacy = storeIsLegacy === true;

  const rawOverrides = config.overrides;
  if (rawOverrides !== undefined && rawOverrides !== null && !isPlainObject(rawOverrides)) {
    return resolveFailure(
      createError("invalid_input", {
        field: "overrides",
        reason: "invalid_field",
        received: receivedValue(rawOverrides),
      }),
    );
  }
  const overrides = isPlainObject(rawOverrides) ? rawOverrides : {};
  const storeSource: CampaignFieldSource = isLegacy
    ? "legacy_br"
    : "store_default";

  const rawMarket = overrides.market;
  let market: SupportedMarket;
  let marketSource: CampaignFieldSource;
  if (rawMarket !== undefined && rawMarket !== null) {
    if (!isSupportedMarket(rawMarket)) {
      return resolveFailure(
        createError("unsupported_market", {
          field: "market",
          reason: "invalid_field",
          received: receivedValue(rawMarket),
        }),
      );
    }
    market = rawMarket;
    marketSource = "campaign_override";
  } else {
    market = store.defaultCampaignMarket;
    marketSource = storeSource;
  }

  const usesStoreDefaults = market === store.defaultCampaignMarket;
  const marketProfile = MARKET_PROFILES[market];

  const rawLocale = overrides.contentLocale;
  let contentLocale: SupportedContentLocale;
  let localeSource: CampaignFieldSource;
  if (rawLocale !== undefined && rawLocale !== null) {
    if (!isSupportedLocale(rawLocale)) {
      return resolveFailure(
        createError("unsupported_locale", {
          field: "contentLocale",
          reason: "invalid_field",
          received: receivedValue(rawLocale),
        }),
      );
    }
    contentLocale = rawLocale;
    localeSource = "campaign_override";
  } else if (usesStoreDefaults) {
    contentLocale = store.defaultContentLocale;
    localeSource = storeSource;
  } else {
    contentLocale = marketProfile.defaultContentLocale;
    localeSource = "market_profile_default";
  }

  const rawCurrency = overrides.currency;
  let currency: SupportedCurrency;
  let currencySource: CampaignFieldSource;
  if (rawCurrency !== undefined && rawCurrency !== null) {
    if (!isSupportedCurrency(rawCurrency)) {
      return resolveFailure(
        createError("unsupported_currency", {
          field: "currency",
          reason: "invalid_field",
          received: receivedValue(rawCurrency),
        }),
      );
    }
    currency = rawCurrency;
    currencySource = "campaign_override";
  } else if (usesStoreDefaults) {
    currency = store.defaultCurrency;
    currencySource = storeSource;
  } else {
    currency = marketProfile.defaultCurrency;
    currencySource = "market_profile_default";
  }

  const context: CampaignMarketContext = Object.freeze({
    contextVersion: CAMPAIGN_CONTEXT_VERSION,
    market,
    contentLocale,
    currency,
  });
  const sources: CampaignMarketSources = Object.freeze({
    market: marketSource,
    contentLocale: localeSource,
    currency: currencySource,
  });
  const result: CampaignMarketResolution = { ok: true, context, sources };
  return Object.freeze(result);
}

/**
 * Parser estrito do valor versionado de campanha. Não aplica defaults e não
 * faz backfill.
 */
export function parseCampaignMarketContext(
  value: unknown,
): Exclude<CampaignMarketContextReadResult, { kind: "missing_legacy" }> {
  if (!isPlainObject(value)) {
    const error = createError("invalid_input", {
      reason: "not_an_object",
      received: receivedValue(value),
    });
    return Object.freeze({ kind: "invalid" as const, error });
  }

  const extraKey = Object.keys(value).find(
    (key) => !(CAMPAIGN_CONTEXT_KEYS as readonly string[]).includes(key),
  );
  if (extraKey !== undefined) {
    const error = createError("invalid_input", {
      field: extraKey,
      reason: "invalid_field",
      received: receivedValue(value[extraKey]),
    });
    return Object.freeze({ kind: "invalid" as const, error });
  }

  if (!("contextVersion" in value)) {
    return Object.freeze({
      kind: "invalid" as const,
      error: incomplete("contextVersion"),
    });
  }
  if (value.contextVersion !== CAMPAIGN_CONTEXT_VERSION) {
    const error = createError("unsupported_context_version", {
      field: "contextVersion",
      reason: "unsupported_version",
      received: receivedValue(value.contextVersion),
    });
    return Object.freeze({ kind: "invalid" as const, error });
  }

  if (!("market" in value)) {
    return Object.freeze({
      kind: "invalid" as const,
      error: incomplete("market"),
    });
  }
  const market = value.market;
  if (!isSupportedMarket(market)) {
    const error = createError("unsupported_market", {
      field: "market",
      reason: "invalid_field",
      received: receivedValue(market),
    });
    return Object.freeze({ kind: "invalid" as const, error });
  }

  if (!("contentLocale" in value)) {
    return Object.freeze({
      kind: "invalid" as const,
      error: incomplete("contentLocale"),
    });
  }
  const contentLocale = value.contentLocale;
  if (!isSupportedLocale(contentLocale)) {
    const error = createError("unsupported_locale", {
      field: "contentLocale",
      reason: "invalid_field",
      received: receivedValue(contentLocale),
    });
    return Object.freeze({ kind: "invalid" as const, error });
  }

  if (!("currency" in value)) {
    return Object.freeze({
      kind: "invalid" as const,
      error: incomplete("currency"),
    });
  }
  const currency = value.currency;
  if (!isSupportedCurrency(currency)) {
    const error = createError("unsupported_currency", {
      field: "currency",
      reason: "invalid_field",
      received: receivedValue(currency),
    });
    return Object.freeze({ kind: "invalid" as const, error });
  }

  const context: CampaignMarketContext = Object.freeze({
    contextVersion: CAMPAIGN_CONTEXT_VERSION,
    market,
    contentLocale,
    currency,
  });
  return Object.freeze({ kind: "present" as const, context });
}

/**
 * Leitura de campanha entregue/legada.
 *
 * - `null`/`undefined` → `missing_legacy` (ausência real em campanha antiga)
 * - vazio/incompleto/versão desconhecida/campo desconhecido/não-objeto →
 *   `invalid` com `reason`
 * - completo e válido → `present` com cópia NOVA e congelada
 *
 * Nunca consulta loja/usuário, nunca preenche defaults, nunca converte.
 */
export function readCampaignMarketContext(
  value: unknown,
): CampaignMarketContextReadResult {
  if (value === null || value === undefined) {
    return Object.freeze({ kind: "missing_legacy" as const });
  }
  return parseCampaignMarketContext(value);
}
