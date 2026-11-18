/**
 * F60.7 — Contratos PUROS da entrega conjunta 1:1 + 9:16.
 *
 * Este módulo não tem I/O: nenhum runtime de servidor, cliente de banco,
 * framework de UI, processamento de imagem ou acesso a arquivos. Ele apenas
 * descreve o contrato conjunto de formato, origem, identidades de entrega e o
 * union de estados do modelo de leitura.
 *
 * Fronteira da Subfatia A: o contrato conjunto vive em módulo DEDICADO que
 * delega todo snapshot não conjunto aos resolvedores existentes
 * (`resolveCampaignFormat` / `resolveCampaignGenerationOrigin`). O union de
 * resolução compartilhado e o schema de produção permanecem intocados nesta
 * subfatia; a integração é da Subfatia C.
 */

/** Formato conjunto exato aceito pelo fluxo novo. */
export const TWO_FORMAT_CAMPAIGN_FORMAT = "1:1+9:16" as const;

/** Versão congelada do contrato de formato conjunto. */
export const TWO_FORMAT_CONTRACT_VERSION = "f60.7-two-format-v1" as const;

/** Origem de geração das campanhas conjuntas (distinta de `9_16_two_stage`). */
export const TWO_FORMAT_GENERATION_ORIGIN = "two_format_two_stage" as const;

/**
 * Versão congelada do contrato de origem conjunta.
 *
 * Constante própria e tipada, distinta de `TWO_FORMAT_CONTRACT_VERSION` embora
 * compartilhe o literal do design D2.
 */
export const TWO_FORMAT_GENERATION_CONTRACT_VERSION =
  "f60.7-two-format-v1" as const;

/**
 * Créditos por entrega de formato. Cada entrega usa uma linha de crédito com
 * `amount = 1`; não existe `amount = 2`.
 */
export const TWO_FORMAT_CREDITS_PER_DELIVERY = 1 as const;

/**
 * Entregas por requisição conjunta: a soma de duas entregas de 1 crédito.
 * O total nunca é representado como uma única linha financeira.
 */
export const TWO_FORMAT_DELIVERIES_PER_REQUEST = 2 as const;

/** Formatos que a requisição conjunta entrega. */
export type TwoFormatFormat = "1:1" | "9:16";

/** Papéis de artefato entregáveis. `square_prepared` NUNCA é entrega. */
export type TwoFormatArtifactRole = "square_original" | "vertical";

/** Conjunto congelado dos formatos do contrato conjunto. */
export const TWO_FORMAT_FORMATS = Object.freeze([
  "1:1",
  "9:16",
] as const satisfies readonly TwoFormatFormat[]);

/**
 * Estados do modelo de leitura por formato. `unknown` nunca é convertido em
 * `absent` — indeterminação não autoriza estorno presumido.
 */
export type TwoFormatDeliveryState =
  | "delivered"
  | "processing"
  | "absent"
  | "unknown"
  | "unavailable";

/**
 * Vínculo explícito entrega ↔ formato ↔ operação financeira.
 *
 * `operationId` é a identidade de controle (e a identidade financeira do
 * vertical); `deliveryOperationId` é a identidade financeira própria da
 * entrega daquele formato.
 */
export interface TwoFormatDeliveryLink {
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  readonly format: TwoFormatFormat;
  readonly deliveryOperationId: string;
  readonly artifactRole: TwoFormatArtifactRole;
  readonly createdAt: string;
}
