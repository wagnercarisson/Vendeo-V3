import { describe, it, expect, vi } from "vitest";
import { AiGateway } from "../gateway";
import type { AiModelConfig, AiModelResolver, AiProtocol } from "../model-resolver";
import type {
  AiAdapter,
  AiAdapterRegistry,
  AiCallEnvelope,
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
  AiTelemetrySink,
} from "../types";

/**
 * Testes do enriquecimento **aditivo** do envelope do gateway com
 * `quality`/`target`/`attemptNumber` (F56.1, D-21).
 *
 * Provam os três campos nas ramificações de sucesso e falha/timeout, a
 * sequência `2×principal + 1×fallback = 3 envelopes` correlacionáveis e que uma
 * falha **não** aciona fallback interno (a decisão é do orquestrador). Nenhuma
 * chamada real ao provider — sink fake e adapters em memória.
 */

const config: AiModelConfig = {
  capability: "campaign_product_image",
  segment: "image",
  primary: { provider: "openai", model: "gpt-image-2.5-sunburst", protocol: "images" },
  fallback: { provider: "openai", model: "gpt-image-2", protocol: "images" },
};

function makeResolver(cfg: AiModelConfig = config): AiModelResolver {
  return {
    resolve: vi.fn(async () => cfg),
    listCapabilities: vi.fn(() => [cfg.capability]),
  };
}

class RecordingSink implements AiTelemetrySink {
  readonly envelopes: AiCallEnvelope[] = [];
  emit(envelope: AiCallEnvelope): void {
    this.envelopes.push(envelope);
  }
}

function makeAdapter(
  protocol: AiProtocol,
  impl: (request: AiInvocationRequest) => Promise<AiInvocationResult>,
): { adapter: AiAdapter; invoke: ReturnType<typeof vi.fn> } {
  const invoke = vi.fn(impl);
  return { adapter: { protocol, invoke }, invoke };
}

function makeRegistry(adapters: AiAdapter[]): AiAdapterRegistry {
  return {
    get: vi.fn((protocol: AiProtocol) =>
      adapters.find((adapter) => adapter.protocol === protocol),
    ),
  };
}

function makeTelemetry(sink: AiTelemetrySink, attemptNumber?: number): AiTelemetryContext {
  return {
    operationRunId: "op-1",
    operationRunType: "campaign_delivery",
    traceId: "trace-1",
    storeId: "store-1",
    attemptNumber,
    sink,
  };
}

const request: AiInvocationRequest = { prompt: "gerar imagem", quality: "medium" };
const successResult: AiInvocationResult = {
  imageBase64: "IMG",
  mimeType: "image/png",
  model: "gpt-image-2.5-sunburst",
};

describe("AiGateway — envelope por tentativa com quality/target/attemptNumber (F56.1 D-21)", () => {
  it("sucesso carrega model + quality + target + attemptNumber", async () => {
    const { adapter } = makeAdapter("images", async () => successResult);
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const sink = new RecordingSink();

    await gateway.invoke("campaign_product_image", request, makeTelemetry(sink, 1));

    expect(sink.envelopes).toHaveLength(1);
    expect(sink.envelopes[0]).toMatchObject({
      status: "success",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
      target: "primary",
      attemptNumber: 1,
    });
  });

  it("fallback em sucesso carrega target 'fallback' e a própria qualidade", async () => {
    const { adapter } = makeAdapter("images", async () => successResult);
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const sink = new RecordingSink();

    await gateway.invoke(
      "campaign_product_image",
      { ...request, quality: "low" },
      makeTelemetry(sink, 3),
      "fallback",
    );

    expect(sink.envelopes).toHaveLength(1);
    expect(sink.envelopes[0]).toMatchObject({
      quality: "low",
      target: "fallback",
      attemptNumber: 3,
    });
  });

  it("falha carrega quality/target/attemptNumber (um envelope)", async () => {
    const { adapter } = makeAdapter("images", async () => {
      throw Object.assign(new Error("Too many requests"), { status: 429 });
    });
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const sink = new RecordingSink();

    await expect(
      gateway.invoke("campaign_product_image", request, makeTelemetry(sink, 2)),
    ).rejects.toMatchObject({ kind: "rate_limit" });

    expect(sink.envelopes).toHaveLength(1);
    expect(sink.envelopes[0]).toMatchObject({
      status: "failed",
      errorType: "rate_limit",
      quality: "medium",
      target: "primary",
      attemptNumber: 2,
    });
  });

  it("timeout carrega quality/target/attemptNumber", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    const { adapter } = makeAdapter("images", async () => {
      throw abort;
    });
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const sink = new RecordingSink();

    await expect(
      gateway.invoke("campaign_product_image", request, makeTelemetry(sink, 1)),
    ).rejects.toMatchObject({ kind: "timeout" });

    expect(sink.envelopes).toHaveLength(1);
    expect(sink.envelopes[0]).toMatchObject({
      status: "timeout",
      quality: "medium",
      target: "primary",
      attemptNumber: 1,
    });
  });

  it("2×principal + 1×fallback emitem exatamente 3 envelopes correlacionáveis", async () => {
    const { adapter } = makeAdapter("images", async () => successResult);
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const sink = new RecordingSink();

    await gateway.invoke("campaign_product_image", request, makeTelemetry(sink, 1), "primary");
    await gateway.invoke("campaign_product_image", request, makeTelemetry(sink, 2), "primary");
    await gateway.invoke("campaign_product_image", request, makeTelemetry(sink, 3), "fallback");

    expect(sink.envelopes).toHaveLength(3);
    expect(sink.envelopes.map((envelope) => envelope.target)).toEqual([
      "primary",
      "primary",
      "fallback",
    ]);
    expect(sink.envelopes.map((envelope) => envelope.attemptNumber)).toEqual([1, 2, 3]);
    expect(
      sink.envelopes.every(
        (envelope) =>
          envelope.capability === "campaign_product_image" && envelope.quality === "medium",
      ),
    ).toBe(true);
  });

  it("falha NÃO aciona fallback interno (sem retry; decisão é do orquestrador)", async () => {
    const { adapter, invoke } = makeAdapter("images", async () => {
      throw Object.assign(new Error("Bad gateway"), { status: 502 });
    });
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const sink = new RecordingSink();

    await expect(
      gateway.invoke("campaign_product_image", request, makeTelemetry(sink, 1)),
    ).rejects.toMatchObject({ kind: "provider_error" });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(sink.envelopes).toHaveLength(1);
    expect(sink.envelopes[0]).toMatchObject({
      target: "primary",
      attemptNumber: 1,
      quality: "medium",
    });
  });
});
