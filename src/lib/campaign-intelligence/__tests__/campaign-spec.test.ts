// @vitest-environment node
// F46-03 (Task 3): testes reais de `campaign_spec` legado via gateway —
// Structured Outputs (json_schema) + fallback `json_object` como SEGUNDA invoke
// explícita (attempt 1 → 2), preservando o contrato de saída.
import { describe, it, expect, vi } from "vitest";

// O provider importa `@/lib/ai` (gateway default) → sink padrão →
// cost-estimator → supabase/server. Sem env, o módulo lança na importação.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import { OpenAIProvider } from "../providers/openai";
import { CampaignSpecSchema } from "../schema";
import type { CampaignGenerationInput } from "../schema";
import { AiInvocationError, NoopAiTelemetrySink } from "@/lib/ai";
import type {
  AiCapability,
  AiInvocationRequest,
  AiInvocationResult,
  AiInvoker,
  AiTelemetryContext,
} from "@/lib/ai";

const TELEMETRY: AiTelemetryContext = {
  operationRunId: "run-1",
  operationRunType: "campaign_delivery",
  traceId: "trace-1",
  storeId: "store-1",
  userId: "user-1",
  sink: new NoopAiTelemetrySink(),
};

const INPUT: CampaignGenerationInput = {
  productName: "Tênis Runner",
  discountedPriceCents: 1990,
  storeName: "Loja Teste",
  storeSegment: "outros",
  brandColor: "#22C55E",
};

const VALID_SPEC = {
  commercial_copy: { title: "T", subtitle: "S", hook: "H", cta: "C" },
  offer: {
    product_name: "Tênis Runner",
    original_price_display: null,
    discounted_price_display: "R$ 19,90",
    badge_text: null,
  },
  visual_parameters: {
    layout_preset: "produto-oferta-comercial",
    composition_type: "standard",
    hierarchy_focus: "product-image",
    palette_accent: "#22C55E",
    badge_style: "pill",
    background_style: "solid-light",
  },
  generation_metadata: {
    provider: "openai",
    model: "gpt-4o-mini",
    generated_at: "2026-09-12T00:00:00.000Z",
  },
};

function makeInvoker(
  impl: (
    capability: AiCapability,
    request: AiInvocationRequest,
    telemetry: AiTelemetryContext
  ) => Promise<AiInvocationResult>
): { invoker: AiInvoker; invokeMock: ReturnType<typeof vi.fn> } {
  const invokeMock = vi.fn(impl);
  return {
    invokeMock,
    invoker: {
      invoke: invokeMock as unknown as AiInvoker["invoke"],
      hasFallback: vi.fn(async () => false),
    },
  };
}

describe("campaign_spec — OpenAIProvider via gateway (F46-15)", () => {
  it("Structured Outputs (json_schema) preservados + generation_metadata sobrescrito", async () => {
    const { invoker, invokeMock } = makeInvoker(async () => ({
      content: JSON.stringify(VALID_SPEC),
      model: "gpt-4o-mini",
      usage: { promptTokens: 10, completionTokens: 20 },
    }));
    const provider = new OpenAIProvider(invoker);

    const response = await provider.generate(INPUT, TELEMETRY);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [capability, request, telemetry] = invokeMock.mock.calls[0];
    expect(capability).toBe("campaign_spec");
    expect(request.responseFormat).toBe("json_schema");
    expect(request.jsonSchema?.name).toBe("campaign_spec");
    expect(telemetry.attemptNumber).toBe(1);

    const parsed = JSON.parse(response.raw);
    expect(parsed.generation_metadata.model).toBe("gpt-4o-mini");
    expect(parsed.generation_metadata.provider).toBe("openai");
    expect(CampaignSpecSchema.safeParse(parsed).success).toBe(true);
  });

  it("fallback json_object é SEGUNDA invoke explícita (attempt 2) só por capability de response_format", async () => {
    const { invoker, invokeMock } = makeInvoker(async (_capability, request) => {
      if (request.responseFormat === "json_schema") {
        throw new AiInvocationError({
          kind: "capability",
          retryable: false,
          message: "response_format json_schema is not supported by this model",
        });
      }
      return { content: JSON.stringify(VALID_SPEC), model: "gpt-4o-mini" };
    });
    const provider = new OpenAIProvider(invoker);

    const response = await provider.generate(INPUT, TELEMETRY);

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeMock.mock.calls[0][1].responseFormat).toBe("json_schema");
    expect(invokeMock.mock.calls[0][2].attemptNumber).toBe(1);
    expect(invokeMock.mock.calls[1][1].responseFormat).toBe("json_object");
    expect(invokeMock.mock.calls[1][2].attemptNumber).toBe(2);
    expect(invokeMock.mock.calls[1][1].system).toContain("APENAS com um objeto JSON válido");
    expect(JSON.parse(response.raw).generation_metadata.provider).toBe("openai");
  });

  it("erro de auth NÃO aciona fallback (uma invoke)", async () => {
    const { invoker, invokeMock } = makeInvoker(async () => {
      throw new AiInvocationError({
        kind: "auth",
        retryable: false,
        message: "invalid api key",
      });
    });
    const provider = new OpenAIProvider(invoker);

    await expect(provider.generate(INPUT, TELEMETRY)).rejects.toBeInstanceOf(AiInvocationError);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("conteúdo vazio → erro", async () => {
    const { invoker } = makeInvoker(async () => ({ content: "", model: "gpt-4o-mini" }));
    const provider = new OpenAIProvider(invoker);
    await expect(provider.generate(INPUT, TELEMETRY)).rejects.toThrow(/empty response/);
  });

  it("JSON inválido → raw preservado (sem quebrar)", async () => {
    const { invoker } = makeInvoker(async () => ({ content: "not-json", model: "gpt-4o-mini" }));
    const provider = new OpenAIProvider(invoker);
    const response = await provider.generate(INPUT, TELEMETRY);
    expect(response.raw).toBe("not-json");
  });

  it("sem telemetria → erro de contrato", async () => {
    const { invoker } = makeInvoker(async () => ({
      content: JSON.stringify(VALID_SPEC),
      model: "gpt-4o-mini",
    }));
    const provider = new OpenAIProvider(invoker);
    await expect(provider.generate(INPUT)).rejects.toThrow(/AiTelemetryContext/);
  });
});
