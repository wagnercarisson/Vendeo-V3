/**
 * Catálogo pt-BR do namespace da listagem de campanhas — fonte de verdade.
 *
 * Congelado em todos os níveis. Textos fixos apenas; nome do produto, datas,
 * contagens e conteúdo persistido nunca entram neste catálogo. As strings
 * reproduzem exatamente a listagem anterior à localização.
 */

import type { CampaignListMessages } from "../messages";

export const ptBRCampaignListMessages: CampaignListMessages = Object.freeze({
  title: "Campanhas",
  search: Object.freeze({
    placeholder: "Buscar campanhas...",
    ariaLabel: "Buscar campanhas",
  }),
  filters: Object.freeze({
    periodLabel: "Período",
    sortLabel: "Ordenar por",
    statusAll: "Todas",
    statusReady: "Prontas",
    statusError: "Erro",
    periodAll: "Todas",
    period7d: "7 dias",
    period30d: "30 dias",
    period90d: "90 dias",
    periodYear: "Este ano",
    sortNewest: "Mais recentes",
    sortOldest: "Mais antigas",
    sortNameAsc: "Nome A-Z",
    sortNameDesc: "Nome Z-A",
  }),
  status: Object.freeze({
    ready: "Pronta",
    incomplete: "Não concluída",
    error: "Erro",
  }),
  actions: Object.freeze({
    open: "Abrir",
    download: "Baixar",
  }),
  empty: Object.freeze({
    noCampaignsTitle: "Nenhuma campanha ainda",
    noCampaignsBody:
      "Crie sua primeira campanha e comece a divulgar seus produtos.",
    noCampaignsCta: "Criar campanha",
    searchTitle: "Nenhuma campanha encontrada",
    searchBody: "Tente ajustar sua busca ou limpar os filtros.",
  }),
  noStore: Object.freeze({
    title: "Configure sua loja",
    body: "Suas campanhas aparecerão aqui depois que você configurar sua loja.",
    cta: "Configurar loja",
  }),
  pagination: Object.freeze({
    previous: "<< Anterior",
    next: "Próximo >>",
  }),
});
