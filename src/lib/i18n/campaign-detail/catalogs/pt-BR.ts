/**
 * Catálogo pt-BR do namespace da campanha pronta — fonte de verdade.
 *
 * Congelado em todos os níveis. As strings reproduzem exatamente os textos
 * fixos anteriores à localização; conteúdo persistido não entra aqui.
 */

import type { CampaignDetailMessages } from "../messages";
import { ptBRCampaignFormatMessages } from "@/lib/i18n/campaign-formats/catalogs/pt-BR";

export const ptBRCampaignDetailMessages: CampaignDetailMessages = Object.freeze({
  breadcrumbCampaigns: "Campanhas",
  fallbackTitle: "Campanha",
  createdAtLabel: "Criada em",
  publicationKit: "Kit de Publicação",
  editedBadge: "Editado",
  downloadOriginal: "Baixar Original",
  disclaimer:
    "Use apenas materiais que você tem autorização para divulgar. Revise textos, preços e imagens antes de publicar: a IA pode cometer erros.",
  copy: Object.freeze({
    copy: "Copiar",
    copied: "Copiado!",
    ariaPrefix: "Copiar",
    targets: Object.freeze({
      caption: "caption",
      hashtags: "hashtags",
      cta: "Chamada",
      title: "título",
    }),
  }),
  formats: ptBRCampaignFormatMessages,
  jointNotes: Object.freeze({
    invalidRequest:
      "Formato solicitado inválido. Escolha um dos formatos entregues.",
    partialRefunded: "Entrega parcial: um formato foi estornado.",
    partialUnconfirmed:
      "Entrega parcial: o outro formato ainda não foi confirmado.",
    partialProcessing:
      "Entrega parcial: o outro formato está em processamento.",
    finalizationPending:
      "Finalização pendente: um formato foi estornado e o outro ainda está em processamento.",
    refunded: "Operação estornada.",
    processing: "Processando formatos...",
  }),
});
