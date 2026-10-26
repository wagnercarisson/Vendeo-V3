import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
  process.env.OPENAI_API_KEY ??= "test-openai-key";
});

import { AiGateway } from "@/lib/ai/gateway";
import { UpstreamImagesAdapter } from "@/lib/ai/adapters/upstream-images";
import { DefaultAiTelemetrySink } from "@/lib/ai/telemetry-sink";
import type { AiModelConfig, AiModelResolver } from "@/lib/ai/model-resolver";
import type { AiEnvelopeInternalCost, AiTelemetryContext } from "@/lib/ai/types";
import type { UsageTokenPricing } from "@/lib/ai-cost/types";

const RAW_USAGE = {
  input_tokens: 2248,
  output_tokens: 439,
  total_tokens: 2687,
  input_tokens_details: { text_tokens: 464, image_tokens: 1784 },
  output_tokens_details: { image_tokens: 439 },
};

const TOKEN_PRICING: UsageTokenPricing = {
  inputCostUsd: 5,
  cachedInputCostUsd: 1.25,
  outputCostUsd: 10,
  imageInputTokenUsdPer1M: 8,
  imageCachedInputTokenUsdPer1M: 2,
  imageTokenUsdPer1M: 30,
};

const CONFIG: AiModelConfig = {
  capability: "campaign_product_image",
  segment: "image",
  primary: { provider: "openai", model: "gpt-image-2.5-sunburst", protocol: "images" },
  fallback: { provider: "openai", model: "gpt-image-2", protocol: "images" },
};

function makeResolver(config: AiModelConfig = CONFIG): AiModelResolver {
  return {
    resolve: vi.fn(async () => config),
    listCapabilities: vi.fn(() => [config.capability]),
  };
}

function makeAdapter(rawUsage: unknown = RAW_USAGE) {
  const edit = vi.fn(async () => ({
    data: [{ b64_json: "aGVsbG8=" }],
    usage: rawUsage,
  }));
  const adapter = new UpstreamImagesAdapter(async () => ({
    client: { images: { edit } },
    toFile: async (data: Buffer, name: string, options: { type: string }) => ({
      data,
      name,
      options,
    }),
  }));
  return { adapter, edit };
}

function makeGateway(rawUsage: unknown = RAW_USAGE) {
  const { adapter, edit } = makeAdapter(rawUsage);
  const gateway = new AiGateway(makeResolver(), {
    get: (protocol) => (protocol === "images" ? adapter : undefined),
  });
  return { gateway, edit };
}

function internalCostFor(params: {
  model: string;
  quality: string;
  pricing?: UsageTokenPricing;
  versionId?: string;
  preCallUsd?: number;
  source?: string;
}): AiEnvelopeInternalCost {
  return {
    estimatedCostUsd: params.preCallUsd ?? 0.041,
    pricingVersion: params.versionId ?? "pricing-ver-1",
    origin: "new_flow_pair_pricing",
    source: params.source ?? "pricing_table",
    model: params.model,
    quality: params.quality,
    settlement: "usage_tokens",
    tokenPricing: params.pricing ?? TOKEN_PRICING,
  };
}

function telemetryWith(
  internalCost: AiEnvelopeInternalCost,
  tracker: { record: ReturnType<typeof vi.fn> },
): AiTelemetryContext {
  const sink = new DefaultAiTelemetrySink(
    {
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      traceId: "trace-1",
      storeId: "store-1",
      campaignId: "campaign-1",
      attemptNumber: 1,
      internalCost,
    },
    tracker as never,
  );
  return {
    operationRunId: "run-1",
    operationRunType: "campaign_delivery",
    traceId: "trace-1",
    storeId: "store-1",
    campaignId: "campaign-1",
    attemptNumber: 1,
    sink,
  };
}

const REQUEST = {
  prompt: "gerar imagem do produto",
  quality: "medium",
  size: "1024x1024",
  productImagesDataUrls: ["data:image/png;base64,AAAA"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Produto 1:1 — fixture crua Images API → adapter → gateway → sink", () => {
  it("calcula custo por tokens reais e grava UM evento com usage bruto preservado", async () => {
    const { gateway } = makeGateway();
    const record = vi.fn(async () => {});
    const internalCost = internalCostFor({
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });

    await gateway.invoke(
      "campaign_product_image",
      REQUEST,
      telemetryWith(internalCost, { record }),
    );

    expect(record).toHaveBeenCalledTimes(1);
    const event = record.mock.calls[0][0];

    // Exemplo aritmético: 464×5 + 1784×8 + 439×30 = 0,029762.
    expect(event.cost).toMatchObject({
      estimatedCostUsd: 0.029762,
      costSource: "pricing_table",
      pricingVersion: "pricing-ver-1",
      textComponentUsd: 0.00232,
      imageToolComponentUsd: 0.027442,
      costFormulaVersion: "product_1_1_image_usage_tokens_v1",
    });
    expect(event.cost.providerReportedCostUsd).toBeUndefined();

    expect(event.tokens).toEqual({
      promptTokens: 2248,
      completionTokens: 439,
      totalTokens: 2687,
      inputTextTokens: 464,
      inputImageTokens: 1784,
      outputImageTokens: 439,
    });
    expect(event.metadata).toMatchObject({
      capability: "campaign_product_image",
      protocol: "images",
      provider_usage_source: "images.edit",
      provider_usage_raw: RAW_USAGE,
      product_1_1_image_usage_origin: "usage_tokens",
      product_1_1_image_usage_formula_version:
        "product_1_1_image_usage_tokens_v1",
      product_1_1_image_usage_pricing_version: "pricing-ver-1",
      product_1_1_image_usage_input_text_tokens: 464,
      product_1_1_image_usage_input_image_tokens: 1784,
      product_1_1_image_usage_output_image_tokens: 439,
      product_1_1_image_usage_coverage: "complete",
      product_1_1_image_usage_missing: [],
      internal_cost_settlement: "usage_tokens",
      internal_cost_pre_call_estimate_usd: 0.041,
    });
  });

  it("retry/fallback usam consumo, modelo, qualidade e tarifas próprios (2 eventos)", async () => {
    const { gateway } = makeGateway();
    const record = vi.fn(async () => {});
    const tracker = { record };

    // Principal (medium) e fallback (low) com tarifas/versões diferentes.
    await gateway.invoke(
      "campaign_product_image",
      REQUEST,
      telemetryWith(
        internalCostFor({
          model: "gpt-image-2.5-sunburst",
          quality: "medium",
          versionId: "pricing-primary",
          pricing: TOKEN_PRICING,
        }),
        tracker,
      ),
    );
    await gateway.invoke(
      "campaign_product_image",
      { ...REQUEST, quality: "low" },
      telemetryWith(
        internalCostFor({
          model: "gpt-image-2",
          quality: "low",
          versionId: "pricing-fallback",
          pricing: { ...TOKEN_PRICING, imageTokenUsdPer1M: 15 },
        }),
        tracker,
      ),
      "fallback",
    );

    expect(record).toHaveBeenCalledTimes(2);
    const [primaryEvent, fallbackEvent] = record.mock.calls.map((call) => call[0]);

    expect(primaryEvent.cost.estimatedCostUsd).toBe(0.029762);
    expect(primaryEvent.cost.pricingVersion).toBe("pricing-primary");
    expect(primaryEvent.model).toBe("gpt-image-2.5-sunburst");
    expect(primaryEvent.metadata.product_1_1_image_usage_quality).toBe("medium");

    // 464×5 + 1784×8 + 439×15 = 0,00232 + 0,014272 + 0,006585 = 0,023177
    expect(fallbackEvent.cost.estimatedCostUsd).toBe(0.023177);
    expect(fallbackEvent.cost.pricingVersion).toBe("pricing-fallback");
    expect(fallbackEvent.model).toBe("gpt-image-2");
    expect(fallbackEvent.metadata.product_1_1_image_usage_quality).toBe("low");
  });

  it("cache textual e de imagem explícitos atravessam adapter e sink sem dupla contagem", async () => {
    const cacheUsage = {
      input_tokens: 1000,
      output_tokens: 50,
      total_tokens: 1050,
      input_tokens_details: {
        text_tokens: 400,
        image_tokens: 600,
        cached_tokens: 300,
        cached_text_tokens: 100,
        cached_image_tokens: 200,
      },
      output_tokens_details: { image_tokens: 50 },
    };
    const { gateway } = makeGateway(cacheUsage);
    const record = vi.fn(async () => {});

    await gateway.invoke(
      "campaign_product_image",
      REQUEST,
      telemetryWith(
        internalCostFor({
          model: "gpt-image-2.5-sunburst",
          quality: "medium",
        }),
        { record },
      ),
    );

    const event = record.mock.calls[0][0];
    // texto: 300×5 + 100×1,25 = 0,001625
    // imagem: 400×8 + 200×2 + 50×30 = 0,0051
    expect(event.cost.estimatedCostUsd).toBe(0.006725);
    expect(event.metadata.product_1_1_image_usage_cache_mode).toBe("explicit");
    expect(event.tokens).toMatchObject({
      cachedInputTokens: 300,
      cachedInputTextTokens: 100,
      cachedInputImageTokens: 200,
    });
    expect(event.metadata.provider_usage_raw).toEqual(cacheUsage);
  });

  it("code_default é rejeitado como tarifa tabelada e vira not_available", async () => {
    const { gateway } = makeGateway();
    const record = vi.fn(async () => {});

    await gateway.invoke(
      "campaign_product_image",
      REQUEST,
      telemetryWith(
        internalCostFor({
          model: "gpt-image-2.5-sunburst",
          quality: "medium",
          source: "code_default",
        }),
        { record },
      ),
    );

    const event = record.mock.calls[0][0];
    expect(event.cost).toMatchObject({
      estimatedCostUsd: null,
      costSource: "not_available",
    });
    expect(event.metadata.product_1_1_image_usage_missing).toContain(
      "pricing_code_default",
    );
  });

  it("usage ausente → evento único com custo not_available (não image_unit)", async () => {
    const { gateway } = makeGateway(null);
    const record = vi.fn(async () => {});

    await gateway.invoke(
      "campaign_product_image",
      REQUEST,
      telemetryWith(
        internalCostFor({
          model: "gpt-image-2.5-sunburst",
          quality: "medium",
        }),
        { record },
      ),
    );

    expect(record).toHaveBeenCalledTimes(1);
    const event = record.mock.calls[0][0];
    expect(event.cost).toMatchObject({
      estimatedCostUsd: null,
      costSource: "not_available",
    });
    expect(event.cost.imageToolComponentUsd).toBeUndefined();
    expect(event.metadata.product_1_1_image_usage_missing).toContain("usage");
    expect(event.metadata.internal_cost_pre_call_estimate_usd).toBe(0.041);
  });
});
