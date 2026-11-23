/**
 * F62 — Contratos PUROS da adição do formato `9:16` a uma campanha `1:1`
 * já entregue.
 *
 * Este módulo descreve estados, motivos, entradas seguras e o resultado da
 * derivação de elegibilidade. Ele NÃO lê banco/Storage, NÃO decodifica imagem,
 * NÃO conhece `sharp`, Supabase ou provider e NÃO recebe snapshot, path,
 * credencial, URL ou bytes.
 *
 * A entrada carrega apenas dados já validados/classificados pela autoridade
 * server-side: origem, status, dimensão, MIME, integridade, checksum, path
 * canônico e o estado durável da adição.
 */

import type { CampaignFormatResolution } from "@/lib/campaign/format-resolution";

/** Origens aceitas para a fonte entregue. A idade nunca é critério. */
export type FormatAdditionSourceOrigin = "new_flow_1_1" | "legacy_campaign";

/** Custo fixo da adição, em créditos. Não é configurável por esta camada. */
export const FORMAT_ADDITION_CREDITS = 1 as const;

export type FormatAdditionCredits = typeof FORMAT_ADDITION_CREDITS;

/** Estados possíveis de uma consulta de adição para a superfície. */
export type FormatAdditionState =
  | "eligible"
  | "incompatible"
  | "unavailable"
  | "delivered"
  | "processing"
  | "unknown"
  | "absent";

/** Incompatibilidade comprovada da fonte/contrato (definitiva). */
export type FormatAdditionIncompatibleReason =
  | "unsupported_dimensions"
  | "unsupported_mime"
  | "artifact_invalid"
  | "path_not_canonical"
  | "format_not_square"
  | "campaign_not_ready"
  | "source_origin_invalid";

/** Indisponibilidade de leitura/identidade (NUNCA vira incompatibilidade). */
export type FormatAdditionUnavailableReason =
  | "artifact_absent"
  | "artifact_indeterminate"
  | "read_failed"
  | "identity_conflict";

export type FormatAdditionReason =
  | FormatAdditionIncompatibleReason
  | FormatAdditionUnavailableReason;

/** Resultado da verificação de checksum já feita no servidor. */
export type FormatAdditionChecksumStatus = "verified" | "divergent";

/**
 * Leitura segura da fonte entregue. Nenhum campo carrega storage path, URL,
 * snapshot ou bytes — apenas o resultado classificado pela autoridade.
 */
export type FormatAdditionSourceRead =
  | {
      readonly kind: "loaded";
      /** Origem declarada; valor fora das origens suportadas é recusado. */
      readonly origin: string;
      readonly width: number;
      readonly height: number;
      readonly mimeType: string;
      /** `invalid` cobre bytes truncados/ilegíveis ou decode inválido. */
      readonly integrity: "valid" | "invalid";
      readonly checksum: FormatAdditionChecksumStatus;
      readonly pathCanonical: boolean;
    }
  | { readonly kind: "absent" }
  | { readonly kind: "indeterminate" }
  | { readonly kind: "read_failed" }
  | { readonly kind: "identity_conflict" };

/**
 * Estado durável do vínculo da adição por campanha. `none` significa que nunca
 * houve adição; `read_failed` significa que a leitura não permitiu decidir.
 */
export type FormatAdditionDurableRead =
  | { readonly kind: "none" }
  | { readonly kind: "delivered" }
  | { readonly kind: "processing" }
  | { readonly kind: "unknown" }
  | { readonly kind: "refunded" }
  | { readonly kind: "read_failed" };

export interface FormatAdditionEligibilityInput {
  /** Status persistido da campanha (`ready` é o único aceito). */
  readonly campaignStatus: string;
  /** Resolução pura e já existente do contrato de formato da campanha. */
  readonly formatResolution: CampaignFormatResolution;
  /** Estado durável da adição; tem precedência sobre a fonte. */
  readonly addition: FormatAdditionDurableRead;
  /** Resultado seguro da leitura/validação da fonte entregue. */
  readonly source: FormatAdditionSourceRead;
}

/**
 * Resultado TOTAL e discriminado. Nunca lança e nunca transforma falha de
 * leitura em incompatibilidade definitiva.
 */
export type FormatAdditionEligibility =
  | {
      readonly kind: "eligible";
      readonly sourceOrigin: FormatAdditionSourceOrigin;
      readonly credits: FormatAdditionCredits;
    }
  | {
      readonly kind: "incompatible";
      readonly reason: FormatAdditionIncompatibleReason;
    }
  | {
      readonly kind: "unavailable";
      readonly reason: FormatAdditionUnavailableReason;
    }
  | { readonly kind: "delivered"; readonly state: "delivered" }
  | {
      readonly kind: "processing";
      readonly state: "processing" | "unknown";
    }
  | {
      readonly kind: "absent";
      readonly state: "absent";
      readonly refunded: boolean;
    };
