// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { UpstreamImagesAdapter } from "@/lib/ai/adapters/upstream-images";
import type { PreparedInvocation } from "@/lib/ai/gateway";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import { NoopAiTelemetrySink } from "@/lib/ai/telemetry-sink";
import type {
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
  TokenUsage,
} from "@/lib/ai/types";

import {
  assertSquareBaseImageRequest,
  invokeSquareBaseOnce,
  SquareBaseTransportRequestError,
  type SquareBaseImageGateway,
} from "../transport";

const PAIR: ImageModelPairConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
};

const FULL_USAGE: TokenUsage = {
  promptTokens: 10,
  completionTokens: 30,
  totalTokens: 40,
  inputTextTokens: 10,
  inputImageTokens: 20,
  outputImageTokens: 30,
};

const VALID_REQUEST: AiInvocationRequest = {
  prompt: "componha a base quadrada",
  productImagesDataUrls: ["data:image/jpeg;base64,AAAA"],
  identityImageUrl: "data:image/png;base64,BBBB",
  size: "1024x1024",
  quality: "medium",
};

function telemetryContext(): AiTelemetryContext {
  return {
    operationRunId: "00000000-0000-4000-8000-000000000001",
    operationRunType: "campaign_delivery",
    traceId: "00000000-0000-4000-8000-000000000002",
    storeId: "00000000-0000-4000-8000-000000000003",
    sink: new NoopAiTelemetrySink(),
    attemptNumber: 1,
  };
}

function prepared(target: "primary" | "fallback" = "primary"): PreparedInvocation {
  return {
    capability: "campaign_product_image",
    target,
    provider: "openai",
    model: PAIR[target].model,
    protocol: "images",
    resolved: {
      provider: "openai",
      model: PAIR[target].model,
      protocol: "images",
    },
  };
}

function gatewayReturning(result: AiInvocationResult): SquareBaseImageGateway {
  return {
    prepare: async () => prepared(),
    invokePrepared: async () => result,
  };
}

describe("assertSquareBaseImageRequest — request adulterado não chega ao gateway", () => {
  const options = { quality: "medium", expectedIdentity: true };

  it("aceita request completo", () => {
    expect(() => assertSquareBaseImageRequest(VALID_REQUEST, options)).not.toThrow();
  });

  it("recusa cada motivo com união fechada", () => {
    const cases: ReadonlyArray<{
      readonly reason:
        | "prompt_missing"
        | "quality_mismatch"
        | "size_mismatch"
        | "product_images_missing"
        | "identity_missing";
      readonly request: AiInvocationRequest;
      readonly expectedIdentity?: boolean;
    }> = [
      {
        reason: "prompt_missing",
        request: { ...VALID_REQUEST, prompt: "   " },
      },
      {
        reason: "quality_mismatch",
        request: { ...VALID_REQUEST, quality: "low" },
      },
      {
        reason: "quality_mismatch",
        request: { ...VALID_REQUEST, quality: undefined },
      },
      {
        reason: "size_mismatch",
        request: { ...VALID_REQUEST, size: "1152x2048" },
      },
      {
        reason: "product_images_missing",
        request: { ...VALID_REQUEST, productImagesDataUrls: [] },
      },
      {
        reason: "product_images_missing",
        request: { ...VALID_REQUEST, productImagesDataUrls: ["", "data:image/png;base64,AA"] },
      },
      {
        reason: "identity_missing",
        request: { ...VALID_REQUEST, identityImageUrl: undefined },
        expectedIdentity: true,
      },
    ];

    for (const { reason, request, expectedIdentity } of cases) {
      expect(() =>
        assertSquareBaseImageRequest(request, {
          quality: options.quality,
          expectedIdentity: expectedIdentity ?? options.expectedIdentity,
        }),
      ).toThrow(SquareBaseTransportRequestError);

      try {
        assertSquareBaseImageRequest(request, {
          quality: options.quality,
          expectedIdentity: expectedIdentity ?? options.expectedIdentity,
        });
      } catch (error) {
        expect((error as SquareBaseTransportRequestError).reason).toBe(reason);
      }
    }
  });

  it("não exigir identidade permite request sem identityImageUrl", () => {
    expect(() =>
      assertSquareBaseImageRequest(
        { ...VALID_REQUEST, identityImageUrl: undefined },
        { quality: "medium", expectedIdentity: false },
      ),
    ).not.toThrow();
  });
});

describe("resposta sem imagem preserva uso/custo conhecido", () => {
  it("invokeSquareBaseOnce devolve imageBase64 vazio com usage e custo preservados", async () => {
    const outcome = await invokeSquareBaseOnce({
      gateway: gatewayReturning({
        imageBase64: "",
        mimeType: "image/png",
        model: PAIR.primary.model,
        usage: FULL_USAGE,
        providerReportedCostUsd: 0.04,
      }),
      capability: "campaign_product_image",
      target: "primary",
      request: VALID_REQUEST,
      telemetry: telemetryContext(),
      quality: "medium",
      expectedIdentity: true,
      timeoutMs: 30_000,
    });

    expect(outcome.sendEvidence).toBe("confirmed_sent");
    if (outcome.sendEvidence !== "confirmed_sent") return;
    expect(outcome.result.imageBase64).toBe("");
    expect(outcome.result.usage).toEqual(FULL_USAGE);
    expect(outcome.result.providerReportedCostUsd).toBe(0.04);
  });

  it("o adapter real com preserveUsageWithoutImage não lança e preserva usage", async () => {
    const adapter = new UpstreamImagesAdapter(
      async () => ({
        client: {
          images: {
            edit: async () => ({
              data: [],
              usage: {
                input_tokens: 10,
                output_tokens: 30,
                input_tokens_details: { text_tokens: 10, image_tokens: 20 },
                output_tokens_details: { image_tokens: 30 },
              },
            }),
          },
        },
        toFile: async (data, name, options) => ({ data, name, options }),
      }),
      { maxRetries: 0, preserveUsageWithoutImage: true },
    );

    const result = await adapter.invoke(VALID_REQUEST, {
      provider: "openai",
      model: PAIR.primary.model,
      protocol: "images",
    });

    expect(result.imageBase64).toBe("");
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 30,
      totalTokens: 40,
      inputTextTokens: 10,
      inputImageTokens: 20,
      outputImageTokens: 30,
    });
  });

  it("uma única invocação também no resultado vazio", async () => {
    const invokePrepared = vi.fn(async () => ({
      imageBase64: "",
      model: PAIR.primary.model,
    }));
    const gateway: SquareBaseImageGateway = {
      prepare: async () => prepared(),
      invokePrepared: invokePrepared as SquareBaseImageGateway["invokePrepared"],
    };

    const outcome = await invokeSquareBaseOnce({
      gateway,
      capability: "campaign_product_image",
      target: "primary",
      request: VALID_REQUEST,
      telemetry: telemetryContext(),
      quality: "medium",
      expectedIdentity: true,
      timeoutMs: 30_000,
    });

    expect(outcome.sendEvidence).toBe("confirmed_sent");
    expect(invokePrepared).toHaveBeenCalledTimes(1);
  });
});
