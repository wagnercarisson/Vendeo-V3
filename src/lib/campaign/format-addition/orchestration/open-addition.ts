import "server-only";

import type {
  FormatAdditionOpeningDeps,
  OpenFormatAdditionInput,
  OpenFormatAdditionResult,
} from "./types";
import { FORMAT_ADDITION_OPEN_REASON } from "./types";

/**
 * F62/62-04 (Tasks 1–2) — abertura/replay dedicada.
 *
 * Ordem: (0) ler o vínculo existente; (1) gates de abertura; (2) revalidar a
 * fonte e persistir/reutilizar a ponte; (3) capturar/validar a economia
 * congelada; (4) chamar a RPC dedicada. Replay/retomada retornam o estado
 * durável sem recapturar economia, reservar outro crédito ou consultar saldo.
 * Preparação/expansão/entrega NÃO são executadas aqui (Tasks 3–4).
 */
export async function openFormatAddition(
  input: OpenFormatAdditionInput,
  deps: FormatAdditionOpeningDeps,
): Promise<OpenFormatAdditionResult> {
  const link = await deps.readLink({
    storeId: input.storeId,
    campaignId: input.campaignId,
  });

  if (link.kind === "read_failed") {
    return Object.freeze({
      ok: false as const,
      code: FORMAT_ADDITION_OPEN_REASON.linkReadFailed,
      reason: "format_addition_link_unavailable",
    });
  }

  if (link.kind === "found") {
    const addition = link.addition;
    const sameRequest = addition.requestId === input.requestId;
    const active =
      addition.state === "delivered" ||
      addition.state === "processing" ||
      addition.state === "unknown";

    if (sameRequest || active) {
      return Object.freeze({
        ok: true as const,
        kind: "replay" as const,
        state: addition.state,
        operationId: addition.operationId ?? input.operationId,
        requestId: addition.requestId ?? input.requestId,
        refunded: addition.refunded,
      });
    }

    // `refunded` com request novo é uma nova tentativa explícita: segue para
    // abertura. O mesmo request já retornou acima, sem nova cobrança.
  }

  const userId =
    input.authorization.kind === "owner" ? input.authorization.userId : null;
  const gate = await deps.checkOpeningGate({
    storeId: input.storeId,
    campaignId: input.campaignId,
    userId,
  });
  if (!gate.allowed) {
    return Object.freeze({
      ok: false as const,
      code: gate.code,
      reason: gate.reason,
    });
  }

  const bridge = await deps.registerSource({
    storeId: input.storeId,
    campaignId: input.campaignId,
    sourceOrigin: input.sourceOrigin,
    authorization: input.authorization,
  });
  if (!bridge.ok) {
    return Object.freeze({
      ok: false as const,
      code: FORMAT_ADDITION_OPEN_REASON.sourceBridgeFailed,
      reason: bridge.reason,
      ...(bridge.detail === undefined ? {} : { detail: bridge.detail }),
    });
  }

  const frozen = await deps.captureFrozenEconomics(input.selection);
  if (!frozen.ok) {
    return Object.freeze({
      ok: false as const,
      code: FORMAT_ADDITION_OPEN_REASON.frozenEconomicsFailed,
      reason: frozen.reason,
      ...(frozen.detail === undefined ? {} : { detail: frozen.detail }),
    });
  }

  const opened = await deps.openAddition({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    requestId: input.requestId,
    sourceOrigin: input.sourceOrigin,
    sourceOperationId:
      input.sourceOrigin === "new_flow_1_1"
        ? bridge.sourceRegistrationOperationId
        : null,
    sourceRegistrationOperationId: bridge.sourceRegistrationOperationId,
    sourceArtifactId: bridge.artifact.id,
    sourceChecksumSha256: bridge.artifact.checksumSha256,
    frozen: frozen.frozen,
  });

  if (!opened.success) {
    return Object.freeze({
      ok: false as const,
      code: FORMAT_ADDITION_OPEN_REASON.rpcFailed,
      reason: opened.reason,
    });
  }

  if (!opened.idempotent && opened.state === "open") {
    return Object.freeze({
      ok: true as const,
      kind: "opened" as const,
      state: "open" as const,
      operationId: opened.operationId,
      requestId: opened.requestId,
      idempotent: false,
      frozen: frozen.frozen,
      sourceRegistrationOperationId: opened.sourceRegistrationOperationId,
      squareArtifactId: opened.squareArtifactId,
    });
  }

  return Object.freeze({
    ok: true as const,
    kind: "replay" as const,
    state: opened.state === "open" ? "processing" : opened.state,
    operationId: opened.operationId,
    requestId: opened.requestId,
    refunded: opened.state === "refunded",
  });
}
