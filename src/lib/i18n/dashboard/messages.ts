/**
 * Tipos explícitos do namespace de textos do dashboard (F58).
 *
 * Namespace próprio da rota, fora do catálogo global do shell. Sem index
 * signature e sem `any`: o catálogo `es-419` é verificado contra exatamente a
 * mesma estrutura de `pt-BR`. Chave faltante quebra o typecheck.
 */

export interface DashboardGreetingMessages {
  readonly morning: string;
  readonly afternoon: string;
  readonly evening: string;
  readonly neutral: string;
  readonly welcome: string;
  readonly nameSeparator: string;
}

export interface DashboardHeaderMessages {
  readonly subtitleDesktop: string;
  readonly subtitleMobile: string;
}

export interface DashboardCreditsMessages {
  readonly sectionLabel: string;
  readonly unitSingular: string;
  readonly unitPlural: string;
  readonly zero: string;
  readonly unavailable: string;
  readonly description: string;
  readonly detailsLink: string;
  readonly detailsAria: string;
}

export interface DashboardCampaignFormatMessages {
  readonly square: string;
  readonly vertical: string;
}

export interface DashboardCampaignsMessages {
  readonly sectionLabel: string;
  readonly format: DashboardCampaignFormatMessages;
  readonly countSingular: string;
  readonly countPlural: string;
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly emptyCta: string;
  readonly viewAll: string;
  readonly open: string;
  readonly failureTitle: string;
  readonly failureBody: string;
  readonly cardAria: string;
  readonly orientation: string;
}

export interface DashboardShortcutMessages {
  readonly title: string;
  readonly cta: string;
}

export interface DashboardNewsMessages {
  readonly sectionLabel: string;
  readonly view: string;
  readonly close: string;
}

export interface DashboardBannersMessages {
  readonly review: string;
  readonly approved: string;
  readonly approvedDismiss: string;
  readonly readinessTitle: string;
  readonly readinessCadastroFiscal: string;
  readonly readinessBrandProfile: string;
  readonly readinessCta: string;
}

export interface DashboardLoadingMessages {
  readonly statusLabel: string;
}

export interface DashboardNoStoreMessages {
  readonly title: string;
  readonly body: string;
  readonly cta: string;
}

export interface DashboardMessages {
  readonly greeting: DashboardGreetingMessages;
  readonly header: DashboardHeaderMessages;
  readonly credits: DashboardCreditsMessages;
  readonly campaigns: DashboardCampaignsMessages;
  readonly shortcut: DashboardShortcutMessages;
  readonly news: DashboardNewsMessages;
  readonly banners: DashboardBannersMessages;
  readonly loading: DashboardLoadingMessages;
  readonly noStore: DashboardNoStoreMessages;
}
