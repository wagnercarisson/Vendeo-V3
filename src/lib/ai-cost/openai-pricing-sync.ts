import "server-only";
import {
  OPENAI_PRICING_INVENTORY,
  OPENAI_PRICING_MODELS,
  OPENAI_PRICING_PROVIDER,
  OPENAI_PRICING_SOURCE_URL,
} from "./openai-pricing-inventory";
import {
  fetchOpenAiPricingDocument,
  OpenAiPricingFetchError,
  type FetchedOpenAiPricingDocument,
  type OpenAiPricingFetch,
} from "./openai-pricing-fetch";
import {
  OpenAiPricingParseError,
  parseOpenAiStandardPricing,
} from "./openai-pricing-parser";
import {
  PricingSyncStoreError,
  type PricingSyncApplyResult,
  type PricingSyncCurrentRow,
  type PricingSyncDesiredPrice,
  type PricingSyncStore,
} from "./openai-pricing-sync-store";

/**
 * Orquestra UMA tentativa de sincronização:
 *   1. start persistente (concorrência/estado);
 *   2. fetch público do documento oficial;
 *   3. parsing determinístico da tabela Standard;
 *   4. validação do inventário e da tabela persistida;
 *   5. apply atômico via RPC (versionamento + registro de sucesso);
 *   6. em qualquer falha, registro seguro da falha e retorno `failed`.
 *
 * Nunca retorna sucesso se o apply não foi confirmado. Nunca expõe conteúdo
 * bruto, stack ou mensagem SQL/provider na resposta.
 */

export type OpenAiPricingSyncResult =
  | ({
      status: "success";
      attemptId: string;
    } & PricingSyncApplyResult)
  | {
      status: "failed";
      attemptId: string | null;
      stage: string;
      code: string;
    }
  | {
      status: "skipped";
      reason: string;
    };

export interface OpenAiPricingSyncLogger {
  info(message: string, metadata: Record<string, unknown>): void;
  error(message: string, metadata: Record<string, unknown>): void;
}

export interface OpenAiPricingSyncDependencies {
  fetchDocument?: () => Promise<FetchedOpenAiPricingDocument>;
  fetchImpl?: OpenAiPricingFetch;
  store?: PricingSyncStore;
  logger?: OpenAiPricingSyncLogger;
}

export class OpenAiPricingValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "OpenAiPricingValidationError";
  }
}

const defaultLogger: OpenAiPricingSyncLogger = {
  info: (message, metadata) => console.info(message, metadata),
  error: (message, metadata) => console.error(message, metadata),
};

function failureFor(
  error: unknown,
  fallbackStage: string,
): { stage: string; code: string } {
  if (error instanceof OpenAiPricingFetchError) {
    return { stage: "fetch", code: `fetch_${error.code}` };
  }
  if (error instanceof OpenAiPricingParseError) {
    return { stage: "parse", code: `parse_${error.code}` };
  }
  if (error instanceof OpenAiPricingValidationError) {
    return { stage: "validate", code: `validate_${error.code}` };
  }
  if (error instanceof PricingSyncStoreError) {
    return { stage: error.stage, code: error.code };
  }
  return { stage: fallbackStage, code: "unexpected_failure" };
}

function assertNoAmbiguousCurrentRows(rows: readonly PricingSyncCurrentRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.provider}|${row.model}|${row.quality ?? "null"}`;
    if (seen.has(key)) {
      throw new OpenAiPricingValidationError("pricing_table_ambiguous");
    }
    seen.add(key);
  }
}

function expandToDesiredPrices(
  parsed: ReturnType<typeof parseOpenAiStandardPricing>,
): PricingSyncDesiredPrice[] {
  const byModel = new Map(parsed.map((item) => [item.model, item]));
  const desired: PricingSyncDesiredPrice[] = [];

  for (const entry of OPENAI_PRICING_INVENTORY) {
    const item = byModel.get(entry.model);
    if (!item) {
      throw new OpenAiPricingValidationError(`inventory_missing_${entry.model}`);
    }
    for (const quality of entry.qualities) {
      desired.push({
        provider: OPENAI_PRICING_PROVIDER,
        model: entry.model,
        quality,
        inputTokenUsdPer1M: item.inputTextUsdPer1M,
        outputTokenUsdPer1M: item.outputTextUsdPer1M,
        cachedInputTokenUsdPer1M: item.cachedInputTextUsdPer1M,
        imageTokenUsdPer1M: item.outputImageUsdPer1M,
        imageInputTokenUsdPer1M: item.inputImageUsdPer1M,
        imageCachedInputTokenUsdPer1M: item.cachedInputImageUsdPer1M,
      });
    }
  }

  return desired;
}

export async function runOpenAiPricingSync(
  deps: OpenAiPricingSyncDependencies = {},
): Promise<OpenAiPricingSyncResult> {
  const logger = deps.logger ?? defaultLogger;
  let store = deps.store;
  if (!store) {
    // Import tardio: testes offline injetam um store fake e não carregam o
    // client Supabase.
    const { SupabasePricingSyncStore } = await import("./openai-pricing-sync-store");
    store = new SupabasePricingSyncStore();
  }
  const fetchDocument =
    deps.fetchDocument ??
    (() => fetchOpenAiPricingDocument(deps.fetchImpl));

  let attemptId: string;
  try {
    const attempt = await store.startAttempt(OPENAI_PRICING_SOURCE_URL);
    if (!attempt.started) {
      logger.info("[openai-pricing-sync] skipped", { reason: attempt.reason });
      return { status: "skipped", reason: attempt.reason };
    }
    attemptId = attempt.attemptId;
  } catch (err) {
    const failure = failureFor(err, "start");
    logger.error("[openai-pricing-sync] failed", failure);
    return {
      status: "failed",
      attemptId: null,
      stage: "start",
      code: failure.code,
    };
  }

  let stage = "fetch";
  try {
    const document = await fetchDocument();

    stage = "parse";
    const parsed = parseOpenAiStandardPricing(
      document.content,
      OPENAI_PRICING_INVENTORY,
    );
    if (parsed.length !== OPENAI_PRICING_INVENTORY.length) {
      throw new OpenAiPricingValidationError("inventory_incomplete");
    }

    stage = "validate";
    const currentRows = await store.readCurrentPrices(OPENAI_PRICING_MODELS);
    assertNoAmbiguousCurrentRows(currentRows);

    const prices = expandToDesiredPrices(parsed);

    stage = "apply";
    const applied = await store.applyPrices({
      attemptId,
      sourceUrl: document.sourceUrl,
      contentHash: document.contentHash,
      etag: document.etag,
      lastModified: document.lastModified,
      modelsChecked: parsed.length,
      prices,
    });

    logger.info("[openai-pricing-sync] success", {
      attemptId,
      modelsChecked: applied.modelsChecked,
      pricesChecked: applied.pricesChecked,
      pricesChanged: applied.pricesChanged,
    });

    return { status: "success", attemptId, ...applied };
  } catch (err) {
    const failure = failureFor(err, stage);

    try {
      await store.failAttempt(attemptId, failure.stage, failure.code);
    } catch (recordError) {
      const recordFailure = failureFor(recordError, "record");
      // O resultado já é falha; nunca promovemos para sucesso por falha de registro.
      logger.error("[openai-pricing-sync] failure-record-failed", {
        attemptId,
        stage: recordFailure.stage,
        code: recordFailure.code,
      });
    }

    logger.error("[openai-pricing-sync] failed", {
      attemptId,
      stage: failure.stage,
      code: failure.code,
    });

    return {
      status: "failed",
      attemptId,
      stage: failure.stage,
      code: failure.code,
    };
  }
}
