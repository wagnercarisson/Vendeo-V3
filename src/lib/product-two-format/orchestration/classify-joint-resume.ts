import type { TwoFormatFormatView } from "../read-model";

/**
 * F60.7-07 — classificação PURA por formato e plano de continuação (D13).
 *
 * Este módulo não tem I/O, não depende de runtime de servidor, não importa
 * Supabase nem lê configuração. Ele só traduz o read model e decide o MENOR
 * conjunto de etapas permitido. Nenhuma ação gasta dinheiro ou estorna: o
 * conjunto de ações é fechado e não inclui provider, refund, reserve ou upload.
 */

export type JointFormatResumeState =
  | "delivered"
  | "reserved"
  | "refunded"
  | "unknown"
  | "unavailable";

/**
 * `absent` só é `refunded` quando o crédito foi devolvido; sem essa prova o
 * estado é indeterminado (fail-closed). `processing` é o crédito reservado.
 */
export function classifyJointFormat(
  view: TwoFormatFormatView,
): JointFormatResumeState {
  switch (view.state) {
    case "delivered":
      return "delivered";
    case "processing":
      return "reserved";
    case "absent":
      return view.creditRefunded ? "refunded" : "unknown";
    case "unknown":
      return "unknown";
    case "unavailable":
      return "unavailable";
  }
}

/**
 * Sonda do quadrado só é necessária com o quadrado reservado e o vertical não
 * terminal. `unknown`/`unavailable`/terminais nunca sondam.
 */
export function needsSquareArtifact(input: {
  readonly square: JointFormatResumeState;
  readonly vertical: JointFormatResumeState;
}): boolean {
  return (
    input.square === "reserved" &&
    (input.vertical === "reserved" || input.vertical === "delivered")
  );
}

export type JointArtifactObservation =
  | "integral"
  | "absent"
  | "invalid"
  | "indeterminate";

export interface JointResumePlanInput {
  readonly square: JointFormatResumeState;
  readonly vertical: JointFormatResumeState;
  readonly squareArtifact: JointArtifactObservation;
}

export type JointResumePlan =
  | { readonly action: "run_base" }
  | { readonly action: "run_vertical_only" }
  | { readonly action: "settle_square" }
  | { readonly action: "repair_only" }
  | {
      readonly action: "partial_terminal";
      readonly reason: "vertical_refunded" | "square_refunded";
    }
  | { readonly action: "pending_finalization"; readonly refunded: "1:1" | "9:16" }
  | { readonly action: "terminal_error" }
  | { readonly action: "blocked_unknown" }
  | { readonly action: "blocked_partial_read" }
  | {
      readonly action: "fail_closed";
      readonly reason:
        | "base_missing"
        | "artifact_invalid"
        | "artifact_indeterminate"
        | "unhandled_state";
    };

function artifactFailure(
  observation: JointArtifactObservation,
): JointResumePlan | null {
  if (observation === "invalid") {
    return { action: "fail_closed", reason: "artifact_invalid" };
  }
  if (observation === "indeterminate") {
    return { action: "fail_closed", reason: "artifact_indeterminate" };
  }
  return null;
}

/**
 * Decisão TOTAL e fail-closed. Precedência:
 * (1) `unknown`; (2) `unavailable`; (3) ambos `refunded`; (4) estornado +
 * entregue; (5) estornado + reservado (pendência de estorno); (6) ambos
 * entregues; (7) vertical entregue + quadrado reservado; (8) quadrado entregue
 * + vertical reservado; (9) quadrado reservado (integral/absent/inválido).
 * Qualquer combinação não coberta cai em `fail_closed` (`unhandled_state`).
 */
export function planJointResume(
  input: JointResumePlanInput,
): JointResumePlan {
  const { square, vertical, squareArtifact } = input;

  if (square === "unknown" || vertical === "unknown") {
    return { action: "blocked_unknown" };
  }
  if (square === "unavailable" || vertical === "unavailable") {
    return { action: "blocked_partial_read" };
  }

  const refundedCount =
    (square === "refunded" ? 1 : 0) + (vertical === "refunded" ? 1 : 0);
  if (refundedCount === 2) {
    return { action: "terminal_error" };
  }
  if (refundedCount === 1) {
    const refunded = square === "refunded" ? "1:1" : "9:16";
    const other = square === "refunded" ? vertical : square;
    if (other === "delivered") {
      return {
        action: "partial_terminal",
        reason: square === "refunded" ? "square_refunded" : "vertical_refunded",
      };
    }
    // `other` só pode ser `reserved` (unknown/unavailable já foram tratados).
    return { action: "pending_finalization", refunded };
  }

  if (square === "delivered" && vertical === "delivered") {
    return { action: "repair_only" };
  }

  if (vertical === "delivered" && square === "reserved") {
    if (squareArtifact === "integral") return { action: "settle_square" };
    if (squareArtifact === "absent") {
      return { action: "fail_closed", reason: "base_missing" };
    }
    return (
      artifactFailure(squareArtifact) ?? {
        action: "fail_closed",
        reason: "unhandled_state",
      }
    );
  }

  if (square === "delivered" && vertical === "reserved") {
    return { action: "run_vertical_only" };
  }

  if (square === "reserved") {
    if (squareArtifact === "integral") return { action: "settle_square" };
    if (squareArtifact === "absent") {
      if (vertical === "reserved") return { action: "run_base" };
      return { action: "fail_closed", reason: "unhandled_state" };
    }
    return (
      artifactFailure(squareArtifact) ?? {
        action: "fail_closed",
        reason: "unhandled_state",
      }
    );
  }

  return { action: "fail_closed", reason: "unhandled_state" };
}
