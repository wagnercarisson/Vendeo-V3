import { deriveThumbnailPath } from "./thumbnail-path";

/**
 * Regras puras do preenchimento de miniaturas do legado.
 *
 * O inventário é sempre canônico (`campaigns.storage_path`); nunca varremos o
 * bucket. Este módulo só classifica paths/erros e agrega o relatório.
 */

export type BackfillOutcome =
  | "would_create"
  | "created"
  | "already_exists"
  | "missing_original"
  | "access_error"
  | "invalid_format"
  | "ineligible"
  | "failed";

export interface BackfillStorageError {
  message?: string;
  statusCode?: string | number;
}

export function isEligibleInventoryPath(
  path: string,
  storeId: string,
): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  if (typeof storeId !== "string" || storeId.length === 0) return false;
  if (!path.startsWith(`${storeId}/`)) return false;
  return deriveThumbnailPath(path) !== null;
}

/**
 * 404 só é ausência quando prova que o OBJETO não existe no bucket esperado.
 * 404 de bucket, auth, rede/timeout e mensagens vazias são erro de acesso.
 */
export function isMissingObjectError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const record = error as { message?: unknown; statusCode?: unknown };
  if (String(record.statusCode ?? "") !== "404") return false;
  const text = String(record.message ?? "").toLowerCase();
  if (text.includes("bucket")) return false;
  return /object not found/i.test(text) || /object does not exist/i.test(text);
}

export function classifyStorageFailure(
  error: unknown,
): "missing_original" | "access_error" {
  return isMissingObjectError(error) ? "missing_original" : "access_error";
}

export interface BackfillReportCounters {
  seen: number;
  eligible: number;
  ineligible: number;
  wouldCreate: number;
  created: number;
  alreadyExists: number;
  missingOriginal: number;
  accessError: number;
  invalidFormat: number;
  failed: number;
}

export interface BackfillReportItem {
  campaignId: string;
  storeId: string;
  originalPath: string;
  thumbnailPath: string | null;
  outcome: BackfillOutcome;
  reason?: string;
  durationMs: number;
}

const COUNTER_BY_OUTCOME: Record<
  BackfillOutcome,
  keyof BackfillReportCounters | null
> = {
  would_create: "wouldCreate",
  created: "created",
  already_exists: "alreadyExists",
  missing_original: "missingOriginal",
  access_error: "accessError",
  invalid_format: "invalidFormat",
  ineligible: "ineligible",
  failed: "failed",
};

export function emptyCounters(): BackfillReportCounters {
  return {
    seen: 0,
    eligible: 0,
    ineligible: 0,
    wouldCreate: 0,
    created: 0,
    alreadyExists: 0,
    missingOriginal: 0,
    accessError: 0,
    invalidFormat: 0,
    failed: 0,
  };
}

export function addOutcome(
  counters: BackfillReportCounters,
  item: BackfillReportItem,
): void {
  counters.seen += 1;
  if (item.outcome === "ineligible") {
    counters.ineligible += 1;
    return;
  }
  counters.eligible += 1;
  const key = COUNTER_BY_OUTCOME[item.outcome];
  if (key) counters[key] += 1;
}

export function buildBackfillReport(input: {
  mode: "dry-run" | "write";
  env: string;
  endpoint: string;
  startedAt: string;
  finishedAt: string;
  cursor: string | null;
  counters: BackfillReportCounters;
  items: BackfillReportItem[];
  blockedReason?: string;
}): {
  mode: "dry-run" | "write";
  env: string;
  endpoint: string;
  startedAt: string;
  finishedAt: string;
  cursor: string | null;
  counters: BackfillReportCounters;
  items: BackfillReportItem[];
  blockedReason?: string;
} {
  return { ...input };
}
