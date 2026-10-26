/**
 * Derivação pura do estado da sincronização de tarifas (sem I/O).
 *
 * Regras:
 * - sucesso fresco (< 36h) e sem falha posterior remove o aviso;
 * - falha após o último sucesso mantém o aviso até um novo sucesso;
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
  lastAttemptAt: string | null;
  lastAttemptStatus: PricingSyncAttemptStatus | null;
}

function timeOf(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
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
    };
  }

  const attempts = params.attempts
    .map((attempt) => ({
      attempt,
      startedAt: timeOf(attempt.startedAt),
      finishedAt: timeOf(attempt.finishedAt),
    }))
    .filter((item): item is { attempt: PricingSyncAttemptSummary; startedAt: number; finishedAt: number | null } =>
      item.startedAt !== null,
    )
    .sort((a, b) => b.startedAt - a.startedAt);

  if (attempts.length === 0) {
    return {
      kind: "never",
      lastSuccessAt: null,
      lastAttemptAt: null,
      lastAttemptStatus: null,
    };
  }

  const latest = attempts[0];
  const success = attempts.find((item) => item.attempt.status === "success");
  const lastSuccessAt = success
    ? success.attempt.finishedAt ?? success.attempt.startedAt
    : null;

  if (latest.attempt.status === "running") {
    const runningFor = params.now.getTime() - latest.startedAt;
    return {
      kind:
        runningFor > PRICING_SYNC_RUNNING_STALE_MS ? "interrupted" : "running",
      lastSuccessAt,
      lastAttemptAt: latest.attempt.startedAt,
      lastAttemptStatus: "running",
    };
  }

  if (!success) {
    return {
      kind: "never",
      lastSuccessAt: null,
      lastAttemptAt: latest.attempt.startedAt,
      lastAttemptStatus: latest.attempt.status,
    };
  }

  const successTime = success.finishedAt ?? success.startedAt;
  if (latest.attempt.status === "failed" && latest.startedAt > successTime) {
    return {
      kind: "failed",
      lastSuccessAt,
      lastAttemptAt: latest.attempt.startedAt,
      lastAttemptStatus: "failed",
    };
  }

  if (params.now.getTime() - successTime > PRICING_SYNC_STALE_MS) {
    return {
      kind: "stale",
      lastSuccessAt,
      lastAttemptAt: latest.attempt.startedAt,
      lastAttemptStatus: latest.attempt.status,
    };
  }

  return {
    kind: "fresh",
    lastSuccessAt,
    lastAttemptAt: latest.attempt.startedAt,
    lastAttemptStatus: latest.attempt.status,
  };
}
