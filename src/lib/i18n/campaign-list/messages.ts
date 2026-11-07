/**
 * Tipos explícitos do namespace de textos da listagem de campanhas.
 *
 * Namespace próprio da rota `/campanhas`, fora do catálogo global do shell.
 * Sem index signature e sem `any`: o catálogo `es-419` é verificado contra
 * exatamente a mesma estrutura de `pt-BR`. Chave faltante quebra o typecheck.
 */

export interface CampaignListSearchMessages {
  readonly placeholder: string;
  readonly ariaLabel: string;
}

export interface CampaignListFilterMessages {
  readonly periodLabel: string;
  readonly sortLabel: string;
  readonly statusAll: string;
  readonly statusReady: string;
  readonly statusError: string;
  readonly periodAll: string;
  readonly period7d: string;
  readonly period30d: string;
  readonly period90d: string;
  readonly periodYear: string;
  readonly sortNewest: string;
  readonly sortOldest: string;
  readonly sortNameAsc: string;
  readonly sortNameDesc: string;
}

export interface CampaignListStatusMessages {
  readonly ready: string;
  readonly incomplete: string;
  readonly error: string;
}

export interface CampaignListFormatMessages {
  readonly square: string;
  readonly vertical: string;
}

export interface CampaignListActionMessages {
  readonly open: string;
  readonly download: string;
}

export interface CampaignListEmptyMessages {
  readonly noCampaignsTitle: string;
  readonly noCampaignsBody: string;
  readonly noCampaignsCta: string;
  readonly searchTitle: string;
  readonly searchBody: string;
}

export interface CampaignListNoStoreMessages {
  readonly title: string;
  readonly body: string;
  readonly cta: string;
}

export interface CampaignListPaginationMessages {
  readonly previous: string;
  readonly next: string;
}

export interface CampaignListMessages {
  readonly title: string;
  readonly search: CampaignListSearchMessages;
  readonly filters: CampaignListFilterMessages;
  readonly status: CampaignListStatusMessages;
  readonly format: CampaignListFormatMessages;
  readonly actions: CampaignListActionMessages;
  readonly empty: CampaignListEmptyMessages;
  readonly noStore: CampaignListNoStoreMessages;
  readonly pagination: CampaignListPaginationMessages;
}
