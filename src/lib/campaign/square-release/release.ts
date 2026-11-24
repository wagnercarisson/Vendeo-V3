import "server-only";

import { CreditService } from "@/lib/credit/credit-service";
import { nineSixteenVerticalAccess } from "@/lib/product-9-16-two-stage/orchestration/vertical-access";

import { squareReleaseKey, squareReleaseMetadata } from "./identity";
import {
  probeSquareReleaseArtifact,
  readSquareReleaseArtifact,
  readSquareReleaseLedger,
  type SquareReleaseLedgerRead,
  type SquareReleaseProbeDeps,
} from "./reader";
import {
  SQUARE_RELEASE_COST_CREDITS,
  type SquareReleaseIdentity,
  type SquareReleaseResult,
} from "./types";

export interface SquareReleaseCreditGateway {
  reserveCredit(
    storeId: string,
    amount: number,
    opts: {
      readonly campaignId: string;
      readonly idempotencyKey: string;
      readonly metadata: Record<string, unknown>;
    },
  ): Promise<string>;
}

export interface SquareReleaseDeps extends SquareReleaseProbeDeps {
  readonly credit?: SquareReleaseCreditGateway;
  readonly readArtifact?: typeof readSquareReleaseArtifact;
  readonly readLedger?: typeof readSquareReleaseLedger;
  readonly probeArtifact?: typeof probeSquareReleaseArtifact;
  readonly readVerticalAccess?: typeof nineSixteenVerticalAccess;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function errorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

function probeToResult(
  probe: Awaited<ReturnType<typeof probeSquareReleaseArtifact>>,
): SquareReleaseResult {
  switch (probe.kind) {
    case "integral":
      return { state: "eligible", reason: null, refunded: false };
    case "absent":
      return { state: "incompatible", reason: "artifact_absent", refunded: false };
    case "invalid":
      return { state: "unavailable", reason: "artifact_invalid", refunded: false };
    case "indeterminate":
      return {
        state: "unknown",
        reason: "artifact_indeterminate",
        refunded: false,
      };
  }
}

async function readAfterUncertainty(
  identity: SquareReleaseIdentity,
  deps: SquareReleaseDeps,
): Promise<SquareReleaseLedgerRead> {
  return (deps.readLedger ?? readSquareReleaseLedger)(identity, deps);
}

/**
 * Libera o quadrado uma única vez. Não há geração, upload, transformação ou
 * nova operação de crédito: a dedução de exatamente 1 crédito é o comprovante.
 *
 * Depois de qualquer resultado incerto (`NULL`, `23505`, transporte), a única
 * ação permitida é RELER a chave. Nunca há uma segunda chamada cega a
 * `reserveCredit`.
 */
export async function releaseSquare(
  input: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly verticalOperationId: string;
  },
  deps: SquareReleaseDeps = {},
): Promise<SquareReleaseResult> {
  const artifact = await (deps.readArtifact ?? readSquareReleaseArtifact)(
    input,
    deps,
  );
  if (artifact.kind === "absent") {
    return { state: "incompatible", reason: "artifact_absent", refunded: false };
  }
  if (artifact.kind === "read_failed") {
    return { state: "unknown", reason: "operation_unavailable", refunded: false };
  }

  const identity: SquareReleaseIdentity = {
    storeId: input.storeId,
    campaignId: input.campaignId,
    verticalOperationId: input.verticalOperationId,
    artifactId: artifact.artifact.artifactId,
    checksumSha256: artifact.artifact.checksumSha256,
  };

  const ledger = await (deps.readLedger ?? readSquareReleaseLedger)(
    identity,
    deps,
  );
  if (ledger.kind === "delivered") {
    return { state: "delivered", reason: null, refunded: false };
  }
  if (ledger.kind === "refunded") {
    return { state: "refunded", reason: "release_refunded", refunded: true };
  }
  if (ledger.kind === "invalid") {
    return { state: "unavailable", reason: "release_unknown", refunded: false };
  }
  if (ledger.kind === "read_failed") {
    return { state: "unknown", reason: "release_unknown", refunded: false };
  }

  // Pré-voo OBRIGATÓRIO antes de qualquer débito: origem nova, operação de
  // controle entregue e vertical íntegro. Uma liberação já paga retornou acima
  // e não depende deste probe para ser recuperada.
  let vertical;
  try {
    vertical = await (deps.readVerticalAccess ?? nineSixteenVerticalAccess)(
      {
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.verticalOperationId,
        mode: "preview",
      },
      { client: deps.client },
    );
  } catch {
    return {
      state: "unknown",
      reason: "operation_unavailable",
      refunded: false,
    };
  }
  if (vertical.kind === "not_available") {
    return vertical.reason === "indeterminate"
      ? { state: "unknown", reason: "operation_unavailable", refunded: false }
      : {
          state: "incompatible",
          reason: "operation_unavailable",
          refunded: false,
        };
  }

  const probe = await (deps.probeArtifact ?? probeSquareReleaseArtifact)(
    identity,
    deps,
  );
  if (probe.kind !== "integral") return probeToResult(probe);

  const credit = deps.credit ?? new CreditService();
  try {
    await credit.reserveCredit(input.storeId, SQUARE_RELEASE_COST_CREDITS, {
      campaignId: input.campaignId,
      idempotencyKey: squareReleaseKey(identity),
      metadata: squareReleaseMetadata(identity),
    });
  } catch (error) {
    const recovered = await readAfterUncertainty(identity, deps);
    switch (recovered.kind) {
      case "delivered":
        return { state: "delivered", reason: null, refunded: false };
      case "refunded":
        return { state: "refunded", reason: "release_refunded", refunded: true };
      case "invalid":
        return { state: "unavailable", reason: "release_unknown", refunded: false };
      case "read_failed":
        // Leitura indisponível NÃO prova saldo insuficiente. Mantém incerteza.
        return { state: "unknown", reason: "release_unknown", refunded: false };
      case "none":
        break;
    }

    const message = errorMessage(error);
    if (message.includes("saldo_insuficiente")) {
      return {
        state: "unavailable",
        reason: "insufficient_credits",
        refunded: false,
      };
    }
    // 23505 e falha de transporte permanecem incertos. A releitura acima não
    // encontrou a dedução; não há segunda reserva.
    return {
      state: "unknown",
      reason: errorCode(error) === "23505" ? "release_unknown" : "operation_unavailable",
      refunded: false,
    };
  }

  const after = await (deps.readLedger ?? readSquareReleaseLedger)(
    identity,
    deps,
  );
  switch (after.kind) {
    case "delivered":
      return { state: "delivered", reason: null, refunded: false };
    case "refunded":
      return { state: "refunded", reason: "release_refunded", refunded: true };
    case "invalid":
      return { state: "unavailable", reason: "release_unknown", refunded: false };
    case "read_failed":
    case "none":
      return { state: "unknown", reason: "release_unknown", refunded: false };
  }
}
