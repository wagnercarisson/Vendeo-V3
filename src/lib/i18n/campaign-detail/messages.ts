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
  /** F62 — textos da adição posterior do formato vertical. */
  readonly formatAddition: CampaignDetailFormatAdditionMessages;
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

export interface CampaignDetailFormatAdditionIncompatibleMessages {
  readonly unsupportedDimensions: string;
  readonly unsupportedMime: string;
  readonly artifactInvalid: string;
  readonly pathNotCanonical: string;
  readonly formatNotSquare: string;
  readonly campaignNotReady: string;
  readonly sourceOriginInvalid: string;
}

export interface CampaignDetailFormatAdditionReadUnavailableMessages {
  readonly artifactAbsent: string;
  readonly artifactIndeterminate: string;
  readonly readFailed: string;
  readonly identityConflict: string;
}

export interface CampaignDetailFormatAdditionMessages {
  readonly title: string;
  readonly description: string;
  readonly action: string;
  readonly cost: string;
  readonly confirm: string;
  readonly cancel: string;
  readonly processing: string;
  readonly tracking: string;
  readonly retry: string;
  readonly delivered: string;
  readonly refunded: string;
  readonly unknown: string;
  readonly failed: string;
  readonly unavailable: string;
  readonly selection: string;
  readonly incompatible: CampaignDetailFormatAdditionIncompatibleMessages;
  readonly readUnavailable: CampaignDetailFormatAdditionReadUnavailableMessages;
}
