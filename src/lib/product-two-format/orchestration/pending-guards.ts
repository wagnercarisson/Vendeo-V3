/**
 * F60.7-08 — decisão PURA de resolução administrativa conjunta (fail-closed).
 *
 * Autoridade de BLOQUEIO: nenhuma RPC deve ser chamada quando a decisão nega.
 * A RPC continua sendo a autoridade final de efeito. Sem I/O, sem dependência de
 * runtime de servidor, sem Supabase — apenas a matriz de estados.
 *
 * Precedência: ação inválida → claim ativo → par incompleto → regras por ação.
 * O crédito compartilhado decide o peso do seu outcome histórico: não terminal
 * governa; `delivered` torna o histórico inerte para entrega (só `failed`
 * histórico serve de finalidade a um novo estorno); `refunded` bloqueia entrega
 * e fornece finalidade. O outcome PRÓPRIO do formato é independente.
 */

export type JointOutcomeKind = "none" | "failed" | "unknown" | "indeterminate";

export type JointCreditStatus =
  | "reserved"
  | "art_uploaded"
  | "delivered"
  | "refunded";

export type JointArtifactKind =
  | "integral"
  | "absent"
  | "invalid"
  | "indeterminate";

export interface JointResolutionInput {
  readonly action: "deliver" | "refund";
  readonly creditStatus: JointCreditStatus;
  readonly outcomeKind: JointOutcomeKind;
  readonly sharedOutcomeKind: JointOutcomeKind;
  readonly sharedCreditStatus: JointCreditStatus;
  readonly artifactKind: JointArtifactKind;
  readonly activeClaim: boolean;
  readonly linkComplete: boolean;
}

export type JointResolutionBlock =
  | "invalid_action"
  | "delivery_link_incomplete"
  | "operation_in_progress"
  | "insufficient_evidence"
  | "invalid_evidence"
  | "artifact_present"
  | "delivered_not_refundable"
  | "already_delivered"
  | "unknown_outcome"
  | "outcome_failed"
  | "outcome_indeterminate"
  | "shared_operation_not_final"
  | "operation_terminal"
  | "operation_identity_conflict";

export type JointResolutionDecision =
  | { readonly allowed: true; readonly action: "deliver" | "refund" }
  | { readonly allowed: false; readonly block: JointResolutionBlock };

function deny(block: JointResolutionBlock): JointResolutionDecision {
  return { allowed: false, block };
}

function allow(action: "deliver" | "refund"): JointResolutionDecision {
  return { allowed: true, action };
}

function ownOutcomeBlock(
  outcomeKind: JointOutcomeKind,
): JointResolutionBlock | null {
  if (outcomeKind === "unknown") return "unknown_outcome";
  if (outcomeKind === "indeterminate") return "outcome_indeterminate";
  if (outcomeKind === "failed") return "outcome_failed";
  return null;
}

function decideDeliver(input: JointResolutionInput): JointResolutionDecision {
  if (input.creditStatus === "refunded") return deny("operation_terminal");
  if (input.creditStatus === "delivered") return deny("already_delivered");
  if (input.sharedCreditStatus === "refunded") return deny("operation_terminal");

  const own = ownOutcomeBlock(input.outcomeKind);
  if (own !== null) return deny(own);

  // `delivered` compartilhado torna o outcome histórico do vertical INERTE
  // para entrega (corrida em que a entrega prevaleceu sobre a falha).
  if (input.sharedCreditStatus !== "delivered") {
    const shared = ownOutcomeBlock(input.sharedOutcomeKind);
    if (shared !== null) return deny(shared);
  }

  if (input.artifactKind !== "integral") return deny("insufficient_evidence");
  return allow("deliver");
}

function decideRefund(input: JointResolutionInput): JointResolutionDecision {
  if (input.creditStatus === "delivered") return deny("delivered_not_refundable");
  // Replay de estorno já comprovado: nenhum novo outcome/efeito. A RPC é
  // idempotente; a exigência de ausência vale apenas para um NOVO estorno.
  if (input.creditStatus === "refunded") return allow("refund");

  const own = ownOutcomeBlock(input.outcomeKind);
  if (own === "unknown_outcome" || own === "outcome_indeterminate") return deny(own);
  // `failed` próprio é permitido: é a finalidade exigida pela RPC.

  if (input.sharedCreditStatus === "refunded") {
    // finalidade compartilhada dura; segue para a evidência.
  } else if (input.sharedCreditStatus === "delivered") {
    // O histórico só vale como finalidade quando é `failed`; `unknown`
    // histórico não dá finalidade, mas não é tratado como indeterminação.
    if (input.sharedOutcomeKind !== "failed") {
      return deny("shared_operation_not_final");
    }
  } else {
    if (input.sharedOutcomeKind === "unknown") return deny("unknown_outcome");
    if (input.sharedOutcomeKind === "indeterminate") {
      return deny("outcome_indeterminate");
    }
    if (input.sharedOutcomeKind !== "failed") {
      return deny("shared_operation_not_final");
    }
  }

  if (input.artifactKind === "integral") return deny("artifact_present");
  if (input.artifactKind === "indeterminate") return deny("insufficient_evidence");
  if (input.artifactKind === "invalid") return deny("invalid_evidence");
  return allow("refund");
}

export function decideJointResolution(
  input: JointResolutionInput,
): JointResolutionDecision {
  if (input.action !== "deliver" && input.action !== "refund") {
    return deny("invalid_action");
  }
  if (input.activeClaim) return deny("operation_in_progress");
  if (!input.linkComplete) return deny("delivery_link_incomplete");

  return input.action === "deliver" ? decideDeliver(input) : decideRefund(input);
}
