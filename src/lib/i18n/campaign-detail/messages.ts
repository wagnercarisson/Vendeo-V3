/**
 * Tipos explícitos do namespace de textos da campanha pronta.
 *
 * Namespace próprio da rota `/campanhas/[id]`, fora do catálogo global do
 * shell. Sem index signature e sem `any`: o catálogo `es-419` é verificado
 * contra exatamente a mesma estrutura de `pt-BR`.
 *
 * Apenas textos fixos de interface entram aqui. Nome do produto, caption,
 * hashtags, CTA, título da copy, datas e arte são conteúdo persistido e nunca
 * passam pelo catálogo.
 */

import type { CampaignFormatPresentationMessages } from "@/lib/i18n/campaign-formats/messages";

export interface CampaignDetailCopyMessages {
  readonly copy: string;
  readonly copied: string;
  readonly ariaPrefix: string;
  readonly targets: {
    readonly caption: string;
    readonly hashtags: string;
    readonly cta: string;
    readonly title: string;
  };
}

export interface CampaignDetailMessages {
  readonly breadcrumbCampaigns: string;
  readonly fallbackTitle: string;
  readonly createdAtLabel: string;
  readonly publicationKit: string;
  readonly editedBadge: string;
  readonly downloadOriginal: string;
  readonly disclaimer: string;
  readonly copy: CampaignDetailCopyMessages;
  /** F61 — catálogo COMPARTILHADO de apresentação dos formatos. */
  readonly formats: CampaignFormatPresentationMessages;
  /** F61 — notas de estado conjunto, em bloco único localizado. */
  readonly jointNotes: CampaignDetailJointNotesMessages;
}

export interface CampaignDetailJointNotesMessages {
  readonly invalidRequest: string;
  readonly partialRefunded: string;
  readonly partialUnconfirmed: string;
  readonly partialProcessing: string;
  readonly finalizationPending: string;
  readonly refunded: string;
  readonly processing: string;
}
