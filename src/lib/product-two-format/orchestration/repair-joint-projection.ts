import "server-only";

import type { TwoFormatReadResult } from "@/lib/product-two-format/delivery-reader";
import type {
  TwoFormatDeliveryErrorCode,
  TwoFormatProjectResult,
} from "@/lib/product-two-format/joint-financial-client";
import type { TwoFormatFormat } from "@/lib/product-two-format/types";

/**
 * F60.7-07 — reparo idempotente de projeção e miniatura (server-only).
 *
 * A projeção é a RPC conjunta (`projectCampaign`): idempotente e SEM efeito
 * financeiro. Nenhuma entrega, reserva, estorno, provider ou assinatura de URL
 * acontece aqui. Miniaturas são best-effort por formato entregue; falha não
 * rebaixa a projeção.
 */

export interface JointProjectionRepairInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
}

export interface JointProjectionRepairDeps {
  readonly readDelivery: (input: {
    campaignId: string;
    operationId: string;
    storeId?: string;
  }) => Promise<TwoFormatReadResult>;
  readonly projectCampaign: (input: {
    readonly campaignId: string;
  }) => Promise<TwoFormatProjectResult>;
  readonly thumbnailExists: (input: {
    readonly campaignId: string;
    readonly role: "square_original" | "vertical";
  }) => Promise<boolean>;
  /** Contrato real: `{status:"created"|"already_exists"|"skipped"|"failed"}`. */
  readonly generateThumbnail: (input: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly operationId: string;
    readonly role: "square_original" | "vertical";
    readonly storagePath: string;
  }) => Promise<unknown>;
  readonly clock?: () => number;
}

export type JointProjectionRepairOutcome =
  | {
      readonly kind: "repaired";
      readonly projected: boolean;
      readonly alreadyProjected: boolean;
      readonly thumbnails: readonly TwoFormatFormat[];
    }
  | { readonly kind: "projection_failed"; readonly reason: string }
  | { readonly kind: "blocked"; readonly reason: string }
  | { readonly kind: "failed"; readonly code: TwoFormatDeliveryErrorCode };

function twoFormatErrorCode(error: unknown): TwoFormatDeliveryErrorCode | null {
  if (!(error instanceof Error) || error.name !== "TwoFormatDeliveryError") {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? (code as TwoFormatDeliveryErrorCode) : null;
}

/**
 * Contrato real do gerador: `{status:"created"|"already_exists"|"skipped"|"failed"}`.
 * Só `created` é uma NOVA geração. Resposta ausente/malformada nunca é
 * presumida como sucesso.
 */
function thumbnailCreated(result: unknown): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as { readonly status?: unknown }).status === "created"
  );
}

export async function repairJointProjection(
  input: JointProjectionRepairInput,
  deps: JointProjectionRepairDeps,
): Promise<JointProjectionRepairOutcome> {
  const read = await deps.readDelivery({
    campaignId: input.campaignId,
    operationId: input.operationId,
    storeId: input.storeId,
  });
  if (read.kind !== "found") {
    return { kind: "blocked", reason: read.kind };
  }

  let projection: TwoFormatProjectResult;
  try {
    projection = await deps.projectCampaign({ campaignId: input.campaignId });
  } catch (error) {
    return { kind: "failed", code: twoFormatErrorCode(error) ?? "unknown" };
  }
  if (!projection.success) {
    return { kind: "projection_failed", reason: projection.reason };
  }

  const thumbnails: TwoFormatFormat[] = [];
  const delivered = [
    { format: "1:1" as const, view: read.view.square, role: "square_original" as const },
    { format: "9:16" as const, view: read.view.vertical, role: "vertical" as const },
  ];
  for (const item of delivered) {
    if (item.view.state !== "delivered" || item.view.artifactPath === null) {
      continue;
    }
    try {
      const exists = await deps.thumbnailExists({
        campaignId: input.campaignId,
        role: item.role,
      });
      if (exists) continue;
      const generated = await deps.generateThumbnail({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        role: item.role,
        storagePath: item.view.artifactPath,
      });
      // Só geração explicitamente confirmada entra na lista; `already_exists`,
      // `skipped`, `failed`, ausente ou malformada não são nova geração.
      if (thumbnailCreated(generated)) thumbnails.push(item.format);
    } catch {
      // Best-effort POR FORMATO: falha de consulta/geração não rebaixa a
      // projeção já concluída e não impede o outro formato.
    }
  }

  return {
    kind: "repaired",
    projected: projection.projected,
    alreadyProjected: projection.alreadyProjected,
    thumbnails,
  };
}
