import {
  BASE_MAX_ATTEMPTS,
  BASE_MAX_FALLBACK_ATTEMPTS,
  BASE_MAX_PRIMARY_ATTEMPTS,
  EXPANSION_MAX_ATTEMPTS,
  ProductTwoStageOperationError,
  type AcquireStepResult,
  type AttemptHistoryEntry,
  type AttemptTarget,
  type DecideNextActionInput,
  type DecideNextActionResult,
  type DecideNextAttemptInput,
  type DecideNextAttemptResult,
  type DerivedFinancialView,
  type ProviderFailure,
  type ProviderFailureClass,
  type ProviderFailureReason,
  type SendEvidence,
} from "./types";

export interface ClassifyProviderFailureInput {
  readonly reason: ProviderFailureReason;
  readonly sendEvidence: SendEvidence;
  readonly retryable?: boolean;
}

/**
 * Classifica a falha preservando o motivo. `retryable` do SDK NUNCA sobrepõe
 * timeout/abort/perda após possível envio: esses casos são SEMPRE `unknown`.
 */
export function classifyProviderFailure(
  input: ClassifyProviderFailureInput,
): ProviderFailureClass {
  if (input.reason === "invalid_output") return "definitive";
  if (input.reason === "rate_limit" || input.reason === "capacity_unavailable") {
    return "transient";
  }
  if (input.reason === "pre_send_failure" && input.sendEvidence === "not_sent") {
    return "transient";
  }
  if (
    input.reason === "timeout" ||
    input.reason === "abort" ||
    input.reason === "comm_lost"
  ) {
    return "unknown";
  }
  // `other`: sem evidência suficiente para repetir.
  return "unknown";
}

function countTargets(history: readonly AttemptHistoryEntry[]) {
  return history.reduce(
    (acc, entry) => {
      acc.total += 1;
      acc[entry.target] += 1;
      return acc;
    },
    { total: 0, primary: 0, fallback: 0, initial: 0, retry: 0 },
  );
}

function lastEntry(history: readonly AttemptHistoryEntry[]) {
  return history.length ? history[history.length - 1] : null;
}

export function isConsistentProviderFailure(failure: ProviderFailure | null): boolean {
  if (!failure) return false;
  const expected = classifyProviderFailure({
    reason: failure.reason,
    sendEvidence: failure.sendEvidence,
  });
  if (failure.class !== expected) return false;
  if (failure.reason === "other") return false;
  if (failure.reason === "pre_send_failure" && failure.sendEvidence !== "not_sent") {
    return false;
  }
  if (failure.reason === "invalid_output" && failure.sendEvidence === "not_sent") {
    return false;
  }
  return true;
}

function deny(reason: DecideNextAttemptResult["reason"]): DecideNextAttemptResult {
  return { allowed: false, target: null, reason };
}

function allow(target: AttemptTarget): DecideNextAttemptResult {
  return { allowed: true, target, reason: null };
}

/**
 * Decisão pura de próxima tentativa. A primeira tentativa de uma etapa
 * PENDENTE não depende de `lastFailure`; a ausência de evidência só bloqueia
 * REPETIÇÕES (histórico já existente).
 */
export function decideNextAttempt(
  input: DecideNextAttemptInput,
): DecideNextAttemptResult {
  const { stage, targetHistory, lastFailure, requestedTarget } = input;
  const counts = countTargets(targetHistory);
  const last = lastEntry(targetHistory);

  if (targetHistory.some((entry) => entry.status === "in_progress")) {
    return deny("operation_in_progress");
  }

  if (stage === "expansion") {
    if (counts.total === 0) {
      return requestedTarget === "initial" ? allow("initial") : deny("invalid_target");
    }
    if (counts.total >= EXPANSION_MAX_ATTEMPTS) return deny("attempt_limit_reached");
    if (!last || last.status !== "failed") return deny("invalid_transition");
    if (lastFailure === null) return deny("insufficient_failure_evidence");
    if (!isConsistentProviderFailure(lastFailure)) {
      return deny("insufficient_failure_evidence");
    }
    if (lastFailure.class !== "transient") {
      return deny(lastFailure.class === "unknown" ? "operation_unknown" : "invalid_transition");
    }
    return requestedTarget === "retry" ? allow("retry") : deny("invalid_target");
  }

  // Base: primeira tentativa de etapa pendente é sempre `primary`.
  if (counts.total === 0) {
    return requestedTarget === "primary" ? allow("primary") : deny("invalid_target");
  }
  if (counts.total >= BASE_MAX_ATTEMPTS) return deny("attempt_limit_reached");
  if (counts.fallback > BASE_MAX_FALLBACK_ATTEMPTS) return deny("attempt_limit_reached");
  if (!last) return deny("invalid_transition");
  if (last.status === "completed") return deny("invalid_transition");
  if (last.status === "abandoned") {
    return deny(lastFailure?.class === "unknown" ? "operation_unknown" : "insufficient_failure_evidence");
  }
  if (last.status !== "failed") return deny("invalid_transition");

  // A partir daqui há repetição: sem motivo/evidência consistente, não autoriza.
  if (lastFailure === null) return deny("insufficient_failure_evidence");
  if (!isConsistentProviderFailure(lastFailure)) {
    return deny("insufficient_failure_evidence");
  }
  if (lastFailure.class === "unknown") return deny("operation_unknown");
  if (lastFailure.class === "definitive") return deny("invalid_transition");
  if (counts.fallback >= BASE_MAX_FALLBACK_ATTEMPTS) return deny("attempt_limit_reached");

  let allowedTarget: AttemptTarget | null = null;
  if (lastFailure.reason === "rate_limit") {
    allowedTarget =
      counts.primary < BASE_MAX_PRIMARY_ATTEMPTS && counts.fallback === 0
        ? "primary"
        : counts.primary >= 1 && counts.fallback < BASE_MAX_FALLBACK_ATTEMPTS
          ? "fallback"
          : null;
  } else if (lastFailure.reason === "capacity_unavailable") {
    allowedTarget =
      counts.primary >= 1 && counts.fallback < BASE_MAX_FALLBACK_ATTEMPTS
        ? "fallback"
        : counts.primary < BASE_MAX_PRIMARY_ATTEMPTS && counts.fallback === 0
          ? "primary"
          : null;
  } else if (lastFailure.reason === "pre_send_failure") {
    if (lastFailure.sendEvidence !== "not_sent") return deny("insufficient_failure_evidence");
    allowedTarget =
      counts.primary < BASE_MAX_PRIMARY_ATTEMPTS && counts.fallback === 0
        ? "primary"
        : counts.primary >= 1 && counts.fallback < BASE_MAX_FALLBACK_ATTEMPTS
          ? "fallback"
          : null;
  } else {
    return deny("insufficient_failure_evidence");
  }

  if (!allowedTarget) return deny("attempt_limit_reached");
  if (counts.fallback > 0 && allowedTarget === "primary") {
    return deny("invalid_transition");
  }
  return requestedTarget === allowedTarget
    ? allow(allowedTarget)
    : deny("invalid_target");
}

function expansionDecision(
  input: DecideNextActionInput,
): DecideNextActionResult {
  const expansion = input.expansion;
  if (expansion.status === "pending") {
    return { action: "acquire_expansion", nextTarget: "initial" };
  }
  if (expansion.status === "in_progress") return { action: "wait", nextTarget: null };
  if (expansion.status === "done") return { action: "deliver", nextTarget: null };
  if (expansion.status === "failed") {
    const history = input.expansionHistory ?? [];
    if (history.length === 0 || expansion.attemptsUsed > history.length) {
      return { action: "blocked", nextTarget: null };
    }
    const decision = decideNextAttempt({
      stage: "expansion",
      targetHistory: history,
      lastFailure: expansion.failure,
      requestedTarget: "retry",
    });
    return decision.allowed
      ? { action: "retry_expansion", nextTarget: "retry" }
      : { action: "blocked", nextTarget: null };
  }
  return { action: "blocked", nextTarget: null };
}

/** Traduz o estado persistido para as ações REAIS da RPC de retomada. */
export function decideNextAction(
  input: DecideNextActionInput,
): DecideNextActionResult {
  if (input.terminal || input.unknown || input.failedOutcome) {
    return { action: "blocked", nextTarget: null };
  }

  const base = input.base;
  if (base.status === "pending") {
    return { action: "acquire_base", nextTarget: "primary" };
  }
  if (base.status === "in_progress") return { action: "wait", nextTarget: null };
  if (base.status === "done") return expansionDecision(input);
  if (base.status !== "failed") return { action: "blocked", nextTarget: null };

  // Base falhou: reutiliza a mesma decisão de tentativa (motivo/evidência).
  const history = input.baseHistory ?? [];
  if (history.length === 0 || base.attemptsUsed > history.length) {
    return { action: "blocked", nextTarget: null };
  }
  for (const target of ["primary", "fallback"] as const) {
    const decision = decideNextAttempt({
      stage: "base",
      targetHistory: history,
      lastFailure: base.failure,
      requestedTarget: target,
    });
    if (decision.allowed) {
      return { action: "retry_base", nextTarget: target };
    }
  }
  return { action: "blocked", nextTarget: null };
}

/** Deriva o estado financeiro SOMENTE da linha de crédito. */
export function deriveFinancialView(creditRow: {
  readonly status: string;
}): DerivedFinancialView {
  const status = creditRow.status;
  return Object.freeze({
    status,
    terminal: status === "delivered" || status === "refunded",
    delivered: status === "delivered",
    refunded: status === "refunded",
    reserved: status === "reserved",
  });
}

/** Único caminho autorizado a executar: `execute`. `query_only` nunca executa. */
export function assertExecuteAuthorized(result: AcquireStepResult): void {
  if (!result.acquired || result.authorization !== "execute") {
    throw new ProductTwoStageOperationError(
      "operation_in_progress",
      "query_only_never_executes",
    );
  }
}

export const TWO_STAGE_POLICY = Object.freeze({
  baseMaxAttempts: BASE_MAX_ATTEMPTS,
  baseMaxPrimary: BASE_MAX_PRIMARY_ATTEMPTS,
  baseMaxFallback: BASE_MAX_FALLBACK_ATTEMPTS,
  expansionMaxAttempts: EXPANSION_MAX_ATTEMPTS,
});

export type { ProviderFailure };
