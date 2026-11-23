import "server-only";

import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { RunNineSixteenDeps } from "@/lib/product-9-16-two-stage/orchestration/types";
import type { VerticalArtifactProbe } from "@/lib/product-9-16-two-stage/two-stage-financial-service";

import type {
  FormatAdditionDeliverInput,
  FormatAdditionDeliverResult,
} from "../financial-client";
import type { FormatAdditionDeliveryOutcome } from "./types";

/**
 * F62/62-04 (Task 4) — entrega vertical dedicada, sem projeção de campanha.
 *
 * Sonda o artefato canônico, adquire o token de publicação e chama a RPC de
 * entrega da adição. Miniatura é best-effort. Não altera `campaigns`, não
 * reprojeta e não toca a operação original.
 */
export interface DeliverFormatAdditionVerticalInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: AuthorizationContext;
}

export interface DeliverFormatAdditionVerticalDeps {
  readonly probe: VerticalArtifactProbe;
  readonly publication: Pick<RunNineSixteenDeps["credit"], "beginPublication">;
  readonly deliver: (
    input: FormatAdditionDeliverInput,
  ) => Promise<FormatAdditionDeliverResult>;
  readonly generateThumbnail: RunNineSixteenDeps["generateThumbnail"];
}

export async function deliverFormatAdditionVertical(
  input: DeliverFormatAdditionVerticalInput,
  deps: DeliverFormatAdditionVerticalDeps,
): Promise<FormatAdditionDeliveryOutcome> {
  let probe;
  try {
    probe = await deps.probe.probeVerticalArtifact({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
  } catch {
    return Object.freeze({ kind: "failed" as const, code: "probe_failed", reason: "probe_read_failed" });
  }

  if (probe.kind === "absent") return Object.freeze({ kind: "absent" as const });
  if (probe.kind === "invalid") return Object.freeze({ kind: "invalid" as const });
  if (probe.kind === "indeterminate") {
    return Object.freeze({ kind: "indeterminate" as const });
  }
  if (
    probe.format !== "9:16" ||
    probe.width !== 1080 ||
    probe.height !== 1920 ||
    probe.mimeType !== "image/jpeg"
  ) {
    return Object.freeze({ kind: "invalid" as const });
  }

  let publication;
  try {
    publication = await deps.publication.beginPublication(
      input.campaignId,
      input.operationId,
    );
  } catch (error) {
    return Object.freeze({
      kind: "failed" as const,
      code: "publication_failed",
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  if (publication.token === null) {
    return Object.freeze({
      kind: "processing" as const,
      reason: publication.publicationState || "publication_in_progress",
    });
  }

  let delivery;
  try {
    delivery = await deps.deliver({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      publicationToken: publication.token,
    });
  } catch (error) {
    return Object.freeze({
      kind: "failed" as const,
      code: "delivery_failed",
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  if (!delivery.success) {
    return Object.freeze({
      kind: "failed" as const,
      code: delivery.reason,
      reason: delivery.reason,
    });
  }

  try {
    await deps.generateThumbnail({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      storagePath: probe.storagePath,
    });
  } catch {
    // Best-effort: falha de miniatura não desfaz nem invalida a entrega.
  }

  return Object.freeze({
    kind: "delivered" as const,
    idempotent: delivery.idempotent,
  });
}
