/**
 * Contratos da fundação multimercado (v1).
 *
 * Este módulo é puro: zero I/O, zero ambiente, zero dependência externa.
 * Nenhuma destas dimensões é autorização de acesso.
 */

/** Mercados com perfil de referência nesta versão. */
export const SUPPORTED_MARKETS = Object.freeze(["BR", "PY"] as const);
export type SupportedMarket = (typeof SUPPORTED_MARKETS)[number];

/** Idiomas de conteúdo/aplicativo suportados. */
export const SUPPORTED_CONTENT_LOCALES = Object.freeze(["pt-BR", "es-PY"] as const);
export type SupportedContentLocale = (typeof SUPPORTED_CONTENT_LOCALES)[number];

/** Moedas anunciadas suportadas. */
export const SUPPORTED_CURRENCIES = Object.freeze(["BRL", "PYG"] as const);
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Fusos suportados (derivados do país cadastral). */
export const SUPPORTED_TIME_ZONES = Object.freeze([
  "America/Sao_Paulo",
  "America/Asuncion",
] as const);
export type SupportedTimeZone = (typeof SUPPORTED_TIME_ZONES)[number];

export const STORE_CONTEXT_VERSION = 1;
export type StoreContextVersion = typeof STORE_CONTEXT_VERSION;

export const CAMPAIGN_CONTEXT_VERSION = 1;
export type CampaignContextVersion = typeof CAMPAIGN_CONTEXT_VERSION;

export const MARKET_PROFILE_VERSION = 1;
export type MarketProfileVersion = typeof MARKET_PROFILE_VERSION;

/**
 * Dado de referência. A existência de um perfil NÃO habilita cadastro,
 * geração, cobrança ou operação naquele mercado.
 */
export interface MarketProfile {
  readonly market: SupportedMarket;
  readonly profileVersion: MarketProfileVersion;
  readonly defaultContentLocale: SupportedContentLocale;
  readonly defaultCurrency: SupportedCurrency;
  readonly defaultTimeZone: SupportedTimeZone;
}

export type MarketProfileRegistry = Readonly<Record<SupportedMarket, MarketProfile>>;

/**
 * Entrada de configuração da loja. Pode ser parcial: preferências omitidas
 * recebem padrões do resolvedor. `country` é identidade, não preferência.
 * `legacy` é declaração EXPLÍCITA do chamador — nunca inferida.
 */
export type StoreMarketConfigInput =
  | { readonly kind: "legacy" }
  | {
      readonly kind: "configured";
      readonly country: unknown;
      readonly defaultCampaignMarket?: unknown;
      readonly defaultContentLocale?: unknown;
      readonly defaultCurrency?: unknown;
      readonly timeZone?: unknown;
    };

/**
 * Valor resolvido/versionado da loja. Todos os campos são obrigatórios;
 * leitura persistida usa `parseStoreMarketContext` sem defaults.
 */
export interface StoreMarketContext {
  readonly contextVersion: StoreContextVersion;
  readonly country: SupportedMarket;
  readonly defaultCampaignMarket: SupportedMarket;
  readonly defaultContentLocale: SupportedContentLocale;
  readonly defaultCurrency: SupportedCurrency;
  readonly timeZone: SupportedTimeZone;
}

export type StoreMarketProvenance = "configured" | "legacy_br";

export type StoreFieldSource = "configured" | "default" | "legacy_br";

export interface StoreMarketSources {
  readonly country: StoreFieldSource;
  readonly defaultCampaignMarket: StoreFieldSource;
  readonly defaultContentLocale: StoreFieldSource;
  readonly defaultCurrency: StoreFieldSource;
  readonly timeZone: StoreFieldSource;
}

export interface StoreMarketContextSuccess {
  readonly ok: true;
  readonly context: StoreMarketContext;
  readonly provenance: StoreMarketProvenance;
  readonly sources: StoreMarketSources;
}

export interface StoreMarketContextFailure {
  readonly ok: false;
  readonly error: MarketContextError;
}

export type StoreMarketContextResult =
  | StoreMarketContextSuccess
  | StoreMarketContextFailure;

export type StoreMarketContextParseResult =
  | { readonly ok: true; readonly context: StoreMarketContext }
  | { readonly ok: false; readonly error: MarketContextError };

/** Preferência de idioma do aplicativo. Nunca recebe loja, país ou mercado. */
export type UserLocalePreference =
  | { readonly kind: "explicit"; readonly uiLocale: SupportedContentLocale }
  | { readonly kind: "legacy" };

export type UiLocaleProvenance = "explicit" | "legacy_br";

export type UserLocaleResolution =
  | {
      readonly ok: true;
      readonly uiLocale: SupportedContentLocale;
      readonly provenance: UiLocaleProvenance;
    }
  | { readonly ok: false; readonly error: MarketContextError };

/**
 * Valor versionado do contexto de uma campanha. Autocontido e congelado;
 * alterar preferências da loja depois não muda este valor.
 */
export interface CampaignMarketContext {
  readonly contextVersion: CampaignContextVersion;
  readonly market: SupportedMarket;
  readonly contentLocale: SupportedContentLocale;
  readonly currency: SupportedCurrency;
}

export type CampaignFieldSource =
  | "campaign_override"
  | "store_default"
  | "market_profile_default"
  | "legacy_br";

export interface CampaignMarketSources {
  readonly market: CampaignFieldSource;
  readonly contentLocale: CampaignFieldSource;
  readonly currency: CampaignFieldSource;
}

export interface CampaignMarketOverrides {
  readonly market?: unknown;
  readonly contentLocale?: unknown;
  readonly currency?: unknown;
}

export interface CampaignMarketConfig {
  readonly store: StoreMarketContext;
  /**
   * Declaração explícita de que a loja veio de contexto legado. Necessária
   * porque o valor versionado não carrega proveniência.
   */
  readonly storeIsLegacy?: boolean;
  readonly overrides?: CampaignMarketOverrides;
}

export type CampaignMarketResolution =
  | {
      readonly ok: true;
      readonly context: CampaignMarketContext;
      readonly sources: CampaignMarketSources;
    }
  | { readonly ok: false; readonly error: MarketContextError };

export type CampaignMarketContextReadResult =
  | { readonly kind: "present"; readonly context: CampaignMarketContext }
  | { readonly kind: "invalid"; readonly error: MarketContextError }
  | { readonly kind: "missing_legacy" };

export type MarketContextErrorCode =
  | "unsupported_market"
  | "unsupported_locale"
  | "unsupported_currency"
  | "unsupported_time_zone"
  | "unsupported_context_version"
  | "missing_country"
  | "invalid_input"
  | "invalid_profile_registry";

export type MarketContextErrorReason =
  | "not_an_object"
  | "incomplete"
  | "unsupported_version"
  | "invalid_field";

/** Erro tipado. Entrada de usuário nunca lança — retorna este objeto. */
export interface MarketContextError {
  readonly code: MarketContextErrorCode;
  readonly field?: string;
  readonly received?: unknown;
  readonly reason?: MarketContextErrorReason;
}
