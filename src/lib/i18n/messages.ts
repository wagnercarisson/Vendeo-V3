/**
 * Tipos explícitos dos catálogos de interface (F57.4).
 *
 * Sem index signature e sem `any`: o catálogo `es-419` é verificado contra
 * exatamente a mesma estrutura de `pt-BR`. Chave faltante quebra o typecheck.
 */

export interface CommonMessages {
  readonly save: string;
  readonly retry: string;
  readonly loading: string;
}

export interface ShellNavMessages {
  readonly dashboard: string;
  readonly campaigns: string;
  readonly store: string;
  readonly account: string;
  readonly news: string;
  readonly ariaLabel: string;
}

export interface ShellDrawerMessages {
  readonly close: string;
  readonly dialogLabel: string;
}

export interface ShellTopbarMessages {
  readonly openMenu: string;
  readonly newCampaign: string;
  readonly newCampaignAria: string;
}

export interface ShellAccountMessages {
  readonly trigger: string;
  readonly fallbackUser: string;
  readonly settings: string;
  readonly logout: string;
}

export interface ShellBadgeMessages {
  readonly available: string;
  readonly view: string;
}

export interface ShellNotificationsMessages {
  readonly label: string;
  readonly unread: string;
}

export interface ShellMessages {
  readonly nav: ShellNavMessages;
  readonly drawer: ShellDrawerMessages;
  readonly topbar: ShellTopbarMessages;
  readonly account: ShellAccountMessages;
  readonly badge: ShellBadgeMessages;
  readonly notifications: ShellNotificationsMessages;
}

export interface SettingsErrorMessages {
  readonly load: string;
  readonly validation: string;
  readonly session: string;
  readonly forbidden: string;
  readonly conflict: string;
  readonly unavailable: string;
  readonly connection: string;
}

export interface SettingsMessages {
  readonly title: string;
  readonly breadcrumbDashboard: string;
  readonly languageSection: string;
  readonly optionPtBr: string;
  readonly optionEs419: string;
  readonly saved: string;
  readonly saving: string;
  readonly reload: string;
  readonly login: string;
  readonly error: SettingsErrorMessages;
}

export interface Messages {
  readonly common: CommonMessages;
  readonly shell: ShellMessages;
  readonly settings: SettingsMessages;
}
