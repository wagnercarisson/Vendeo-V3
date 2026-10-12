/**
 * F56.2b1b (B1B-D6, C2, I3) — decisão PURA do portão de download do novo fluxo.
 *
 * O download do novo fluxo SHALL exigir campanha do fluxo persistido, objeto
 * ÍNTEGRO e operação `delivered`. Upload (`art_uploaded`) NÃO SHALL liberar
 * download (F4 — arte salva ≠ entregue) e o estado persistido NUNCA é promovido
 * por presença de objeto. O resultado da sonda é TIPADO (C2): um erro de Storage
 * (`indeterminate`) NUNCA é tratado como ausência — todos os casos não-integrais
 * (`absent`/`invalid`/`indeterminate`) bloqueiam o download.
 *
 * I2 — precedência TERMINAL: `delivered`/`refunded` (estado terminal) prevalecem
 * sobre o marcador histórico `unknown`; `unknown` só governa operação NÃO terminal.
 *
 * I3 — este módulo NÃO assina URLs: a assinatura (`getSignedArtifactUrl`) só é
 * criada pela rota de download APÓS este portão liberar.
 */

import type { ArtifactProbe } from "./types";
import type { CreditOperationStatus } from "../credit-operation/types";

export interface DecideNewFlowDownloadInput {
  /** Estado PERSISTIDO da operação de crédito do novo fluxo. */
  readonly operationStatus: CreditOperationStatus;
  /** Resultado TIPADO da sonda de arte (C2) — nunca um `null` ambíguo. */
  readonly artifactProbe: ArtifactProbe;
  /**
   * `true` quando o resultado desconhecido está PERSISTIDO (C1). Governa SOMENTE
   * operação NÃO terminal (a linha de `product_1_1_generation_outcomes` é
   * imutável — I2: o terminal prevalece).
   */
  readonly unknown?: boolean;
}

export type NewFlowDownloadReason =
  | "delivered_with_integral_artifact"
  | "operation_unknown"
  | "operation_not_delivered"
  | "artifact_not_integral";

export interface NewFlowDownloadDecision {
  readonly allowed: boolean;
  readonly reason: NewFlowDownloadReason;
  /** Caminho do objeto — preenchido SOMENTE quando liberado. */
  readonly storagePath: string | null;
}

export function decideNewFlowDownload(
  input: DecideNewFlowDownloadInput,
): NewFlowDownloadDecision {
  // I2 — o marcador `unknown` só governa operação NÃO terminal.
  const unknownGoverns =
    input.unknown === true &&
    input.operationStatus !== "delivered" &&
    input.operationStatus !== "refunded";
  if (unknownGoverns) {
    return Object.freeze({ allowed: false, reason: "operation_unknown", storagePath: null });
  }

  if (input.operationStatus !== "delivered") {
    return Object.freeze({
      allowed: false,
      reason: "operation_not_delivered",
      storagePath: null,
    });
  }

  if (input.artifactProbe.kind !== "integral") {
    return Object.freeze({
      allowed: false,
      reason: "artifact_not_integral",
      storagePath: null,
    });
  }

  return Object.freeze({
    allowed: true,
    reason: "delivered_with_integral_artifact",
    storagePath: input.artifactProbe.storagePath,
  });
}
