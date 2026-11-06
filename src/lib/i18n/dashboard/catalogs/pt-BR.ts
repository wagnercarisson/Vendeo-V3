/**
 * Catálogo pt-BR do namespace dashboard — fonte de verdade (F58).
 *
 * Congelado em todos os níveis. Textos fixos apenas; nome da loja, nome de
 * produto, datas e conteúdo editorial nunca entram neste catálogo.
 */

import type { DashboardMessages } from "../messages";

export const ptBRDashboardMessages: DashboardMessages = Object.freeze({
  greeting: Object.freeze({
    morning: "Bom dia",
    afternoon: "Boa tarde",
    evening: "Boa noite",
    neutral: "Olá",
    welcome: "Bem-vindo ao Vendeo",
    nameSeparator: ", ",
  }),
  header: Object.freeze({
    subtitleDesktop:
      "Suas campanhas e informações essenciais em um só lugar.",
    subtitleMobile: "Suas campanhas em um só lugar.",
  }),
  credits: Object.freeze({
    sectionLabel: "Créditos disponíveis",
    unitSingular: "crédito",
    unitPlural: "créditos",
    zero: "0 créditos",
    unavailable: "Saldo indisponível",
    description: "Saldo atual da sua loja",
    detailsLink: "Ver créditos e extrato",
    detailsAria: "Ver créditos e extrato",
  }),
  campaigns: Object.freeze({
    sectionLabel: "Campanhas recentes",
    format: Object.freeze({
      square: "1:1 quadrado",
      vertical: "9:16 vertical",
    }),
    countSingular: "{count} campanha disponível",
    countPlural: "{count} campanhas disponíveis",
    emptyTitle: "Nenhuma campanha disponível",
    emptyBody:
      "Quando uma campanha estiver pronta, ela aparece aqui. Crie uma nova campanha para começar.",
    emptyCta: "Criar campanha",
    viewAll: "Ver todas",
    open: "Abrir campanha",
    failureTitle: "Não foi possível carregar as campanhas",
    failureBody: "Tente novamente em instantes ou abra a lista completa.",
    cardAria: "Abrir campanha {product}, {date}",
    orientation:
      "Abra uma campanha para visualizar o conteúdo completo e baixá-lo para publicar.",
  }),
  shortcut: Object.freeze({
    title: "Que tal criar sua próxima campanha?",
    cta: "Criar campanha",
  }),
  news: Object.freeze({
    sectionLabel: "Novidades",
    view: "Ver novidades",
    close: "Fechar anúncio",
  }),
  banners: Object.freeze({
    review: "Seus créditos de boas-vindas estão em verificação cadastral.",
    approved: "Seus créditos de boas-vindas foram liberados!",
    approvedDismiss: "Fechar",
    readinessTitle: "Sua loja não está pronta para gerar campanhas",
    readinessCadastroFiscal: "CNPJ cadastral",
    readinessBrandProfile: "Direção visual",
    readinessCta: "Configurar agora",
  }),
  loading: Object.freeze({
    statusLabel: "Carregando dashboard",
  }),
  noStore: Object.freeze({
    title: "Sua loja ainda não está configurada",
    body: "Configure os dados da loja para criar sua primeira campanha.",
    cta: "Configurar loja",
  }),
});
