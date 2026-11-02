import {
  addOutcome,
  buildBackfillReport,
  classifyStorageFailure,
  emptyCounters,
  isEligibleInventoryPath,
  type BackfillOutcome,
  type BackfillReportCounters,
  type BackfillReportItem,
  type BackfillStorageError,
} from "./backfill-selection";
import {
  normalizeEndpoint,
  type ThumbnailContext,
  type ThumbnailResult,
} from "./thumbnail-generator";
import { deriveThumbnailPath } from "./thumbnail-path";

/**
 * Runner testável do preenchimento. Todas as dependências externas entram por
 * injeção — os testes provam dry-run sem escrita, guardas sem chamadas,
 * limites/concorrência e retomada sem tocar Storage real.
 */

export type BackfillEnv = "local" | "homolog" | "production";

export interface BackfillCandidate {
  campaignId: string;
  storeId: string;
  originalPath: string;
  createdAt: string;
}

export interface BackfillPageInput {
  after: string | null;
  limit: number;
  stores?: string[];
  campaigns?: string[];
}

export interface BackfillPage {
  items: BackfillCandidate[];
  nextCursor: string | null;
}

export interface BackfillDeps {
  listCampaignsPage(input: BackfillPageInput): Promise<BackfillPage>;
  downloadOriginal(path: string): Promise<{
    data: Buffer | null;
    error?: BackfillStorageError | null;
  }>;
  thumbnailExists(path: string): Promise<{
    exists: boolean;
    error?: unknown;
  }>;
  /** Inspeção somente leitura do original (header) para o dry-run. */
  inspectOriginal(buffer: Buffer): Promise<{
    format: string;
    width: number;
    height: number;
  } | null>;
  generate(input: {
    originalPath: string;
    originalBuffer: Buffer;
    context: ThumbnailContext | null;
  }): Promise<ThumbnailResult>;
  now?: () => number;
}

export interface BackfillOptions {
  mode: "dry-run" | "write";
  env: BackfillEnv;
  /** Origem exata esperada (declarada pelo operador). */
  expectedEndpoint: string;
  /** Origem efetiva do client que será usado. */
  actualEndpoint: string;
  confirmEnv?: string | null;
  limit: number;
  batchSize: number;
  concurrency: number;
  after?: string | null;
  context?: ThumbnailContext | null;
  stores?: string[];
  campaigns?: string[];
}

export interface BackfillResult {
  blockedReason?: string;
  report: {
    mode: "dry-run" | "write";
    env: string;
    endpoint: string;
    startedAt: string;
    finishedAt: string;
    cursor: string | null;
    counters: BackfillReportCounters;
    items: BackfillReportItem[];
    blockedReason?: string;
  };
}

const MAX_CONCURRENCY = 4;
const MAX_LIMIT = 500;

function validateGuard(options: BackfillOptions): string | null {
  if (options.env === "homolog" || options.env === "production") {
    return "target_env_blocked";
  }
  const expected = normalizeEndpoint(options.expectedEndpoint);
  const actual = normalizeEndpoint(options.actualEndpoint);
  if (!expected || !actual || expected !== actual) {
    return "endpoint_mismatch";
  }
  if (options.mode === "write") {
    if (options.confirmEnv !== options.env) return "write_not_confirmed";
    if (!options.context) return "thumbnail_context_missing";
    const contextEndpoint = normalizeEndpoint(options.context.endpoint);
    const uploaderEndpoint = normalizeEndpoint(options.context.uploader.endpoint);
    if (
      !contextEndpoint ||
      !uploaderEndpoint ||
      contextEndpoint !== actual ||
      uploaderEndpoint !== actual
    ) {
      return "context_endpoint_mismatch";
    }
  }
  if (!Number.isInteger(options.limit) || options.limit <= 0 || options.limit > MAX_LIMIT) {
    return "invalid_limit";
  }
  if (
    !Number.isInteger(options.batchSize) ||
    options.batchSize <= 0 ||
    options.batchSize > MAX_LIMIT
  ) {
    return "invalid_batch_size";
  }
  if (
    !Number.isInteger(options.concurrency) ||
    options.concurrency <= 0 ||
    options.concurrency > MAX_CONCURRENCY
  ) {
    return "invalid_concurrency";
  }
  return null;
}

async function mapLimited<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

function extractErrorReason(
  result: ThumbnailResult,
): { outcome: BackfillOutcome; reason?: string } {
  if (result.status === "created") return { outcome: "created" };
  if (result.status === "already_exists") return { outcome: "already_exists" };
  if (result.status === "failed") {
    if (result.reason === "thumbnail_generation_failed" || result.reason === "thumbnail_invalid_output") {
      return { outcome: "invalid_format", reason: result.reason };
    }
    return { outcome: "failed", reason: result.reason };
  }
  return { outcome: "ineligible", reason: result.reason };
}

export async function runBackfill(input: {
  deps: BackfillDeps;
  options: BackfillOptions;
}): Promise<BackfillResult> {
  const { deps, options } = input;
  const now = deps.now ?? (() => Date.now());
  const startedMs = now();
  const startedAt = new Date(startedMs).toISOString();

  const blockedReason = validateGuard(options);
  if (blockedReason) {
    return {
      blockedReason,
      report: buildBackfillReport({
        mode: options.mode,
        env: options.env,
        endpoint: options.actualEndpoint,
        startedAt,
        finishedAt: new Date(now()).toISOString(),
        cursor: options.after ?? null,
        counters: emptyCounters(),
        items: [],
        blockedReason,
      }),
    };
  }

  const counters = emptyCounters();
  const items: BackfillReportItem[] = [];
  let cursor = options.after ?? null;
  let remaining = options.limit;

  while (remaining > 0) {
    const pageLimit = Math.min(options.batchSize, remaining);
    const page = await deps.listCampaignsPage({
      after: cursor,
      limit: pageLimit,
      stores: options.stores,
      campaigns: options.campaigns,
    });

    if (page.items.length === 0) {
      // Sem itens ⇒ fim do inventário: cursor nulo, nunca o cursor anterior.
      cursor = page.nextCursor;
      break;
    }

    const processed = await mapLimited(
      page.items,
      options.concurrency,
      async (candidate) => {
        const itemStart = now();
        const thumbnailPath = deriveThumbnailPath(candidate.originalPath);

        if (
          !thumbnailPath ||
          !isEligibleInventoryPath(candidate.originalPath, candidate.storeId)
        ) {
          return {
            campaignId: candidate.campaignId,
            storeId: candidate.storeId,
            originalPath: candidate.originalPath,
            thumbnailPath: null,
            outcome: "ineligible" as const,
            reason: "path_not_eligible",
            durationMs: now() - itemStart,
          };
        }

        let exists: { exists: boolean; error?: unknown };
        try {
          exists = await deps.thumbnailExists(thumbnailPath);
        } catch (error) {
          return {
            campaignId: candidate.campaignId,
            storeId: candidate.storeId,
            originalPath: candidate.originalPath,
            thumbnailPath,
            outcome: "access_error" as const,
            reason: "thumbnail_probe_failed",
            durationMs: now() - itemStart,
          };
        }

        if (exists.error) {
          return {
            campaignId: candidate.campaignId,
            storeId: candidate.storeId,
            originalPath: candidate.originalPath,
            thumbnailPath,
            outcome: "access_error" as const,
            reason: "thumbnail_probe_failed",
            durationMs: now() - itemStart,
          };
        }

        if (exists.exists) {
          return {
            campaignId: candidate.campaignId,
            storeId: candidate.storeId,
            originalPath: candidate.originalPath,
            thumbnailPath,
            outcome: "already_exists" as const,
            durationMs: now() - itemStart,
          };
        }

        let original: { data: Buffer | null; error?: BackfillStorageError | null };
        try {
          original = await deps.downloadOriginal(candidate.originalPath);
        } catch (error) {
          return {
            campaignId: candidate.campaignId,
            storeId: candidate.storeId,
            originalPath: candidate.originalPath,
            thumbnailPath,
            outcome: classifyStorageFailure(error),
            reason: "download_threw",
            durationMs: now() - itemStart,
          };
        }

        if (original.error) {
          return {
            campaignId: candidate.campaignId,
            storeId: candidate.storeId,
            originalPath: candidate.originalPath,
            thumbnailPath,
            outcome: classifyStorageFailure(original.error),
            reason: "download_failed",
            durationMs: now() - itemStart,
          };
        }

        if (!original.data || original.data.length === 0) {
          return {
            campaignId: candidate.campaignId,
            storeId: candidate.storeId,
            originalPath: candidate.originalPath,
            thumbnailPath,
            outcome: "invalid_format" as const,
            reason: "empty_original",
            durationMs: now() - itemStart,
          };
        }

        if (options.mode === "dry-run") {
          const inspection = await deps.inspectOriginal(original.data);
          if (!inspection) {
            return {
              campaignId: candidate.campaignId,
              storeId: candidate.storeId,
              originalPath: candidate.originalPath,
              thumbnailPath,
              outcome: "invalid_format" as const,
              reason: "unsupported_or_corrupt_image",
              durationMs: now() - itemStart,
            };
          }
          return {
            campaignId: candidate.campaignId,
            storeId: candidate.storeId,
            originalPath: candidate.originalPath,
            thumbnailPath,
            outcome: "would_create" as const,
            durationMs: now() - itemStart,
          };
        }

        const generated = await deps.generate({
          originalPath: candidate.originalPath,
          originalBuffer: original.data,
          context: options.context ?? null,
        });
        const mapped = extractErrorReason(generated);
        return {
          campaignId: candidate.campaignId,
          storeId: candidate.storeId,
          originalPath: candidate.originalPath,
          thumbnailPath,
          outcome: mapped.outcome,
          reason: mapped.reason,
          durationMs: now() - itemStart,
        };
      },
    );

    for (const item of processed) {
      items.push(item);
      addOutcome(counters, item);
    }

    remaining -= page.items.length;

    // Cursor ÚNICO: sempre o cursor opaco fornecido pelo inventário
    // (keyset `created_at|id`). Nunca derivar do UUID da campanha.
    cursor = page.nextCursor;
    if (page.nextCursor === null) {
      break;
    }
  }

  return {
    report: buildBackfillReport({
      mode: options.mode,
      env: options.env,
      endpoint: options.actualEndpoint,
      startedAt,
      finishedAt: new Date(now()).toISOString(),
      cursor,
      counters,
      items,
    }),
  };
}
