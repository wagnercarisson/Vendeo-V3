import { deriveThumbnailPath } from "./thumbnail-path";

/**
 * Regras puras do preenchimento de miniaturas do legado.
 *
 * O inventário é sempre canônico (`campaigns.storage_path`); nunca varremos o
 * bucket. Este módulo só classifica paths/erros e agrega o relatório.
 */

export interface BackfillCursor {
  /**
   * `created_at` EXATAMENTE como persistido (texto), preservando
   * microssegundos. NUNCA passar por `Date`/`toISOString()`: isso truncaria
   * para milissegundos e repetiria a própria linha como "posterior".
   */
  createdAt: string;
  campaignId: string;
}

const BACKFILL_CAMPAIGN_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Timestamp ISO 8601 aceito no cursor: data/hora com 1–6 casas fracionárias
 * (PostgreSQL) e timezone `Z` ou `±HH:MM`. Validação ESTRITA antes de
 * interpolar no filtro PostgREST.
 */
export function isValidBackfillTimestamp(value: string): boolean {
  if (typeof value !== "string") return false;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offset = match[8];

  if (year < 1 || month < 1 || month > 12) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;

  const leap =
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (day < 1 || day > daysInMonth[month - 1]) return false;

  if (offset !== "Z") {
    const offsetHour = Number(offset.slice(1, 3));
    const offsetMinute = Number(offset.slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59) return false;
    if (offsetHour === 14 && offsetMinute !== 0) return false;
  }

  return true;
}

/**
 * Cursor opaco ÚNICO do backfill: keyset por `(created_at, id)`.
 * Formato: `<createdAt EXATO>|<campaignId>`.
 */
export function encodeBackfillCursor(cursor: BackfillCursor): string {
  if (!isValidBackfillTimestamp(cursor.createdAt)) {
    throw new Error("invalid_cursor_timestamp");
  }
  if (!BACKFILL_CAMPAIGN_ID_RE.test(cursor.campaignId)) {
    throw new Error("invalid_cursor_campaign_id");
  }
  // Concatenação pura: preserva os microssegundos do texto persistido.
  return `${cursor.createdAt}|${cursor.campaignId}`;
}

export function parseBackfillCursor(raw: string | null): BackfillCursor | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const separator = raw.lastIndexOf("|");
  if (separator <= 0) return null;
  const createdAt = raw.slice(0, separator);
  const campaignId = raw.slice(separator + 1);
  if (!isValidBackfillTimestamp(createdAt)) return null;
  if (!BACKFILL_CAMPAIGN_ID_RE.test(campaignId)) return null;
  return { createdAt, campaignId };
}

/** Filtro PostgREST keyset, sempre com o timestamp EXATO do cursor. */
export function buildBackfillKeysetFilter(cursor: BackfillCursor): string {
  return `created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.campaignId})`;
}

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
