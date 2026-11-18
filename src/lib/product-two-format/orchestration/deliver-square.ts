import "server-only";

import type { CreditOperationErrorCode } from "@/lib/product-1-1/credit-operation/types";

import type {
  TwoFormatDeliverInput,
  TwoFormatDeliverReason,
  TwoFormatDeliverResult,
  TwoFormatDeliveryErrorCode,
} from "../joint-financial-client";
import type { JointSquareProbeResult } from "./square-probe";

/**
 * F60.7 Subfatia B — publicação do 1:1 conjunto.
 *
 * Ordem vinculante: artefato canônico persistido e verificado → token na
 * identidade FINANCEIRA do quadrado → RPC de entrega por formato (confirmação
 * + projeção na mesma transação) → miniatura best-effort.
 *
 * O cliente/infra são injetados; este módulo não faz upload, não copia bytes,
 * não cria segunda arte, não projeta no app e não estorna.
 *
 * Abort restrito: apenas falhas COMPROVADAMENTE sem confirmação, com token já
 * adquirido. `invalid_envelope`, `unknown`, transporte ou resposta ambígua
 * preservam o fence para reconciliação. `before_upload` é o nome legado da
 * transição financeira: NÃO remove o artefato interno já persistido.
 */

export interface JointSquareDeliveryInput {
  readonly storeId: string;
  readonly campaignId: string;
  /** Identidade de CONTROLE, usada pela sonda e pelo caminho do artefato. */
  readonly operationId: string;
  /** Identidade FINANCEIRA do quadrado, usada no token e na RPC. */
  readonly deliveryOperationId: string;
}

export interface JointSquareDeliveryDeps {
  readonly probeSquareOriginal: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<JointSquareProbeResult>;
  readonly beginPublication: (
    campaignId: string,
    operationId: string,
  ) => Promise<{ acquired: boolean; token: string | null; publicationState: string }>;
  readonly abortPublication: (
    campaignId: string,
    operationId: string,
    publicationToken: string,
    phase: "before_upload",
  ) => Promise<{ success: boolean; reason?: string }>;
  readonly deliverFormat: (
    input: TwoFormatDeliverInput,
  ) => Promise<TwoFormatDeliverResult>;
  readonly generateThumbnail: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
    role: "square_original" | "vertical";
    storagePath: string;
  }) => Promise<unknown>;
  readonly clock?: () => number;
}

export type JointSquareDeliveryOutcome =
  | {
      readonly kind: "delivered";
      readonly idempotent: boolean;
      readonly campaignStatus: string;
      readonly storagePath: string | null;
    }
  | { readonly kind: "publication_pending" }
  | { readonly kind: "artifact_absent" }
  | { readonly kind: "artifact_incompatible"; readonly reason: string }
  | { readonly kind: "indeterminate" }
  | {
      readonly kind: "terminal_conflict";
      readonly code: "operation_terminal" | "invalid_transition";
      readonly reason: string;
    }
  | {
      readonly kind: "failed";
      readonly code: TwoFormatDeliveryErrorCode | CreditOperationErrorCode;
    };

const ABORTABLE_DELIVERY_REASONS: ReadonlySet<TwoFormatDeliverReason> =
  new Set<TwoFormatDeliverReason>([
    "missing_publication_token",
    "artifact_incompatible",
    "delivery_link_missing",
    "credit_operation_missing",
    "invalid_transition",
  ]);

function twoFormatErrorCode(
  error: unknown,
): TwoFormatDeliveryErrorCode | null {
  if (!(error instanceof Error) || error.name !== "TwoFormatDeliveryError") {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? (code as TwoFormatDeliveryErrorCode) : null;
}

function creditErrorCode(error: unknown): CreditOperationErrorCode | null {
  if (!(error instanceof Error) || error.name !== "CreditOperationError") {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? (code as CreditOperationErrorCode) : null;
}

/**
 * Publica o quadrado já persistido. Não faz upload nem duplica a imagem.
 */
export async function deliverJointSquare(
  input: JointSquareDeliveryInput,
  deps: JointSquareDeliveryDeps,
): Promise<JointSquareDeliveryOutcome> {
  const probe = await deps.probeSquareOriginal({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });

  if (probe.kind === "absent") return { kind: "artifact_absent" };
  if (probe.kind === "indeterminate") return { kind: "indeterminate" };
  if (probe.kind === "invalid") {
    return { kind: "artifact_incompatible", reason: probe.reason };
  }

  let publication: {
    acquired: boolean;
    token: string | null;
    publicationState: string;
  };
  try {
    publication = await deps.beginPublication(
      input.campaignId,
      input.deliveryOperationId,
    );
  } catch (error) {
    const creditCode = creditErrorCode(error);
    if (creditCode === "operation_terminal") {
      return {
        kind: "terminal_conflict",
        code: "operation_terminal",
        reason: creditCode,
      };
    }
    if (creditCode !== null) return { kind: "failed", code: creditCode };
    const code = twoFormatErrorCode(error);
    return { kind: "failed", code: code ?? "unknown" };
  }

  if (!publication.acquired || publication.token === null) {
    return { kind: "publication_pending" };
  }
  const token = publication.token;

  let delivered: TwoFormatDeliverResult;
  try {
    delivered = await deps.deliverFormat({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      format: "1:1",
      publicationToken: token,
    });
  } catch (error) {
    // Resposta não interpretável/ambígua NÃO aborta: preserva o fence.
    const code = twoFormatErrorCode(error);
    return { kind: "failed", code: code ?? "unknown" };
  }

  if (!delivered.success) {
    const reason = delivered.reason;
    if (ABORTABLE_DELIVERY_REASONS.has(reason)) {
      try {
        await deps.abortPublication(
          input.campaignId,
          input.deliveryOperationId,
          token,
          "before_upload",
        );
      } catch {
        // Best-effort: o fence continua sendo a autoridade.
      }
    }

    if (reason === "missing_publication_token") {
      return { kind: "publication_pending" };
    }
    if (reason === "artifact_incompatible") {
      return { kind: "artifact_incompatible", reason };
    }
    if (reason === "invalid_transition") {
      return { kind: "terminal_conflict", code: "invalid_transition", reason };
    }
    return { kind: "failed", code: reason };
  }

  if (delivered.storagePath !== null) {
    try {
      await deps.generateThumbnail({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        role: "square_original",
        storagePath: delivered.storagePath,
      });
    } catch {
      // Best-effort: falha de miniatura não desfaz a entrega.
    }
  }

  return {
    kind: "delivered",
    idempotent: delivered.idempotent,
    campaignStatus: delivered.campaignStatus,
    storagePath: delivered.storagePath,
  };
}
