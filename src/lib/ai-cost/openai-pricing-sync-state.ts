/**
 * Derivação pura do estado da sincronização de tarifas (sem I/O).
 *
 * Regras:
 * - sucesso fresco (< 36h) e sem falha posterior remove o aviso;
 * - falha/atraso anterior CONTINUA destacado enquanto uma nova tentativa roda;
 *   a nova execução só acrescenta "consulta em andamento", não limpa a pendência;
 * - ausência de confirmação por 36h é "stale";
 * - execução "running" por mais de 15min é "interrupted";
 * - falha de consulta ao estado é "unavailable" (nunca "atualizado").
 */

export const PRICING_SYNC_STALE_MS = 36 * 60 * 60 * 1000;
export const PRICING_SYNC_RUNNING_STALE_MS = 15 * 60 * 1000;

export type PricingSyncAttemptStatus = "running" | "success" | "failed";

export interface PricingSyncAttemptSummary {
  id: string;
  status: PricingSyncAttemptStatus;
  startedAt: string;
  finishedAt: string | null;
  failureStage: string | null;
  failureCode: string | null;
}

export type PricingSyncStateKind =
  | "fresh"
  | "failed"
  | "stale"
  | "never"
  | "running"
  | "interrupted"
  | "unavailable";

export interface PricingSyncState {
  kind: PricingSyncStateKind;
  lastSuccessAt: string | null;
  /** Última tentativa RESOLVIDA (não a execução em andamento). */
  lastAttemptAt: string | null;
  lastAttemptStatus: PricingSyncAttemptStatus | null;
  /** Uma nova tentativa está em andamento (running recente). */
  running: boolean;
  runningSince: string | null;
}

interface ValidAttempt {
  attempt: PricingSyncAttemptSummary;
  startedAt: number;
  finishedAt: number | null;
}

type ResolvedState = Omit<PricingSyncState, "running" | "runningSince">;

function timeOf(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function sortAttempts(attempts: readonly PricingSyncAttemptSummary[]): ValidAttempt[] {
  return attempts
    .map((attempt) => ({
      attempt,
      startedAt: timeOf(attempt.startedAt),
      finishedAt: timeOf(attempt.finishedAt),
    }))
    .filter(
      (item): item is ValidAttempt =>
        item.startedAt !== null &&
        (item.attempt.status === "success" ||
          item.attempt.status === "failed" ||
          item.attempt.status === "running"),
    )
    .sort((a, b) => b.startedAt - a.startedAt);
}

function lastSuccessTime(success: ValidAttempt | undefined): number | null {
  if (!success) return null;
  return success.finishedAt ?? success.startedAt;
}

function lastSuccessIso(success: ValidAttempt | undefined): string | null {
  if (!success) return null;
  return success.attempt.finishedAt ?? success.attempt.startedAt;
}

/**
 * Estado sem considerar a execução `running` corrente. Recebe apenas
 * tentativas já resolvidas (success/failed).
 */
function deriveResolvedState(
  attempts: readonly ValidAttempt[],
  now: Date,
): ResolvedState {
  const resolved = attempts.filter((item) => item.attempt.status !== "running");
  if (resolved.length === 0) {
    return {
      kind: "never",
      lastSuccessAt: null,
      lastAttemptAt: null,
      lastAttemptStatus: null,
    };
  }

  const latest = resolved[0];
  const success = resolved.find((item) => item.attempt.status === "success");
  const lastSuccessAt = lastSuccessIso(success);

  if (latest.attempt.status === "failed") {
    const successTime = lastSuccessTime(success);
    if (success && (successTime === null || latest.startedAt > successTime)) {
      return {
        kind: "failed",
        lastSuccessAt,
        lastAttemptAt: latest.attempt.startedAt,
        lastAttemptStatus: "failed",
      };
    }
    if (!success) {
      return {
        kind: "never",
        lastSuccessAt: null,
        lastAttemptAt: latest.attempt.startedAt,
        lastAttemptStatus: "failed",
      };
    }
  }

  if (!success) {
    return {
      kind: "never",
      lastSuccessAt: null,
      lastAttemptAt: latest.attempt.startedAt,
      lastAttemptStatus: latest.attempt.status,
    };
  }

  // Se a falha é anterior ao último sucesso, o sucesso é a referência.
  const effectiveLatest =
    latest.attempt.status === "success" ? latest : success;

  const successTime = lastSuccessTime(success) ?? 0;
  if (now.getTime() - successTime > PRICING_SYNC_STALE_MS) {
    return {
      kind: "stale",
      lastSuccessAt,
      lastAttemptAt: effectiveLatest.attempt.startedAt,
      lastAttemptStatus: effectiveLatest.attempt.status,
    };
  }

  return {
    kind: "fresh",
    lastSuccessAt,
    lastAttemptAt: effectiveLatest.attempt.startedAt,
    lastAttemptStatus: effectiveLatest.attempt.status,
  };
}

export function derivePricingSyncState(params: {
  attempts: readonly PricingSyncAttemptSummary[];
  now: Date;
  queryFailed?: boolean;
}): PricingSyncState {
  if (params.queryFailed) {
    return {
      kind: "unavailable",
      lastSuccessAt: null,
      lastAttemptAt: null,
      lastAttemptStatus: null,
      running: false,
      runningSince: null,
    };
  }

  const attempts = sortAttempts(params.attempts);
  if (attempts.length === 0) {
    return {
      kind: "never",
      lastSuccessAt: null,
      lastAttemptAt: null,
      lastAttemptStatus: null,
      running: false,
      runningSince: null,
    };
  }

  const latest = attempts[0];

  if (latest.attempt.status === "running") {
    const runningFor = params.now.getTime() - latest.startedAt;
    if (runningFor > PRICING_SYNC_RUNNING_STALE_MS) {
      const success = attempts.find((item) => item.attempt.status === "success");
      return {
        kind: "interrupted",
        lastSuccessAt: lastSuccessIso(success),
        lastAttemptAt: latest.attempt.startedAt,
        lastAttemptStatus: "running",
        running: false,
        runningSince: null,
      };
    }

    const prior = deriveResolvedState(attempts.slice(1), params.now);
    const runningSince = latest.attempt.startedAt;

    // Sem tentativa anterior, ou última resolvida já era sucesso fresco:
    // "em andamento" é informativo. Falha/atraso/nunca confirmada continuam
    // como estado principal e recebem o marcador de nova consulta.
    if (prior.kind === "fresh" || attempts.length === 1) {
      return {
        ...prior,
        kind: "running",
        running: true,
        runningSince,
      };
    }

    return {
      ...prior,
      running: true,
      runningSince,
    };
  }

  return {
    ...deriveResolvedState(attempts, params.now),
    running: false,
    runningSince: null,
  };
}
