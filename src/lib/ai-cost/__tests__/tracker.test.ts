import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import { AiCostTracker } from "../tracker";
import { COST_SOURCES, OPERATION_RUN_TYPES } from "../types";
import type { AiCostEvent, CostSource } from "../types";
import type { GenerationEventType } from "@/lib/visual-signature/types";
import { insertGenerationEvent } from "@/lib/visual-signature/generation-events";

const mockFrom = vi.fn();
const mockInsert = vi.fn();
const mockAdminClient = { from: mockFrom };

let tracker: AiCostTracker;

const baseEvent: AiCostEvent = {
  operationRunId: "11111111-1111-4111-8111-111111111111",
  operationRunType: "campaign_delivery",
  traceId: "trace-1",
  storeId: "store-1",
  generationType: "campaign_pipeline",
  provider: "openai",
  model: "gpt-4o",
  attemptNumber: 1,
  durationMs: 100,
  status: "success",
};

beforeEach(() => {
  vi.clearAllMocks();
  tracker = new AiCostTracker(mockAdminClient as any);
  mockFrom.mockImplementation((table: string) => {
    if (table === "generation_events") return { insert: mockInsert };
    return {};
  });
  mockInsert.mockResolvedValue({ error: null });
});

describe("tipos centrais (contrato F38.1)", () => {
  it("COST_SOURCES contém exatamente os 5 valores de D4", () => {
    expect(COST_SOURCES).toEqual([
      "provider_reported",
      "pricing_table",
      "fallback_static",
      "manual_unknown",
      "not_available",
    ]);
  });

  it("OPERATION_RUN_TYPES contém os 4 domínios de D1", () => {
    expect(OPERATION_RUN_TYPES).toEqual([
      "campaign_delivery",
      "visual_signature",
      "brand_profile",
      "theme",
    ]);
  });

  it("AiCostEvent sem cost compila (delivery) e com tokens + not_available compila (D4)", () => {
    const delivery: AiCostEvent = {
      operationRunId: "11111111-1111-4111-8111-111111111111",
      operationRunType: "campaign_delivery",
      traceId: "trace-delivery",
      storeId: "store-1",
      generationType: "campaign_pipeline",
      provider: "openai",
      model: "gpt-4o",
      attemptNumber: 1,
      durationMs: 5200,
      status: "success",
    };

    const notAvailable: AiCostEvent = {
      ...delivery,
      generationType: "campaign_copy",
      tokens: { promptTokens: 120, completionTokens: 40 },
      cost: { estimatedCostUsd: null, costSource: "not_available" },
    };

    expect(delivery.cost).toBeUndefined();
    expect(delivery.tokens).toBeUndefined();
    expect(notAvailable.cost?.costSource).toBe("not_available");
    expect(notAvailable.cost?.estimatedCostUsd).toBeNull();
    expect(notAvailable.tokens?.promptTokens).toBe(120);
  });

  it("GenerationEventType aceita os 12 valores da migration (D5)", () => {
    const types: GenerationEventType[] = [
      "campaign_pipeline",
      "campaign_copy",
      "campaign_input_validation",
      "campaign_image",
      "campaign_image_review",
      "visual_signature",
      "visual_signature_image",
      "visual_signature_validation",
      "brand_profile_without_logo",
      "brand_profile_with_logo",
      "brand_profile_vision",
      "brand_profile_text",
    ];
    expect(types).toHaveLength(12);
    // Os 6 tipos novos call-level existem (D5)
    expect(types).toContain("campaign_input_validation");
    expect(types).toContain("campaign_image_review");
    expect(types).toContain("visual_signature_image");
    expect(types).toContain("visual_signature_validation");
    expect(types).toContain("brand_profile_vision");
    expect(types).toContain("brand_profile_text");
  });
});

describe("AiCostTracker", () => {
  it("startRun gera operationRunId e traceId distintos (UUID v4 — D1)", () => {
    const run = tracker.startRun("campaign_delivery");
    expect(run.operationRunId).not.toBe(run.traceId);
    expect(run.operationRunId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("record grava todas as colunas novas (D2)", async () => {
    await tracker.record({
      operationRunId: "run-1",
      operationRunType: "visual_signature",
      traceId: "trace-1",
      storeId: "store-1",
      userId: "user-1",
      campaignId: null,
      visualSignatureId: "vs-1",
      themeId: null,
      generationType: "visual_signature_image",
      provider: "openai",
      model: "gpt-4o",
      attemptNumber: 2,
      durationMs: 345,
      status: "success",
      tokens: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        cachedInputTokens: 4,
        imageTokens: 5,
      },
      cost: {
        estimatedCostUsd: 0.001,
        providerReportedCostUsd: null,
        costSource: "pricing_table",
        pricingVersion: "uuid-1",
      },
      metadata: { phase: "image_generation" },
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];
    expect(row.operation_run_id).toBe("run-1");
    expect(row.operation_run_type).toBe("visual_signature");
    expect(row.trace_id).toBe("trace-1");
    expect(row.store_id).toBe("store-1");
    expect(row.user_id).toBe("user-1");
    expect(row.campaign_id).toBeNull();
    expect(row.visual_signature_id).toBe("vs-1");
    expect(row.theme_id).toBeNull();
    expect(row.generation_type).toBe("visual_signature_image");
    expect(row.provider).toBe("openai");
    expect(row.model).toBe("gpt-4o");
    expect(row.attempt_number).toBe(2);
    expect(row.duration_ms).toBe(345);
    expect(row.status).toBe("success");
    expect(row.prompt_tokens).toBe(10);
    expect(row.completion_tokens).toBe(20);
    expect(row.total_tokens).toBe(30);
    expect(row.cached_input_tokens).toBe(4);
    expect(row.image_tokens).toBe(5);
    expect(row.estimated_cost_usd).toBe(0.001);
    expect(row.provider_reported_cost_usd).toBeNull();
    expect(row.cost_source).toBe("pricing_table");
    expect(row.pricing_version).toBe("uuid-1");
    expect(row.metadata).toEqual({ phase: "image_generation" });
  });

  it("record nunca lança quando a escrita rejeita (best-effort — D7)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInsert.mockRejectedValue(new Error("network timeout"));

    await expect(
      tracker.record({ ...baseEvent, generationType: "campaign_copy", cost: { estimatedCostUsd: 0.01, costSource: "pricing_table" } }),
    ).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("record loga erro retornado pelo supabase e resolve sem lançar", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInsert.mockResolvedValue({ error: { message: "insert conflict" } });

    await expect(tracker.record(baseEvent)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("delivery marker grava custo/tokens NULL + flag de pipeline (D1/D6)", async () => {
    await tracker.record({
      ...baseEvent,
      operationRunId: "run-2",
      metadata: { phase: "pipeline_complete" },
    });

    const row = mockInsert.mock.calls[0][0];
    expect(row.estimated_cost_usd).toBeNull();
    expect(row.provider_reported_cost_usd).toBeNull();
    expect(row.cost_source).toBeNull();
    expect(row.pricing_version).toBeNull();
    expect(row.prompt_tokens).toBeNull();
    expect(row.completion_tokens).toBeNull();
    expect(row.total_tokens).toBeNull();
    expect(row.cached_input_tokens).toBeNull();
    expect(row.image_tokens).toBeNull();
    expect(row.metadata).toEqual({ phase: "pipeline_complete", duration_is_pipeline: true });
  });

  it("evento not_available grava tokens com custo NULL (D4)", async () => {
    await tracker.record({
      ...baseEvent,
      generationType: "campaign_copy",
      tokens: { promptTokens: 120, completionTokens: 40 },
      cost: { estimatedCostUsd: null, costSource: "not_available" },
    });

    const row = mockInsert.mock.calls[0][0];
    expect(row.prompt_tokens).toBe(120);
    expect(row.completion_tokens).toBe(40);
    expect(row.estimated_cost_usd).toBeNull();
    expect(row.provider_reported_cost_usd).toBeNull();
    expect(row.cost_source).toBe("not_available");
    expect(row.metadata).toEqual({});
  });

  it("mesmo operationRunId em N records → N inserts com o mesmo operation_run_id (D1)", async () => {
    const run = { operationRunId: "run-x", traceId: "trace-x" };
    for (let attempt = 1; attempt <= 3; attempt++) {
      await tracker.record({
        ...baseEvent,
        operationRunId: run.operationRunId,
        traceId: run.traceId,
        attemptNumber: attempt,
        generationType: "campaign_image",
        cost: { estimatedCostUsd: 0.01, costSource: "pricing_table" },
      });
    }

    expect(mockInsert).toHaveBeenCalledTimes(3);
    for (const call of mockInsert.mock.calls) {
      expect(call[0].operation_run_id).toBe("run-x");
    }
  });
});

describe("cost_source inválido (compile time — D4)", () => {
  it("valor fora de COST_SOURCES é rejeitado pelo TypeScript", () => {
    // @ts-expect-error — "invalid" não está em COST_SOURCES (D4)
    const invalid: CostSource = "invalid";
    expect(invalid).toBe("invalid");
  });
});

describe("insertGenerationEvent (delegação ao tracker — D11)", () => {
  it("delega a gravação ao AiCostTracker.record e retorna valor compatível", async () => {
    const recordSpy = vi
      .spyOn(AiCostTracker.prototype, "record")
      .mockResolvedValue(undefined);

    const result = await insertGenerationEvent({
      store_id: "store-1",
      generation_type: "visual_signature",
      provider: "openai",
      attempt_number: 1,
      status: "success",
      duration_ms: 1200,
      asset_generated: true,
      has_logo: false,
      has_generated_signature: true,
      has_brand_profile: false,
    });

    expect(recordSpy).toHaveBeenCalledTimes(1);
    const event = recordSpy.mock.calls[0][0] as AiCostEvent;
    expect(event.storeId).toBe("store-1");
    expect(event.generationType).toBe("visual_signature");
    expect(event.operationRunType).toBe("visual_signature");
    expect(event.attemptNumber).toBe(1);
    expect(event.status).toBe("success");
    // Sem cost/tokens no insert → delivery marker
    expect(event.cost).toBeUndefined();
    expect(event.tokens).toBeUndefined();
    // Retorno compatível com o uso existente (consumidores apenas await — promise resolvida)
    expect(result).toBeNull();

    recordSpy.mockRestore();
  });
});
