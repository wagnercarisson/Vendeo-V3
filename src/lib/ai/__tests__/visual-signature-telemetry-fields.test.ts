// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { DefaultAiTelemetrySink } from "../telemetry-sink";
import type { AiCallEnvelope } from "../types";

const context = {
  operationRunId: "run-1",
  operationRunType: "visual_signature" as const,
  traceId: "trace-1",
  storeId: "store-1",
  attemptNumber: 2,
};

const envelope: AiCallEnvelope = {
  capability: "visual_signature_image",
  protocol: "responses",
  status: "success",
  provider: "openai",
  model: "gpt-6-luna",
  quality: "medium",
  durationMs: 1234,
  attemptNumber: 2,
  usage: { promptTokens: 1000, completionTokens: 500 },
  usageMeta: {
    responsesModel: "gpt-6-luna",
    imageGenerationModel: "gpt-image-2.5-sunburst",
    imageGenerationTool: true,
    imageToolUsage: { outputImageTokens: 196 },
    imageToolUsageSource: "tool_output",
  },
  metadata: {
    visual_signature_preset: "sunburst_medium",
    config_version_id: "config-1",
    reasoning_effort: "low",
    image_model: "gpt-image-2.5-sunburst",
    image_quality: "medium",
    attempt_number: 9,
    retry_used: true,
    retry_prompt_variant: "simplified",
    credential_scope: "validation",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRecord.mockResolvedValue(undefined);
  mockResolveAiCost.mockResolvedValue({
    estimatedCostUsd: 0.0147,
    costSource: "pricing_table",
    costCoverage: "complete",
    costEstimationNote: null,
    orchestratorPricingVersion: "orch-v1",
    imagePricingVersion: "image-v1",
  });
});

function emitted() {
  return mockRecord.mock.calls[0][0];
}

describe("F47.1 — campos de telemetria da Assinatura Visual", () => {
  it("persiste configuração, tentativa e custo em campos distintos", async () => {
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);
    await sink.emit(envelope);

    expect(mockResolveAiCost).toHaveBeenCalledWith(
      expect.objectContaining({
        visualSignaturePreset: "sunburst_medium",
        imageGenerationModel: "gpt-image-2.5-sunburst",
        imageQuality: "medium",
        imageToolUsage: { outputImageTokens: 196 },
        imageToolUsageSource: "tool_output",
        configVersionId: "config-1",
        generationType: "visual_signature_image",
      }),
    );

    const event = emitted();
    expect(event.attemptNumber).toBe(2);
    expect(event.cost.costCoverage).toBe("complete");
    expect(event.cost.providerReportedCostUsd).toBeUndefined();
    expect(event.metadata).toMatchObject({
      responses_model: "gpt-6-luna",
      image_model: "gpt-image-2.5-sunburst",
      image_quality: "medium",
      visual_signature_preset: "sunburst_medium",
      reasoning_effort: "low",
      config_version_id: "config-1",
      attempt_number: 2,
      retry_used: true,
      retry_prompt_variant: "simplified",
      credential_scope: "validation",
      cost_coverage: "complete",
      cost_source: "pricing_table",
      cost_estimation_note: null,
      provider_reported_cost_usd: null,
      orchestrator_pricing_version: "orch-v1",
      image_pricing_version: "image-v1",
    });
  });

  it("cobertura parcial/desconhecida mantém motivo explícito", async () => {
    mockResolveAiCost.mockResolvedValue({
      estimatedCostUsd: null,
      costSource: "not_available",
      costCoverage: "partial",
      costEstimationNote: "visual_signature_image_estimate_no_usage",
    });

    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);
    await sink.emit({ ...envelope, usage: undefined });

    expect(emitted().metadata).toMatchObject({
      cost_coverage: "partial",
      cost_source: "not_available",
      cost_estimation_note: "visual_signature_image_estimate_no_usage",
    });
  });

  it("custo reportado e estimativa não se sobrescrevem", async () => {
    mockResolveAiCost.mockResolvedValue({
      estimatedCostUsd: 0.0153,
      providerReportedCostUsd: 0.2,
      costSource: "provider_reported",
      costCoverage: "complete",
      costEstimationNote: "provider_reported_separate",
    });

    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);
    await sink.emit(envelope);

    const event = emitted();
    expect(event.cost.estimatedCostUsd).toBe(0.0153);
    expect(event.cost.providerReportedCostUsd).toBe(0.2);
    expect(event.metadata).toMatchObject({
      cost_source: "provider_reported",
      provider_reported_cost_usd: 0.2,
      cost_coverage: "complete",
    });
  });

  it("produção com chave compartilhada permanece normal, sem virar dedicada", async () => {
    mockResolveAiCost.mockResolvedValue({
      estimatedCostUsd: 0.0147,
      costSource: "pricing_table",
      costCoverage: "complete",
    });

    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);
    await sink.emit({
      ...envelope,
      metadata: { ...envelope.metadata, credential_scope: "normal" },
    });

    const event = emitted();
    expect(event.metadata?.credential_scope).toBe("normal");
    expect(JSON.stringify(event)).not.toMatch(/sk-(?:prod|local|shared|[A-Za-z0-9])/);
  });

  it("validação semântica dedicada registra credential_scope sem depender do preset", async () => {
    mockResolveAiCost.mockResolvedValue({
      estimatedCostUsd: 0.001,
      costSource: "pricing_table",
    });

    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);
    await sink.emit({
      capability: "visual_signature_validation",
      protocol: "responses",
      status: "success",
      provider: "openai",
      model: "gpt-6-luna",
      durationMs: 10,
      attemptNumber: 1,
      usage: { promptTokens: 100, completionTokens: 20 },
      usageMeta: { responsesModel: "gpt-6-luna" },
      metadata: {
        credential_scope: "validation",
        retry_used: true,
        retry_prompt_variant: "full",
      },
    });

    expect(emitted().metadata).toMatchObject({
      credential_scope: "validation",
      retry_used: true,
      retry_prompt_variant: "full",
      attempt_number: 1,
      visual_signature_preset: null,
      cost_coverage: null,
    });
  });

  it("caller não forja cobertura de custo", async () => {
    mockResolveAiCost.mockResolvedValue({
      estimatedCostUsd: null,
      costSource: "not_available",
      costCoverage: "unknown",
      costEstimationNote: "visual_signature_pricing_missing",
    });

    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);
    await sink.emit({
      ...envelope,
      metadata: { ...envelope.metadata, cost_coverage: "complete", cost_source: "pricing_table" },
    });

    expect(emitted().metadata).toMatchObject({
      cost_coverage: "unknown",
      cost_source: "not_available",
    });
  });
});
