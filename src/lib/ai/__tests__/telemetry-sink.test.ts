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
import { CAPABILITY_GENERATION_TYPE } from "../generation-type-map";
import { ALL_CAPABILITIES } from "../model-registry";
import type { AiCallEnvelope } from "../types";

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

  it("protocolo responses marca imageGenerationTool=true para o resolvedor de custo", async () => {
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit({
      ...imageEditEnvelope,
      capability: "campaign_image",
      protocol: "responses",
      model: "gpt-5.5",
    });

    expect(mockResolveAiCost).toHaveBeenCalledWith(
      expect.objectContaining({ imageGenerationTool: true, generationType: "campaign_image" }),
    );
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
