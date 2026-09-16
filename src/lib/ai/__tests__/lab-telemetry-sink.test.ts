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

import { LabTelemetrySink } from "../lab-telemetry-sink";
import type { LabCallEntry } from "../lab-telemetry-sink";
import type { AiCallEnvelope } from "../types";
import type { CostResolution } from "@/lib/ai-cost/types";

/**
 * F48.1 (D6/D8/D15/T-48-1-35/36/37) — sink capturador do laboratório.
 */

const FULL_COST: CostResolution = {
  estimatedCostUsd: 0.0421,
  costSource: "pricing_table",
  pricingVersion: "11111111-1111-4111-8111-111111111111",
  costFormulaVersion: "responses_image_generation_v2",
  textComponentUsd: 0.0121,
  imageToolComponentUsd: 0.03,
  imageToolPricingProvider: "openai",
  imageToolPricingModel: "gpt-image-1",
  imageToolPricingVersion: "22222222-2222-4222-8222-222222222222",
};

const successEnvelope: AiCallEnvelope = {
  capability: "campaign_image",
  protocol: "responses",
  status: "success",
  provider: "openai",
  model: "gpt-5.5",
  durationMs: 8123,
  usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
  usageMeta: { imageGenerationTool: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveAiCost.mockResolvedValue(FULL_COST);
  mockRecord.mockResolvedValue(undefined);
});

describe("LabTelemetrySink — custo em leitura, sem persistência produtiva", () => {
  it("acumula 1 entrada por envelope, preservando a CostResolution real e completa", async () => {
    const sink = new LabTelemetrySink();

    await sink.emit(successEnvelope);

    expect(sink.entries).toHaveLength(1);
    const entry = sink.entries[0];
    expect(entry.capability).toBe("campaign_image");
    expect(entry.provider).toBe("openai");
    expect(entry.model).toBe("gpt-5.5");
    expect(entry.protocol).toBe("responses");
    expect(entry.status).toBe("success");
    expect(entry.durationMs).toBe(8123);
    expect(entry.usage).toEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120 });
    expect(entry.cost).toEqual(FULL_COST);
    expect(entry.errorType).toBeUndefined();
  });

  it("chama resolveAiCost com imageGenerationTool=true e generationType de CAPABILITY_GENERATION_TYPE", async () => {
    const sink = new LabTelemetrySink();

    await sink.emit(successEnvelope);

    expect(mockResolveAiCost).toHaveBeenCalledTimes(1);
    expect(mockResolveAiCost).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        model: "gpt-5.5",
        imageGenerationTool: true,
        generationType: "campaign_image",
      }),
    );
  });

  it("imageGenerationTool=false quando usageMeta está ausente", async () => {
    const sink = new LabTelemetrySink();

    await sink.emit({ ...successEnvelope, usageMeta: undefined });

    expect(mockResolveAiCost).toHaveBeenCalledWith(
      expect.objectContaining({ imageGenerationTool: false, generationType: "campaign_image" }),
    );
  });

  it("imageGenerationTool=false quando usageMeta declara false", async () => {
    const sink = new LabTelemetrySink();

    await sink.emit({ ...successEnvelope, usageMeta: { imageGenerationTool: false } });

    expect(mockResolveAiCost).toHaveBeenCalledWith(
      expect.objectContaining({ imageGenerationTool: false }),
    );
  });

  it("nunca chama o tracker de custos (zero persistência produtiva)", async () => {
    const sink = new LabTelemetrySink();

    await sink.emit(successEnvelope);

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it("envelope de falha registra o errorType sanitizado", async () => {
    const sink = new LabTelemetrySink();

    await sink.emit({
      ...successEnvelope,
      status: "failed",
      errorType: "Bearer sk-abcdefghijklmnop",
    });

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].status).toBe("failed");
    expect(sink.entries[0].errorType).toBe("Bearer [redacted]");
    expect(sink.entries[0].errorType).not.toContain("sk-");
  });

  it("envelope de timeout mantém o status e acumula uma entrada", async () => {
    const sink = new LabTelemetrySink();

    await sink.emit({ ...successEnvelope, status: "timeout", errorType: "timeout" });

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].status).toBe("timeout");
    expect(sink.entries[0].errorType).toBe("timeout");
  });

  it("exceção em resolveAiCost não propaga e gera entrada sanitizada", async () => {
    mockResolveAiCost.mockRejectedValue(new Error("falha ao consultar https://exemplo.test/x"));

    const sink = new LabTelemetrySink();

    await expect(sink.emit(successEnvelope)).resolves.toBeUndefined();
    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0].cost).toEqual({ estimatedCostUsd: null, costSource: "not_available" });
    expect(sink.entries[0].errorType).toBe("falha ao consultar [redacted-url]");
  });

  it("onEntry é chamado a cada entrada acumulada", async () => {
    const seen: LabCallEntry[] = [];
    const sink = new LabTelemetrySink({ onEntry: (entry) => seen.push(entry) });

    await sink.emit(successEnvelope);
    await sink.emit({ ...successEnvelope, model: "gpt-5.5-2026-04-23" });

    expect(seen).toHaveLength(2);
    expect(sink.entries).toHaveLength(2);
    expect(seen[1]).toBe(sink.entries[1]);
  });

  it("falha do onEntry não propaga, não duplica a entrada e preserva o custo real", async () => {
    const onEntry = vi.fn(() => {
      throw new Error("stream NDJSON desconectado");
    });
    const sink = new LabTelemetrySink({ onEntry });

    await expect(sink.emit(successEnvelope)).resolves.toBeUndefined();

    expect(onEntry).toHaveBeenCalledTimes(1);
    expect(sink.entries).toHaveLength(1);
    // A entrada original e a CostResolution real permanecem intactas.
    expect(sink.entries[0].cost).toEqual(FULL_COST);
    expect(sink.entries[0].errorType).toBeUndefined();
    expect(sink.costSummary?.estimatedCostUsd).toBe(FULL_COST.estimatedCostUsd);
    expect(sink.costSummary?.costSource).toBe("pricing_table");
  });

  it("falha contínua do onEntry mantém exatamente 1 entrada por emit", async () => {
    const onEntry = vi.fn(() => {
      throw new Error("consumer down");
    });
    const sink = new LabTelemetrySink({ onEntry });

    await sink.emit(successEnvelope);
    await sink.emit({ ...successEnvelope, model: "gpt-5.5-2026-04-23" });

    expect(onEntry).toHaveBeenCalledTimes(2);
    expect(sink.entries).toHaveLength(2);
    expect(sink.entries.every((entry) => entry.cost.costSource === "pricing_table")).toBe(true);
  });

  it("costSummary é null sem entradas", () => {
    expect(new LabTelemetrySink().costSummary).toBeNull();
  });

  it("costSummary soma apenas custos não nulos e mantém a fonte da última entrada", async () => {
    const sink = new LabTelemetrySink();
    mockResolveAiCost
      .mockResolvedValueOnce(FULL_COST)
      .mockResolvedValueOnce({ estimatedCostUsd: null, costSource: "not_available" })
      .mockResolvedValueOnce({ estimatedCostUsd: 0.0079, costSource: "provider_reported" });

    await sink.emit(successEnvelope);
    await sink.emit({ ...successEnvelope, model: "gpt-5.5-2026-04-23" });
    await sink.emit({ ...successEnvelope, model: "gpt-5.5-2026-04-24" });

    const summary = sink.costSummary;
    expect(summary).not.toBeNull();
    expect(summary?.estimatedCostUsd).toBe(0.05);
    expect(summary?.costSource).toBe("provider_reported");
  });

  it("costSummary é null quando todas as entradas têm custo desconhecido", async () => {
    mockResolveAiCost.mockResolvedValue({ estimatedCostUsd: null, costSource: "not_available" });
    const sink = new LabTelemetrySink();

    await sink.emit(successEnvelope);

    expect(sink.costSummary?.estimatedCostUsd).toBeNull();
  });
});
