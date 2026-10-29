import { MARKET_PROFILES } from "./market-profiles";
import {
  MARKET_PROFILE_VERSION,
  SUPPORTED_CONTENT_LOCALES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_MARKETS,
  SUPPORTED_TIME_ZONES,
  SUPPORTED_UI_LOCALES,
  type MarketContextError,
  type MarketContextErrorCode,
  type MarketContextErrorReason,
  type MarketProfile,
  type SupportedContentLocale,
  type SupportedCurrency,
  type SupportedMarket,
  type SupportedTimeZone,
  type SupportedUiLocale,
} from "./types";

function includesValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function isSupportedMarket(value: unknown): value is SupportedMarket {
  return includesValue(SUPPORTED_MARKETS, value);
}

export function isSupportedLocale(
  value: unknown,
): value is SupportedContentLocale {
  return includesValue(SUPPORTED_CONTENT_LOCALES, value);
}

/** Guard do idioma da interface; não deve ser usado para conteúdo/campanha. */
export function isSupportedUiLocale(value: unknown): value is SupportedUiLocale {
  return includesValue(SUPPORTED_UI_LOCALES, value);
}

export function isSupportedCurrency(
  value: unknown,
): value is SupportedCurrency {
  return includesValue(SUPPORTED_CURRENCIES, value);
}

export function isSupportedTimeZone(
  value: unknown,
): value is SupportedTimeZone {
  return includesValue(SUPPORTED_TIME_ZONES, value);
}

/** Retorna o perfil ou `undefined`; nunca lança. */
export function getMarketProfile(value: unknown): MarketProfile | undefined {
  return isSupportedMarket(value) ? MARKET_PROFILES[value] : undefined;
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Retorna a primeira chave própria não permitida, ou `undefined`.
 * Usado para exigir ausência TOTAL de configuração no modo `legacy`.
 */
export function findUnexpectedKey(
  value: Record<string, unknown>,
  allowed: readonly string[],
): string | undefined {
  return Object.keys(value).find((key) => !allowed.includes(key));
}

/**
 * Sanitiza o valor recebido para o erro: nunca expõe referência à entrada.
 */
export function receivedValue(value: unknown): unknown {
  if (value === null) return null;
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return "array";
  if (type === "object") return "object";
  return type;
}

export interface CreateErrorOptions {
  readonly field?: string;
  readonly received?: unknown;
  readonly reason?: MarketContextErrorReason;
}

/** Cria erro tipado e congelado. */
export function createError(
  code: MarketContextErrorCode,
  options: CreateErrorOptions = {},
): MarketContextError {
  const error: MarketContextError = {
    code,
    ...(options.field !== undefined ? { field: options.field } : {}),
    ...(options.received !== undefined
      ? { received: options.received }
      : {}),
    ...(options.reason !== undefined ? { reason: options.reason } : {}),
  };
  return Object.freeze(error);
}

/**
 * Verificação estática do registry. Retorna `null` quando consistente.
 * Usada em teste; não lança em import (o registry é constante estática).
 */
export function checkMarketProfileRegistry(): MarketContextError | null {
  const registry = MARKET_PROFILES as Record<string, MarketProfile | undefined>;
  const keys = Object.keys(registry);

  for (const key of keys) {
    if (!isSupportedMarket(key)) {
      return createError("invalid_profile_registry", {
        field: "profileRegistry",
        received: key,
      });
    }
  }

  for (const market of SUPPORTED_MARKETS) {
    const profile = registry[market];
    if (!profile) {
      return createError("invalid_profile_registry", {
        field: "profileRegistry",
        received: market,
      });
    }
    if (profile.market !== market) {
      return createError("invalid_profile_registry", {
        field: "profileRegistry",
        received: market,
      });
    }
    if (profile.profileVersion !== MARKET_PROFILE_VERSION) {
      return createError("invalid_profile_registry", {
        field: "profileVersion",
        received: profile.profileVersion,
      });
    }
    if (!isSupportedLocale(profile.defaultContentLocale)) {
      return createError("invalid_profile_registry", {
        field: "defaultContentLocale",
        received: profile.defaultContentLocale,
      });
    }
    if (!isSupportedCurrency(profile.defaultCurrency)) {
      return createError("invalid_profile_registry", {
        field: "defaultCurrency",
        received: profile.defaultCurrency,
      });
    }
    if (!isSupportedTimeZone(profile.defaultTimeZone)) {
      return createError("invalid_profile_registry", {
        field: "defaultTimeZone",
        received: profile.defaultTimeZone,
      });
    }
  }

  return null;
}
