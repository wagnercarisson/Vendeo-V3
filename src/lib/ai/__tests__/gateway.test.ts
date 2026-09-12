import { describe, it, expect, vi } from "vitest";
import { AiGateway } from "../gateway";
import type { AiModelConfig, AiModelResolver, AiProtocol } from "../model-resolver";
import { AiInvocationError } from "../types";
import type {
  AiAdapter,
  AiAdapterRegistry,
  AiCallEnvelope,
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
  AiTelemetrySink,
} from "../types";
import { MalformedResponseError } from "@/lib/copy/errors";

const baseConfig: AiModelConfig = {
  capability: "campaign_copy",
  segment: "text",
  primary: { provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
  fallback: { provider: "gemini", model: "gemini-3.1-flash-lite", protocol: "gemini" },
};

function makeResolver(config: AiModelConfig = baseConfig): AiModelResolver {
  return {
    resolve: vi.fn(async () => config),
    listCapabilities: vi.fn(() => [config.capability]),
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
    get: vi.fn((protocol: AiProtocol) => adapters.find((adapter) => adapter.protocol === protocol)),
  };
}

function makeTelemetry(sink: AiTelemetrySink): AiTelemetryContext {
  return {
    operationRunId: "run-1",
    operationRunType: "campaign_delivery",
    traceId: "trace-1",
    storeId: "store-1",
    sink,
  };
}

const request: AiInvocationRequest = { prompt: "gere uma campanha" };
const successResult: AiInvocationResult = {
  content: "ok",
  model: "gpt-4o",
  usage: { promptTokens: 10, completionTokens: 20 },
};

describe("AiGateway — composição injetável e uma tentativa (D1.1/D2/D4)", () => {
  it("resolve pelo resolver injetado e usa o adapter do protocolo do alvo", async () => {
    const resolver = makeResolver();
    const { adapter, invoke } = makeAdapter("chat-completions", async () => successResult);
    const gateway = new AiGateway(resolver, makeRegistry([adapter]));
    const sink = new RecordingSink();

    const result = await gateway.invoke("campaign_copy", request, makeTelemetry(sink));

    expect(resolver.resolve).toHaveBeenCalledWith("campaign_copy");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result).toBe(successResult);
  });

  it("target não informado → primary (nunca aciona fallback automaticamente)", async () => {
    const resolver = makeResolver();
    const primary = makeAdapter("chat-completions", async () => successResult);
    const fallback = makeAdapter("gemini", async () => ({ ...successResult, model: "gemini-3.1-flash-lite" }));
    const gateway = new AiGateway(resolver, makeRegistry([primary.adapter, fallback.adapter]));

    await gateway.invoke("campaign_copy", request, makeTelemetry(new RecordingSink()));

    expect(primary.invoke).toHaveBeenCalledTimes(1);
    expect(fallback.invoke).not.toHaveBeenCalled();
  });

  it("target fallback resolve o alvo configurado e usa o adapter do protocolo dele", async () => {
    const resolver = makeResolver();
    const primary = makeAdapter("chat-completions", async () => successResult);
    const fallback = makeAdapter("gemini", async () => ({ ...successResult, model: "gemini-3.1-flash-lite" }));
    const gateway = new AiGateway(resolver, makeRegistry([primary.adapter, fallback.adapter]));
    const sink = new RecordingSink();

    const result = await gateway.invoke("campaign_copy", request, makeTelemetry(sink), "fallback");

    expect(primary.invoke).not.toHaveBeenCalled();
    expect(fallback.invoke).toHaveBeenCalledTimes(1);
    expect(result.model).toBe("gemini-3.1-flash-lite");
    expect(sink.envelopes[0].protocol).toBe("gemini");
  });

  it("fallback ausente → erro de capability, sem tentativa e sem envelope", async () => {
    const resolver = makeResolver({ ...baseConfig, fallback: undefined });
    const primary = makeAdapter("chat-completions", async () => successResult);
    const gateway = new AiGateway(resolver, makeRegistry([primary.adapter]));
    const sink = new RecordingSink();

    await expect(
      gateway.invoke("campaign_copy", request, makeTelemetry(sink), "fallback"),
    ).rejects.toBeInstanceOf(AiInvocationError);
    expect(primary.invoke).not.toHaveBeenCalled();
    expect(sink.envelopes).toHaveLength(0);
  });

  it("adapter não registrado para o protocolo → erro de capability, sem envelope", async () => {
    const resolver = makeResolver();
    const gateway = new AiGateway(resolver, makeRegistry([]));
    const sink = new RecordingSink();

    await expect(
      gateway.invoke("campaign_copy", request, makeTelemetry(sink)),
    ).rejects.toMatchObject({ kind: "capability" });
    expect(sink.envelopes).toHaveLength(0);
  });
});

describe("AiGateway — envelope por tentativa real (D3)", () => {
  it("sucesso emite exatamente um envelope com modelo real, capability e protocol", async () => {
    const { adapter } = makeAdapter("chat-completions", async () => successResult);
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const sink = new RecordingSink();

    await gateway.invoke("campaign_copy", request, makeTelemetry(sink));

    expect(sink.envelopes).toHaveLength(1);
    const envelope = sink.envelopes[0];
    expect(envelope.status).toBe("success");
    expect(envelope.capability).toBe("campaign_copy");
    expect(envelope.protocol).toBe("chat-completions");
    expect(envelope.provider).toBe("openai");
    expect(envelope.model).toBe("gpt-4o");
    expect(envelope.usage).toEqual({ promptTokens: 10, completionTokens: 20 });
    expect(typeof envelope.durationMs).toBe("number");
    expect(envelope.errorType).toBeUndefined();
  });

  it("falha emite um envelope failed com errorType normalizado e re-lança AiInvocationError", async () => {
    const { adapter, invoke } = makeAdapter("chat-completions", async () => {
      throw Object.assign(new Error("Too many requests"), { status: 429 });
    });
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const sink = new RecordingSink();

    await expect(
      gateway.invoke("campaign_copy", request, makeTelemetry(sink)),
    ).rejects.toMatchObject({ kind: "rate_limit", retryable: true });

    expect(invoke).toHaveBeenCalledTimes(1); // sem retry
    expect(sink.envelopes).toHaveLength(1);
    expect(sink.envelopes[0].status).toBe("failed");
    expect(sink.envelopes[0].errorType).toBe("rate_limit");
  });

  it("timeout (AbortError) emite envelope status timeout + errorType timeout", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    const { adapter } = makeAdapter("chat-completions", async () => {
      throw abort;
    });
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const sink = new RecordingSink();

    await expect(
      gateway.invoke("campaign_copy", request, makeTelemetry(sink)),
    ).rejects.toMatchObject({ kind: "timeout", retryable: true });

    expect(sink.envelopes).toHaveLength(1);
    expect(sink.envelopes[0].status).toBe("timeout");
    expect(sink.envelopes[0].errorType).toBe("timeout");
  });

  it("erro de domínio (MalformedResponseError) não é normalizado e propaga o original", async () => {
    const domainError = new MalformedResponseError();
    const { adapter } = makeAdapter("chat-completions", async () => {
      throw domainError;
    });
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const sink = new RecordingSink();

    await expect(
      gateway.invoke("campaign_copy", request, makeTelemetry(sink)),
    ).rejects.toBe(domainError);

    expect(sink.envelopes).toHaveLength(1);
    expect(sink.envelopes[0].status).toBe("failed");
    expect(sink.envelopes[0].errorType).toBe("MalformedResponseError");
  });

  it("sink defeituoso não bloqueia a geração (best-effort)", async () => {
    const { adapter } = makeAdapter("chat-completions", async () => successResult);
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const failingSink: AiTelemetrySink = {
      emit: () => {
        throw new Error("sink down");
      },
    };
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await gateway.invoke("campaign_copy", request, makeTelemetry(failingSink));

    expect(result).toBe(successResult);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe("AiGateway — contexto obrigatório e AbortSignal (D3/D4)", () => {
  it("contexto sem sink → rejeita sem executar tentativa", async () => {
    const { adapter, invoke } = makeAdapter("chat-completions", async () => successResult);
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));

    await expect(
      gateway.invoke("campaign_copy", request, {} as AiTelemetryContext),
    ).rejects.toThrow(/sink/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("contexto ausente → rejeita", async () => {
    const { adapter } = makeAdapter("chat-completions", async () => successResult);
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));

    await expect(
      gateway.invoke("campaign_copy", request, undefined as unknown as AiTelemetryContext),
    ).rejects.toThrow(/obrigatório/);
  });

  it("AbortSignal é propagado ao adapter (mesmo objeto de request)", async () => {
    const controller = new AbortController();
    const { adapter, invoke } = makeAdapter("chat-completions", async () => successResult);
    const gateway = new AiGateway(makeResolver(), makeRegistry([adapter]));
    const requestWithSignal: AiInvocationRequest = { prompt: "x", signal: controller.signal };

    await gateway.invoke("campaign_copy", requestWithSignal, makeTelemetry(new RecordingSink()));

    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
      expect.objectContaining({ model: "gpt-4o" }),
    );
  });
});
