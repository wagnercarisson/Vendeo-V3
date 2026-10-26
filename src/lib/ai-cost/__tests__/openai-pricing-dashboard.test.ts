import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAiPricingDashboard } from "../openai-pricing-dashboard";

interface FakeResult {
  data: unknown;
  error: { message: string } | null;
}

function builder(result: FakeResult) {
  const query: Record<string, unknown> = {
    select: () => query,
    eq: () => query,
    in: () => query,
    is: () => query,
    order: () => query,
    limit: () => query,
    then: (resolve: (value: FakeResult) => unknown) => resolve(result),
  };
  return query;
}

function fakeClient(params: {
  prices: FakeResult;
  attempts: FakeResult;
}): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      if (table === "ai_model_pricing") return builder(params.prices);
      if (table === "pricing_sync_attempts") return builder(params.attempts);
      throw new Error(`tabela inesperada: ${table}`);
    }),
  } as unknown as SupabaseClient;
}

const PRICES = [
  {
    id: "row-flare",
    provider: "openai",
    model: "gpt-image-2.5-flare",
    quality: "low",
    input_token_usd_per_1m: "5",
    output_token_usd_per_1m: null,
    cached_input_token_usd_per_1m: "1.25",
    image_unit_usd: "0.036",
    image_token_usd_per_1m: "30",
    image_input_token_usd_per_1m: "8",
    image_cached_input_token_usd_per_1m: "2",
    effective_from: "2026-10-25T12:00:00.000Z",
  },
  {
    id: "row-gpt55",
    provider: "openai",
    model: "gpt-5.5",
    quality: null,
    input_token_usd_per_1m: "5",
    output_token_usd_per_1m: "30",
    cached_input_token_usd_per_1m: "0.5",
    image_unit_usd: null,
    image_token_usd_per_1m: null,
    image_input_token_usd_per_1m: null,
    image_cached_input_token_usd_per_1m: null,
    effective_from: "2026-10-20T10:00:00.000Z",
  },
];

const ATTEMPTS = [
  {
    id: "attempt-1",
    status: "success",
    started_at: "2026-10-26T19:00:00.000Z",
    finished_at: "2026-10-26T19:01:00.000Z",
    failure_stage: null,
    failure_code: null,
  },
];

describe("getOpenAiPricingDashboard — leitura dos valores persistidos", () => {
  it("mapeia NUMERIC, ordena pelo inventário e deriva datas/estado", async () => {
    const result = await getOpenAiPricingDashboard({
      client: fakeClient({
        prices: { data: PRICES, error: null },
        attempts: { data: ATTEMPTS, error: null },
      }),
      now: new Date("2026-10-26T20:00:00.000Z"),
    });

    expect(result.pricesQueryFailed).toBe(false);
    expect(result.prices.map((row) => row.model)).toEqual([
      "gpt-5.5",
      "gpt-image-2.5-flare",
    ]);
    expect(result.prices[0]).toMatchObject({
      label: "GPT-5.5",
      inputTokenUsdPer1M: 5,
      outputTokenUsdPer1M: 30,
      cachedInputTokenUsdPer1M: 0.5,
      imageUnitUsd: null,
    });
    expect(result.prices[1]).toMatchObject({
      label: "GPT Image 2.5 Flare",
      quality: "low",
      inputTokenUsdPer1M: 5,
      inputImageTokenUsdPer1M: 8,
      cachedInputImageTokenUsdPer1M: 2,
      outputImageTokenUsdPer1M: 30,
      imageUnitUsd: 0.036,
    });
    expect(result.lastSuccessAt).toBe("2026-10-26T19:01:00.000Z");
    expect(result.lastPriceChangedAt).toBe("2026-10-25T12:00:00.000Z");
    expect(result.state.kind).toBe("fresh");
  });

  it("falha ao consultar tentativas → estado unavailable, preços ainda exibidos", async () => {
    const result = await getOpenAiPricingDashboard({
      client: fakeClient({
        prices: { data: PRICES, error: null },
        attempts: { data: null, error: { message: "relation does not exist" } },
      }),
      now: new Date("2026-10-26T20:00:00.000Z"),
    });

    expect(result.prices).toHaveLength(2);
    expect(result.state.kind).toBe("unavailable");
    expect(result.lastSuccessAt).toBeNull();
  });

  it("falha ao consultar preços → erro explícito, sem inventar tabela", async () => {
    const result = await getOpenAiPricingDashboard({
      client: fakeClient({
        prices: { data: null, error: { message: "permission denied" } },
        attempts: { data: ATTEMPTS, error: null },
      }),
      now: new Date("2026-10-26T20:00:00.000Z"),
    });

    expect(result.pricesQueryFailed).toBe(true);
    expect(result.prices).toEqual([]);
  });
});
