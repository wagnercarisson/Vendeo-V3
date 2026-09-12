import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRecord, mockResolveAiCost } = vi.hoisted(() => ({
  mockRecord: vi.fn(),
  mockResolveAiCost: vi.fn(),
}));

vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    record = mockRecord;
    startRun = vi.fn();
  },
}));

vi.mock("@/lib/ai-cost/cost-estimator", () => ({
  resolveAiCost: mockResolveAiCost,
}));

import {
  DefaultAiTelemetrySink,
  NoopAiTelemetrySink,
  BufferingAiTelemetrySink,
  createDefaultTelemetryContext,
  type AiTelemetrySinkContext,
} from "../telemetry-sink";
import { withDomainOutcome } from "../domain-outcome";
import { CAPABILITY_GENERATION_TYPE } from "../generation-type-map";
import { ALL_CAPABILITIES } from "../model-registry";
import type { AiCallEnvelope, AiTelemetryContext } from "../types";

const context: AiTelemetrySinkContext = {
  operationRunId: "run-1",
  operationRunType: "campaign_delivery",
  traceId: "trace-1",
  storeId: "store-1",
  attemptNumber: 2,
};

const imageEditEnvelope: AiCallEnvelope = {
  capability: "campaign_image_edit",
  protocol: "images",
  status: "success",
  provider: "openai",
  model: "gpt-image-2",
  durationMs: 1234,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveAiCost.mockResolvedValue({ estimatedCostUsd: 0.04, costSource: "pricing_table" });
  mockRecord.mockResolvedValue(undefined);
});

describe("CAPABILITY_GENERATION_TYPE — mapa canônico (D10)", () => {
  it("cobre exatamente as 11 capacidades", () => {
    expect(Object.keys(CAPABILITY_GENERATION_TYPE)).toHaveLength(11);
    expect(Object.keys(CAPABILITY_GENERATION_TYPE).sort()).toEqual([...ALL_CAPABILITIES].sort());
  });

  it("campaign_image_edit → campaign_image (fallback de edição pertence à etapa de imagem)", () => {
    expect(CAPABILITY_GENERATION_TYPE.campaign_image_edit).toBe("campaign_image");
  });

  it("demais capacidades mapeiam para o próprio literal", () => {
    expect(CAPABILITY_GENERATION_TYPE.campaign_copy).toBe("campaign_copy");
    expect(CAPABILITY_GENERATION_TYPE.campaign_spec).toBe("campaign_spec");
    expect(CAPABILITY_GENERATION_TYPE.visual_signature_image).toBe("visual_signature_image");
    expect(CAPABILITY_GENERATION_TYPE.visual_signature_validation).toBe("visual_signature_validation");
  });
});

describe("DefaultAiTelemetrySink — persistência best-effort (D3/D9)", () => {
  it("persiste o evento com generationType mapeado e metadata capability/protocol", async () => {
    const tracker = { record: mockRecord } as never;
    const sink = new DefaultAiTelemetrySink(context, tracker);

    await sink.emit(imageEditEnvelope);

    expect(mockRecord).toHaveBeenCalledTimes(1);
    const event = mockRecord.mock.calls[0][0];
    expect(event.generationType).toBe("campaign_image");
    expect(event.metadata).toEqual({ capability: "campaign_image_edit", protocol: "images" });
    expect(event.provider).toBe("openai");
    expect(event.model).toBe("gpt-image-2");
    expect(event.status).toBe("success");
    expect(event.attemptNumber).toBe(2);
    expect(event.durationMs).toBe(1234);
    expect(event.operationRunId).toBe("run-1");
    expect(event.storeId).toBe("store-1");
    expect(event.cost).toEqual({ estimatedCostUsd: 0.04, costSource: "pricing_table" });
    expect(mockResolveAiCost).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        model: "gpt-image-2",
        generationType: "campaign_image",
        imageGenerationTool: false,
      }),
    );
  });

  it("protocolo responses SEM usageMeta.imageGenerationTool NÃO habilita a tool (nunca inferida do protocolo)", async () => {
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit({
      ...imageEditEnvelope,
      capability: "campaign_image",
      protocol: "responses",
      model: "gpt-5.5",
    });

    expect(mockResolveAiCost).toHaveBeenCalledWith(
      expect.objectContaining({ imageGenerationTool: false, generationType: "campaign_image" }),
    );
  });

  it("imageGenerationTool=true vem de usageMeta.imageGenerationTool", async () => {
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit({
      ...imageEditEnvelope,
      capability: "campaign_image",
      protocol: "responses",
      model: "gpt-5.5",
      usageMeta: { imageGenerationTool: true, providerUsageSource: "responses.image_generation" },
    });

    expect(mockResolveAiCost).toHaveBeenCalledWith(
      expect.objectContaining({ imageGenerationTool: true, generationType: "campaign_image" }),
    );
  });

  it("preserva usdBrlRateAtGeneration/creditValueBrlAtGeneration e chama onCostResolved com o mesmo CostResolution", async () => {
    const onCostResolved = vi.fn();
    const sink = new DefaultAiTelemetrySink(
      {
        ...context,
        usdBrlRateAtGeneration: 5.18,
        creditValueBrlAtGeneration: 1.0,
        onCostResolved,
      },
      { record: mockRecord } as never,
    );

    await sink.emit(imageEditEnvelope);

    const event = mockRecord.mock.calls[0][0];
    expect(event.usdBrlRateAtGeneration).toBe(5.18);
    expect(event.creditValueBrlAtGeneration).toBe(1.0);
    expect(onCostResolved).toHaveBeenCalledWith(event.cost);
    expect(event.cost).toEqual({ estimatedCostUsd: 0.04, costSource: "pricing_table" });
  });

  it("inclui usageMeta e componentes da fórmula no metadata do evento", async () => {
    mockResolveAiCost.mockResolvedValue({
      estimatedCostUsd: 0.065,
      costSource: "pricing_table",
      costFormulaVersion: "responses_image_generation_v2",
      imageToolComponentUsd: 0.065,
      costEstimationNote: "provisional_image_tool_unit_cost_until_provider_reconciliation",
    });
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit({
      ...imageEditEnvelope,
      capability: "campaign_image",
      protocol: "responses",
      model: "gpt-5.5",
      usageMeta: {
        imageGenerationTool: true,
        providerUsageSource: "responses.image_generation",
        responsesModel: "gpt-5.5",
      },
    });

    const event = mockRecord.mock.calls[0][0];
    expect(event.metadata).toEqual(
      expect.objectContaining({
        capability: "campaign_image",
        protocol: "responses",
        image_generation_tool: true,
        responses_model: "gpt-5.5",
        cost_formula_version: "responses_image_generation_v2",
        image_tool_component_usd: 0.065,
      }),
    );
  });

  it("persiste domainStatus/domainErrorType de envelope.metadata no AiCostEvent", async () => {
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit({
      ...imageEditEnvelope,
      metadata: { domainStatus: "failed", domainErrorType: "schema_validation_failed" },
    });

    const event = mockRecord.mock.calls[0][0];
    expect(event.metadata).toMatchObject({
      capability: "campaign_image_edit",
      protocol: "images",
      domainStatus: "failed",
      domainErrorType: "schema_validation_failed",
    });
  });

  it("envelope.metadata NÃO sobrescreve campos canônicos do sink", async () => {
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit({
      ...imageEditEnvelope,
      capability: "campaign_image",
      protocol: "responses",
      model: "gpt-5.5",
      usageMeta: { imageGenerationTool: true, responsesModel: "gpt-5.5" },
      metadata: {
        capability: "HACKED",
        protocol: "HACKED",
        responses_model: "HACKED",
        image_generation_tool: false,
        domainStatus: "success",
      },
    });

    const event = mockRecord.mock.calls[0][0];
    expect(event.metadata).toMatchObject({
      capability: "campaign_image",
      protocol: "responses",
      responses_model: "gpt-5.5",
      image_generation_tool: true,
      domainStatus: "success",
    });
  });

  it("record lançando NÃO propaga (fail-open — T-46-02c)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockRecord.mockRejectedValue(new Error("db indisponível"));
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await expect(sink.emit(imageEditEnvelope)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("resolveAiCost lançando NÃO propaga e não grava (fail-open)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockResolveAiCost.mockRejectedValue(new Error("pricing down"));
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await expect(sink.emit(imageEditEnvelope)).resolves.toBeUndefined();
    expect(mockRecord).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

describe("NoopAiTelemetrySink — apenas testes", () => {
  it("emit não lança e não persiste", () => {
    const sink = new NoopAiTelemetrySink();
    expect(() => sink.emit(imageEditEnvelope)).not.toThrow();
    expect(mockRecord).not.toHaveBeenCalled();
  });
});

describe("BufferingAiTelemetrySink — buffering e ordenação preservados", () => {
  it("acumula na ordem de emissão e entrega no flush", async () => {
    const flushed: AiCallEnvelope[][] = [];
    const sink = new BufferingAiTelemetrySink((envelopes) => {
      flushed.push(envelopes);
    });

    const first: AiCallEnvelope = { ...imageEditEnvelope, capability: "campaign_input_validation", protocol: "chat-completions", model: "gpt-4o" };
    const second: AiCallEnvelope = { ...imageEditEnvelope, capability: "campaign_image_review", protocol: "chat-completions", model: "gpt-4o" };
    const third: AiCallEnvelope = { ...imageEditEnvelope, capability: "campaign_image", protocol: "responses", model: "gpt-5.5" };

    sink.emit(first);
    sink.emit(second);
    sink.emit(third);

    expect(sink.pending).toEqual([first, second, third]);

    await sink.flush();

    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toEqual([first, second, third]);
    expect(sink.pending).toHaveLength(0);
  });

  it("flush sem envelopes não chama o handler", async () => {
    const handler = vi.fn();
    const sink = new BufferingAiTelemetrySink(handler);
    await sink.flush();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withDomainOutcome — classificação de domínio no MESMO envelope (D11)", () => {
  function makeTelemetry(): { telemetry: AiTelemetryContext; captured: AiCallEnvelope[] } {
    const captured: AiCallEnvelope[] = [];
    return {
      captured,
      telemetry: {
        operationRunId: "run-1",
        operationRunType: "campaign_delivery",
        traceId: "trace-1",
        storeId: "store-1",
        sink: {
          emit: (envelope) => {
            captured.push(envelope);
          },
        },
      },
    };
  }

  it("bufferiza e encaminha um ÚNICO envelope com domainStatus/domainErrorType no metadata", async () => {
    const { telemetry, captured } = makeTelemetry();
    const handle = withDomainOutcome(telemetry);

    await handle.telemetry.sink.emit(imageEditEnvelope);
    expect(captured).toHaveLength(0); // ainda bufferizado

    await handle.complete({ domainStatus: "failed", domainErrorType: "json_parse_failed" });

    expect(captured).toHaveLength(1);
    expect(captured[0].status).toBe("success"); // status permanece HTTP
    expect(captured[0].metadata).toEqual({
      domainStatus: "failed",
      domainErrorType: "json_parse_failed",
    });
  });

  it("complete() é idempotente (nunca emite um segundo envelope)", async () => {
    const { telemetry, captured } = makeTelemetry();
    const handle = withDomainOutcome(telemetry);

    await handle.telemetry.sink.emit(imageEditEnvelope);
    await handle.complete({ domainStatus: "success" });
    await handle.complete({ domainStatus: "success" });

    expect(captured).toHaveLength(1);
    expect(captured[0].metadata).toEqual({ domainStatus: "success" });
  });

  it("sem outcome (falha HTTP) encaminha o envelope como está, sem metadata de domínio", async () => {
    const { telemetry, captured } = makeTelemetry();
    const handle = withDomainOutcome(telemetry);

    await handle.telemetry.sink.emit({
      ...imageEditEnvelope,
      status: "failed",
      errorType: "rate_limit",
    });
    await handle.complete();

    expect(captured).toHaveLength(1);
    expect(captured[0].status).toBe("failed");
    expect(captured[0].metadata).toBeUndefined();
  });

  it("preserva metadata pré-existente do envelope ao anexar o domínio", async () => {
    const { telemetry, captured } = makeTelemetry();
    const handle = withDomainOutcome(telemetry);

    await handle.telemetry.sink.emit({ ...imageEditEnvelope, metadata: { custom: 1 } });
    await handle.complete({ domainStatus: "success" });

    expect(captured[0].metadata).toEqual({ custom: 1, domainStatus: "success" });
  });

  it("complete() é best-effort: falha do sink não escapa", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const telemetry: AiTelemetryContext = {
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      traceId: "trace-1",
      storeId: "store-1",
      sink: {
        emit: () => {
          throw new Error("sink down");
        },
      },
    };
    const handle = withDomainOutcome(telemetry);

    await handle.telemetry.sink.emit(imageEditEnvelope);

    await expect(handle.complete({ domainStatus: "success" })).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

describe("createDefaultTelemetryContext — sink obrigatório", () => {
  it("injeta o sink padrão quando nenhum sink é informado", () => {
    const ctx = createDefaultTelemetryContext(context);
    expect(ctx.sink).toBeInstanceOf(DefaultAiTelemetrySink);
    expect(ctx.operationRunId).toBe("run-1");
    expect(ctx.attemptNumber).toBe(2);
  });

  it("respeita um sink injetado (buffering/ordenação do caller)", () => {
    const custom = new NoopAiTelemetrySink();
    const ctx = createDefaultTelemetryContext({ ...context, sink: custom });
    expect(ctx.sink).toBe(custom);
  });
});
