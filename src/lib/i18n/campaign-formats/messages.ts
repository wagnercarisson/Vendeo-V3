/**
 * F61 — Contrato tipado do catálogo COMPARTILHADO de apresentação dos formatos.
 *
 * Fonte única de nomes, rótulos de estado e explicações para `1:1` e `9:16`.
 * Os namespaces `campaign-list`, `dashboard` e `campaign-detail` referenciam o
 * MESMO objeto por locale (propriedade `formats`), evitando divergência.
 *
 * Sem index signature e sem `any`: o catálogo `es-419` é verificado contra
 * exatamente a mesma estrutura de `pt-BR` (chave faltante quebra o typecheck).
 */

import type { CampaignFormatKey } from "@/lib/campaign/format-presentation";

export interface CampaignFormatNameMessages {
  readonly name: string;
}

export interface CampaignFormatLabelMessages {
  readonly delivered: string;
  readonly processing: string;
  readonly notRequested: string;
  readonly notDelivered: string;
  readonly refunded: string;
  readonly unknown: string;
  readonly unavailable: string;
}

export interface CampaignFormatExplanationMessages {
  readonly delivered: string;
  readonly deliveredActive: string;
  readonly processing: string;
  readonly notRequested: string;
  readonly notDelivered: string;
  readonly refunded: string;
  readonly unknown: string;
  readonly unavailable: string;
}

export interface CampaignFormatPresentationMessages {
  readonly groupLabel: string;
  readonly activeLabel: string;
  /** Nome acessível base; o componente concatena o nome do formato. */
  readonly infoAria: string;
  readonly formats: Readonly<
    Record<CampaignFormatKey, CampaignFormatNameMessages>
  >;
  readonly labels: CampaignFormatLabelMessages;
  readonly explanations: CampaignFormatExplanationMessages;
}
