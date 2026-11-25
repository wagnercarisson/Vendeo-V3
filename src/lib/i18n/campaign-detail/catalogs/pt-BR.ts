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
  formatAddition: Object.freeze({
    title: "Adicionar formato vertical",
    description:
      "Você pode gerar o formato vertical 9:16 para essa campanha.",
    checkingAvailability: "Verificando disponibilidade…",
    action: "Adicionar vertical 9:16",
    availableForGeneration: "Disponível para gerar",
    generateGuidance:
      "Clique para gerar o formato vertical. Custo: 1 crédito.",
    cost: "Custo: 1 crédito",
    confirm: "Confirmar adição",
    cancel: "Cancelar",
    processing: "Estamos gerando a campanha no formato vertical.",
    tracking: "Você pode acompanhar o andamento nesta página.",
    retry: "Tentar novamente",
    continue: "Continuar acompanhamento",
    delivered: "Formato vertical pronto.",
    refunded: "A adição foi desfeita e o crédito foi devolvido.",
    unknown:
      "Não foi possível confirmar o resultado agora. Consulte novamente em instantes.",
    failed:
      "Não foi possível criar o formato vertical. O crédito foi devolvido.",
    unavailable: "A adição está indisponível no momento. Tente mais tarde.",
    conflict: Object.freeze({
      operationExists:
        "Já existe uma adição para esta campanha. Atualize a página para acompanhar.",
      retryNotAllowed: "Esta adição não permite nova tentativa.",
      sourceChanged: "A arte original mudou. Feche e abra a modal novamente.",
      sourceNotEligible:
        "A arte original não é compatível com o formato vertical.",
      confirmationExpired:
        "A confirmação expirou. Feche e abra a modal novamente para gerar uma nova confirmação.",
      invalidConfirmation:
        "A confirmação não é mais válida. Feche e abra a modal novamente.",
      confirmationFailed:
        "Não foi possível confirmar a adição agora. Tente novamente.",
      insufficientCredits:
        "Saldo insuficiente para gerar o formato vertical.",
      rateLimitExceeded:
        "Limite de gerações atingido. Tente novamente mais tarde.",
      authorizationUnavailable:
        "Não foi possível validar a autorização agora. Tente novamente.",
      legalBlocked:
        "A geração está bloqueada por uma pendência legal.",
      storeNotReady:
        "A loja precisa concluir o cadastro para gerar o formato vertical.",
      engineDisabled: "O motor de geração está indisponível.",
    }),
    selection: "Escolha acima o formato que deseja ver.",
    incompatible: Object.freeze({
      unsupportedDimensions:
        "A arte original não tem o tamanho necessário para o formato vertical.",
      unsupportedMime:
        "O arquivo original não está em um formato de imagem compatível.",
      artifactInvalid: "Não foi possível validar a arte original.",
      pathNotCanonical: "A arte original não corresponde a esta campanha.",
      formatNotSquare:
        "Esta campanha não está disponível para receber o formato vertical.",
      campaignNotReady:
        "A campanha precisa estar pronta para receber o formato vertical.",
      sourceOriginInvalid:
        "A origem desta campanha não é compatível com o formato vertical.",
    }),
    readUnavailable: Object.freeze({
      artifactAbsent: "A arte original não foi encontrada.",
      artifactIndeterminate: "Não foi possível verificar a arte original.",
      readFailed: "Não foi possível consultar a adição agora.",
      identityConflict: "Os dados da campanha não conferem.",
    }),
  }),
  squareRelease: Object.freeze({
    title: "Gerar formato quadrado",
    description:
      "Você pode gerar o formato quadrado 1:1 para esta campanha.",
    checking: "Verificando disponibilidade…",
    cost: "Custo: 1 crédito",
    confirm: "Gerar formato quadrado",
    cancel: "Cancelar",
    processing: "Estamos preparando sua campanha no formato quadrado.",
    delivered: "Formato quadrado pronto.",
    refunded: "A compra do formato quadrado foi desfeita e o crédito foi devolvido.",
    unknown:
      "Não foi possível confirmar a geração agora. Consulte novamente em instantes.",
    unavailable: "O formato quadrado não está disponível para geração.",
    incompatible: "Esta campanha não permite gerar o formato quadrado.",
    insufficientCredits: "Saldo insuficiente para gerar o formato quadrado.",
    retry: "Tentar novamente",
    available: "Disponível para gerar",
    actionHelp:
      "Clique para gerar o formato quadrado. Custo: 1 crédito.",
  }),
});
