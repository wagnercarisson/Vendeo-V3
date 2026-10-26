import { describe, expect, it, vi } from "vitest";
import { AiGateway } from "../gateway";
import type { AiModelConfig, AiModelResolver, AiProtocol } from "../model-resolver";
import type {
  AiAdapter,
  AiAdapterRegistry,
  AiCallEnvelope,
  AiInvocationResult,
  AiTelemetryContext,
  AiTelemetrySink,
} from "../types";

const config: AiModelConfig = {
  capability: "visual_signature_image",
  segment: "image",
  primary: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
};

class RecordingSink implements AiTelemetrySink {
  readonly envelopes: AiCallEnvelope[] = [];
  emit(envelope: AiCallEnvelope): void {
    this.envelopes.push(envelope);
  }
}

function makeGateway(adapter: AiAdapter): AiGateway {
  const resolver: AiModelResolver = {
    resolve: vi.fn(async () => config),
    listCapabilities: vi.fn(() => [config.capability]),
  };
  const registry: AiAdapterRegistry = {
    get: vi.fn((protocol: AiProtocol) =>
      protocol === adapter.protocol ? adapter : undefined,
    ),
  };
  return new AiGateway(resolver, registry);
}

function makeTelemetry(
  sink: AiTelemetrySink,
  visualSignatureImageUsage?: AiTelemetryContext["visualSignatureImageUsage"],
): AiTelemetryContext {
  return {
    operationRunId: "op-1",
    operationRunType: "visual_signature",
    traceId: "trace-1",
    storeId: "store-1",
    attemptNumber: 0,
    ...(visualSignatureImageUsage ? { visualSignatureImageUsage } : {}),
    sink,
  };
}

const target = {
  imageModel: "gpt-image-2.5-sunburst",
  imageQuality: "medium",
  size: "1024x1024",
  configVersionId: "cfg-v1",
};

describe("AiGateway — propagação do alvo da estimativa da imagem da VS", () => {
  it("sucesso copia o alvo da telemetria para o envelope da tentativa", async () => {
    const adapter: AiAdapter = {
      protocol: "responses",
      invoke: vi.fn(async (): Promise<AiInvocationResult> => ({
        imageBase64: "IMG",
        model: "gpt-5.5",
        usage: { inputTextTokens: 10, outputTextTokens: 2 },
      })),
    };
    const sink = new RecordingSink();

    await makeGateway(adapter).invoke(
      "visual_signature_image",
      { prompt: "assinatura", tools: "image_generation", quality: "medium" },
      makeTelemetry(sink, target),
    );

    expect(sink.envelopes).toHaveLength(1);
    expect(sink.envelopes[0].visualSignatureImageUsage).toEqual(target);
  });

  it("falha também carrega o alvo (mesma tentativa real)", async () => {
    const adapter: AiAdapter = {
      protocol: "responses",
      invoke: vi.fn(async () => {
        throw Object.assign(new Error("Too many requests"), { status: 429 });
      }),
    };
    const sink = new RecordingSink();

    await expect(
      makeGateway(adapter).invoke(
        "visual_signature_image",
        { prompt: "assinatura", tools: "image_generation", quality: "medium" },
        makeTelemetry(sink, target),
      ),
    ).rejects.toMatchObject({ kind: "rate_limit" });

    expect(sink.envelopes).toHaveLength(1);
    expect(sink.envelopes[0]).toMatchObject({
      status: "failed",
      visualSignatureImageUsage: target,
    });
  });

  it("sem alvo (caminho legado) o envelope não ganha a propriedade", async () => {
    const adapter: AiAdapter = {
      protocol: "responses",
      invoke: vi.fn(async (): Promise<AiInvocationResult> => ({
        imageBase64: "IMG",
        model: "gpt-5.5",
      })),
    };
    const sink = new RecordingSink();

    await makeGateway(adapter).invoke(
      "visual_signature_image",
      { prompt: "assinatura", tools: "image_generation", quality: "auto" },
      makeTelemetry(sink),
    );

    expect(sink.envelopes[0]).not.toHaveProperty("visualSignatureImageUsage");
  });
});
