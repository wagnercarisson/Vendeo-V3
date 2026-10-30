/**
 * Catálogo pt-BR — fonte de verdade dos textos fixos da interface (F57.4).
 *
 * Congelado em todos os níveis para impedir mutação em runtime. Textos aqui
 * são apenas strings de interface; conteúdo dinâmico (loja, e-mail, campanha,
 * changelog, notificações) nunca entra no catálogo.
 */

import type { Messages } from "../messages";

export const ptBRMessages: Messages = Object.freeze({
  common: Object.freeze({
    save: "Salvar",
    retry: "Tentar novamente",
    loading: "Carregando...",
  }),
  shell: Object.freeze({
    nav: Object.freeze({
      dashboard: "Dashboard",
      campaigns: "Campanhas",
      store: "Loja",
      account: "Conta",
      news: "Novidades",
      ariaLabel: "Navegação principal",
    }),
    drawer: Object.freeze({
      close: "Fechar menu",
      dialogLabel: "Menu de navegação",
    }),
    topbar: Object.freeze({
      openMenu: "Abrir menu de navegação",
      newCampaign: "Nova Campanha",
      newCampaignAria: "Criar nova campanha",
    }),
    account: Object.freeze({
      trigger: "Menu da conta",
      fallbackUser: "Usuário",
      settings: "Configurações",
      logout: "Sair",
    }),
    badge: Object.freeze({
      available: "Novidades disponíveis",
      view: "Ver novidades",
    }),
    notifications: Object.freeze({
      label: "Notificações",
      unread: "Notificações não lidas: {count}",
    }),
  }),
  settings: Object.freeze({
    title: "Configurações",
    breadcrumbDashboard: "Dashboard",
    languageSection: "Idioma do aplicativo",
    optionPtBr: "Português (Brasil)",
    optionEs419: "Español (Latinoamérica)",
    saved: "Idioma atualizado.",
    saving: "Salvando...",
    reload: "Recarregar",
    login: "Entrar",
    error: Object.freeze({
      load: "Não foi possível carregar suas preferências.",
      validation: "Não foi possível validar a seleção.",
      session: "Sua sessão expirou. Entre novamente.",
      forbidden:
        "Não foi possível confirmar a origem da solicitação. Recarregue a página.",
      conflict: "O idioma foi alterado em outra sessão.",
      unavailable: "O serviço está indisponível. Tente novamente.",
      connection: "Falha de conexão. Verifique sua rede e tente novamente.",
    }),
  }),
});
