/**
 * Catálogo pt-BR COMPARTILHADO da apresentação dos formatos — fonte de verdade.
 *
 * Congelado em todos os níveis. Textos fixos de formato apenas; nenhum conteúdo
 * persistido, path, miniatura ou dado de campanha entra aqui.
 */

import type { CampaignFormatPresentationMessages } from "../messages";

export const ptBRCampaignFormatMessages: CampaignFormatPresentationMessages =
  Object.freeze({
    groupLabel: "Formatos da campanha",
    activeLabel: "Selecionado",
    infoAria: "Ver explicação do formato",
    formats: Object.freeze({
      "1:1": Object.freeze({ name: "Quadrado 1:1" }),
      "9:16": Object.freeze({ name: "Vertical 9:16" }),
    }),
    labels: Object.freeze({
      delivered: "Disponível",
      processing: "Processando",
      notRequested: "Não incluído",
      notDelivered: "Não entregue",
      refunded: "Crédito devolvido",
      unknown: "Não foi possível confirmar",
      unavailable: "Indisponível",
    }),
    explanations: Object.freeze({
      delivered: "Este formato está disponível nesta campanha.",
      deliveredActive: "Este é o formato exibido agora.",
      processing: "Este formato está sendo processado.",
      notRequested: "Esta campanha foi criada apenas neste formato.",
      notDelivered: "Este formato foi solicitado, mas não foi entregue.",
      refunded:
        "Este formato não está disponível e o crédito foi devolvido.",
      unknown: "Não foi possível confirmar o estado deste formato.",
      unavailable: "As informações deste formato não estão disponíveis.",
    }),
  });
