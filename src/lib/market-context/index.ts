/**
 * Barrel público da fundação multimercado (v1).
 *
 * Nenhum caminho produtivo importa este módulo nesta fatia.
 */

export {
  SUPPORTED_MARKETS,
  SUPPORTED_CONTENT_LOCALES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIME_ZONES,
  STORE_CONTEXT_VERSION,
  CAMPAIGN_CONTEXT_VERSION,
  MARKET_PROFILE_VERSION,
} from "./types";

export type {
  SupportedMarket,
  SupportedContentLocale,
  SupportedCurrency,
  SupportedTimeZone,
  StoreContextVersion,
  CampaignContextVersion,
  MarketProfileVersion,
  MarketProfile,
  MarketProfileRegistry,
  StoreMarketConfigInput,
  StoreMarketContext,
  StoreMarketProvenance,
  StoreFieldSource,
  StoreMarketSources,
  StoreMarketContextSuccess,
  StoreMarketContextFailure,
  StoreMarketContextResult,
  StoreMarketContextParseResult,
  UserLocalePreference,
  UiLocaleProvenance,
  UserLocaleResolution,
  CampaignMarketContext,
  CampaignFieldSource,
  CampaignMarketSources,
  CampaignMarketOverrides,
  CampaignMarketConfig,
  CampaignMarketResolution,
  CampaignMarketContextReadResult,
  MarketContextError,
  MarketContextErrorCode,
  MarketContextErrorReason,
} from "./types";

export { MARKET_PROFILES } from "./market-profiles";

export {
  isSupportedMarket,
  isSupportedLocale,
  isSupportedCurrency,
  isSupportedTimeZone,
  getMarketProfile,
  checkMarketProfileRegistry,
} from "./validation";

export {
  resolveStoreMarketContext,
  parseStoreMarketContext,
} from "./store-context";

export { resolveUiLocale } from "./user-preference";
