import {
  MARKET_PROFILE_VERSION,
  type MarketProfile,
  type MarketProfileRegistry,
} from "./types";

/**
 * Perfis de referência, congelados recursivamente (cada perfil e o registry).
 * `PY` existe como referência — não habilita operação no Paraguai.
 */
export const MARKET_PROFILES: MarketProfileRegistry = Object.freeze({
  BR: Object.freeze({
    market: "BR",
    profileVersion: MARKET_PROFILE_VERSION,
    defaultContentLocale: "pt-BR",
    defaultCurrency: "BRL",
    defaultTimeZone: "America/Sao_Paulo",
  }),
  PY: Object.freeze({
    market: "PY",
    profileVersion: MARKET_PROFILE_VERSION,
    defaultContentLocale: "es-PY",
    defaultCurrency: "PYG",
    defaultTimeZone: "America/Asuncion",
  }),
});
