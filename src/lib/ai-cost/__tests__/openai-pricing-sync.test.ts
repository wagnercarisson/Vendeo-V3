import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import {
  runOpenAiPricingSync,
  type OpenAiPricingSyncLogger,
} from "../openai-pricing-sync";
import { OpenAiPricingFetchError } from "../openai-pricing-fetch";
import { PricingSyncStoreError } from "../openai-pricing-sync-store";
import type {
  PricingSyncCurrentRow,
  PricingSyncDesiredPrice,
  PricingSyncStore,
} from "../openai-pricing-sync-store";

const FIXTURE = readFileSync(
  resolve(
    process.cwd(),
    "src/lib/ai-cost/__tests__/fixtures/openai-pricing-standard.md",
  ),
  "utf8",
);

const DOCUMENT = {
  sourceUrl: "https://developers.openai.com/api/docs/pricing.md",
  content: FIXTURE,
  contentHash: "abc123",
  etag: '"etag-1"',
  lastModified: "Mon, 26 Oct 2026 18:29:12 GMT",
};

function currentRow(overrides: Partial<PricingSyncCurrentRow> = {}): PricingSyncCurrentRow {
  return {
    id: "pricing-1",
    provider: "openai",
    model: "gpt-5.5",
    quality: null,
    inputTokenUsdPer1M: 5,
    outputTokenUsdPer1M: 30,
    cachedInputTokenUsdPer1M: 0.5,
    imageUnitUsd: null,
    imageTokenUsdPer1M: null,
    imageInputTokenUsdPer1M: null,
    imageCachedInputTokenUsdPer1M: null,
    effectiveFrom: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeStore(overrides: Partial<PricingSyncStore> = {}) {
  const applyPrices = vi.fn(async () => ({
    modelsChecked: 7,
    pricesChecked: 11,
    pricesChanged: 3,
  }));
  const failAttempt = vi.fn(async () => {});
  const startAttempt = vi.fn(async () => ({
    started: true as const,
    attemptId: "attempt-1",
  }));
  const readCurrentPrices = vi.fn(async () => [currentRow(), currentRow({ id: "pricing-2", model: "gpt-4o" })]);

  const store: PricingSyncStore = {
    startAttempt,
    readCurrentPrices,
    applyPrices,
    failAttempt,
    ...overrides,
  };

  return { store, startAttempt, readCurrentPrices, applyPrices, failAttempt };
}

function makeLogger(): OpenAiPricingSyncLogger & {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

function appliedPrices(applyPrices: ReturnType<typeof vi.fn>): PricingSyncDesiredPrice[] {
  return applyPrices.mock.calls[0][0].prices as PricingSyncDesiredPrice[];
}

describe("runOpenAiPricingSync — sucesso, falha e atomicidade", () => {
  it("sucesso com mudanças: envia inventário completo e registra contagens do apply", async () => {
    const { store, applyPrices, failAttempt } = makeStore();
    const logger = makeLogger();

    const result = await runOpenAiPricingSync({
      store,
      fetchDocument: async () => DOCUMENT,
      logger,
    });

    expect(result).toEqual({
      status: "success",
      attemptId: "attempt-1",
      modelsChecked: 7,
      pricesChecked: 11,
      pricesChanged: 3,
    });
    expect(failAttempt).not.toHaveBeenCalled();
    expect(applyPrices).toHaveBeenCalledTimes(1);

    const prices = appliedPrices(applyPrices);
    expect(prices).toHaveLength(11);

    const gpt55 = prices.find((row) => row.model === "gpt-5.5");
    expect(gpt55).toMatchObject({
      provider: "openai",
      quality: null,
      inputTokenUsdPer1M: 5,
      cachedInputTokenUsdPer1M: 0.5,
      outputTokenUsdPer1M: 30,
      imageInputTokenUsdPer1M: null,
      imageTokenUsdPer1M: null,
    });

    const flareLow = prices.find(
      (row) => row.model === "gpt-image-2.5-flare" && row.quality === "low",
    );
    expect(flareLow).toMatchObject({
      inputTokenUsdPer1M: 5,
      cachedInputTokenUsdPer1M: 1.25,
      outputTokenUsdPer1M: null,
      imageInputTokenUsdPer1M: 8,
      imageCachedInputTokenUsdPer1M: 2,
      imageTokenUsdPer1M: 30,
    });

    // O payload NÃO inclui image_unit_usd (unidade separada; preservada pelo RPC).
    expect(flareLow).not.toHaveProperty("imageUnitUsd");
  });

  it("preços iguais: sucesso sem versões novas (changed=0)", async () => {
    const { store, applyPrices, failAttempt } = makeStore();
    applyPrices.mockResolvedValue({
      modelsChecked: 7,
      pricesChecked: 11,
      pricesChanged: 0,
    });

    const result = await runOpenAiPricingSync({
      store,
      fetchDocument: async () => DOCUMENT,
      logger: makeLogger(),
    });

    expect(result).toMatchObject({ status: "success", pricesChanged: 0 });
    expect(applyPrices).toHaveBeenCalledTimes(1);
    expect(failAttempt).not.toHaveBeenCalled();
  });

  it("falha de fetch → registra falha segura e não aplica", async () => {
    const { store, applyPrices, failAttempt } = makeStore();

    const result = await runOpenAiPricingSync({
      store,
      fetchDocument: async () => {
        throw new OpenAiPricingFetchError("http_503");
      },
      logger: makeLogger(),
    });

    expect(result).toEqual({
      status: "failed",
      attemptId: "attempt-1",
      stage: "fetch",
      code: "fetch_http_503",
    });
    expect(applyPrices).not.toHaveBeenCalled();
    expect(failAttempt).toHaveBeenCalledWith("attempt-1", "fetch", "fetch_http_503");
  });

  it("documento inesperado/parsing inválido → falha de parse", async () => {
    const { store, applyPrices, failAttempt } = makeStore();

    const result = await runOpenAiPricingSync({
      store,
      fetchDocument: async () => ({ ...DOCUMENT, content: "# Pricing\nsem tabela" }),
      logger: makeLogger(),
    });

    expect(result).toMatchObject({
      status: "failed",
      stage: "parse",
      code: "parse_missing_model",
    });
    expect(applyPrices).not.toHaveBeenCalled();
    expect(failAttempt).toHaveBeenCalledWith(
      "attempt-1",
      "parse",
      "parse_missing_model",
    );
  });

  it("cache aplicável não confirmado ('-') → falha a tentativa inteira, sem apply", async () => {
    const { store, applyPrices, failAttempt } = makeStore();
    const content = FIXTURE.replace(
      "| gpt-4o | $2.50 | $10.00 | $1.25 |",
      "| gpt-4o | $2.50 | $10.00 | - |",
    );

    const result = await runOpenAiPricingSync({
      store,
      fetchDocument: async () => ({ ...DOCUMENT, content }),
      logger: makeLogger(),
    });

    expect(result).toMatchObject({
      status: "failed",
      stage: "parse",
      code: "parse_not_applicable_dimension",
    });
    expect(applyPrices).not.toHaveBeenCalled();
    expect(failAttempt).toHaveBeenCalledWith(
      "attempt-1",
      "parse",
      "parse_not_applicable_dimension",
    );
  });

  it("falha no apply → retorna failed (nunca sucesso) e registra", async () => {
    const { store, failAttempt } = makeStore({
      applyPrices: vi.fn(async () => {
        throw new PricingSyncStoreError("apply", "apply_failed");
      }),
    });

    const result = await runOpenAiPricingSync({
      store,
      fetchDocument: async () => DOCUMENT,
      logger: makeLogger(),
    });

    expect(result).toMatchObject({
      status: "failed",
      stage: "apply",
      code: "apply_failed",
    });
    expect(failAttempt).toHaveBeenCalledWith("attempt-1", "apply", "apply_failed");
  });

  it("tabela persistida ambígua → falha de validação, sem apply", async () => {
    const { store, applyPrices, failAttempt } = makeStore({
      readCurrentPrices: vi.fn(async () => [
        currentRow(),
        currentRow({ id: "pricing-dup" }),
      ]),
    });

    const result = await runOpenAiPricingSync({
      store,
      fetchDocument: async () => DOCUMENT,
      logger: makeLogger(),
    });

    expect(result).toMatchObject({
      status: "failed",
      stage: "validate",
      code: "validate_pricing_table_ambiguous",
    });
    expect(applyPrices).not.toHaveBeenCalled();
    expect(failAttempt).toHaveBeenCalledWith(
      "attempt-1",
      "validate",
      "validate_pricing_table_ambiguous",
    );
  });

  it("tentativa concorrente (start=false) → skipped, sem fetch/apply", async () => {
    const { store, applyPrices, failAttempt } = makeStore({
      startAttempt: vi.fn(async () => ({
        started: false as const,
        reason: "already_running",
      })),
    });
    const fetchDocument = vi.fn(async () => DOCUMENT);

    const result = await runOpenAiPricingSync({
      store,
      fetchDocument,
      logger: makeLogger(),
    });

    expect(result).toEqual({ status: "skipped", reason: "already_running" });
    expect(fetchDocument).not.toHaveBeenCalled();
    expect(applyPrices).not.toHaveBeenCalled();
    expect(failAttempt).not.toHaveBeenCalled();
  });

  it("falha ao registrar a falha NÃO retorna sucesso", async () => {
    const { store } = makeStore({
      failAttempt: vi.fn(async () => {
        throw new PricingSyncStoreError("record", "failure_record_failed");
      }),
    });
    const logger = makeLogger();

    const result = await runOpenAiPricingSync({
      store,
      fetchDocument: async () => {
        throw new OpenAiPricingFetchError("timeout");
      },
      logger,
    });

    expect(result.status).toBe("failed");
    expect(logger.error).toHaveBeenCalledWith(
      "[openai-pricing-sync] failure-record-failed",
      expect.objectContaining({ code: "failure_record_failed" }),
    );
  });

  it("recuperação posterior: falha seguida de sucesso registra nova tentativa", async () => {
    let call = 0;
    const store = makeStore();
    const fetchDocument = vi.fn(async () => {
      call += 1;
      if (call === 1) throw new OpenAiPricingFetchError("network_error");
      return DOCUMENT;
    });

    const first = await runOpenAiPricingSync({
      store: store.store,
      fetchDocument,
      logger: makeLogger(),
    });
    const second = await runOpenAiPricingSync({
      store: store.store,
      fetchDocument,
      logger: makeLogger(),
    });

    expect(first.status).toBe("failed");
    expect(second.status).toBe("success");
    expect(store.failAttempt).toHaveBeenCalledTimes(1);
    expect(store.applyPrices).toHaveBeenCalledTimes(1);
  });

  it("falha de leitura da tabela persistida → estágio read_pricing", async () => {
    const { store, applyPrices } = makeStore({
      readCurrentPrices: vi.fn(async () => {
        throw new PricingSyncStoreError("read_pricing", "read_failed");
      }),
    });

    const result = await runOpenAiPricingSync({
      store,
      fetchDocument: async () => DOCUMENT,
      logger: makeLogger(),
    });

    expect(result).toMatchObject({
      status: "failed",
      stage: "read_pricing",
      code: "read_failed",
    });
    expect(applyPrices).not.toHaveBeenCalled();
  });

  it("erro inesperado não vaza mensagem bruta", async () => {
    const { store } = makeStore({
      applyPrices: vi.fn(async () => {
        throw new Error("SQLSTATE 23505: duplicate key DETAIL: secret");
      }),
    });

    const result = await runOpenAiPricingSync({
      store,
      fetchDocument: async () => DOCUMENT,
      logger: makeLogger(),
    });

    expect(result).toEqual({
      status: "failed",
      attemptId: "attempt-1",
      stage: "apply",
      code: "unexpected_failure",
    });
    expect(JSON.stringify(result)).not.toContain("SQLSTATE");
  });
});
