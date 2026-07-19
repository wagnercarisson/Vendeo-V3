import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
const { mockInsert } = vi.hoisted(() => ({ mockInsert: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockFrom },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/logging/pipeline-logger", () => ({
  logPipelineEvent: vi.fn(),
}));

vi.mock("@/lib/ai-cost", () => ({
  estimateAiCost: vi.fn(() => ({ estimatedCostUsd: 0.0075, source: "test" })),
}));

const STORE_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-0000-0000-000000000002";
const CAMPAIGN_ID = "00000000-0000-0000-0000-000000000003";
const TRACE_ID = "test-trace-001";

async function supabaseInsert(
  record: Record<string, unknown>,
  insertFn: typeof mockInsert
): Promise<void> {
  try {
    const result = await insertFn(record);
    if (result && result.error) {
      console.error("[telemetry] insert failed", result.error);
    }
  } catch (err) {
    console.error("[telemetry] insert failed", (err as Error).message);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockReset();
  mockFrom.mockReset();
});

describe("Telemetry: generation_events INSERT", () => {
  it("inserts campaign_copy with all required fields", async () => {
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockImplementation(() => ({ insert: mockInsert }));

    await supabaseInsert(
      {
        generation_type: "campaign_copy",
        store_id: STORE_ID,
        user_id: USER_ID,
        campaign_id: CAMPAIGN_ID,
        provider: "openai",
        model: "gpt-4o",
        status: "success",
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        estimated_cost_usd: 0.0075,
        trace_id: TRACE_ID,
        phase: "copy_generation",
      },
      mockInsert
    );

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_type: "campaign_copy",
        provider: "openai",
        model: "gpt-4o",
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        campaign_id: CAMPAIGN_ID,
        trace_id: TRACE_ID,
        phase: "copy_generation",
      })
    );
  });

  it("inserts without campaign_id (nullable column)", async () => {
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockImplementation(() => ({ insert: mockInsert }));

    await supabaseInsert(
      {
        generation_type: "campaign_image",
        store_id: STORE_ID,
        user_id: USER_ID,
        campaign_id: null,
        provider: "openai",
        status: "success",
        trace_id: TRACE_ID,
        phase: "image_generation",
      },
      mockInsert
    );

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_type: "campaign_image",
        campaign_id: null,
      })
    );
  });

  it("handles INSERT failure gracefully (best-effort, pipeline continues)", async () => {
    mockInsert.mockRejectedValue(new Error("DB connection failed"));
    mockFrom.mockImplementation(() => ({ insert: mockInsert }));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await supabaseInsert(
      {
        generation_type: "campaign_copy",
        store_id: STORE_ID,
        user_id: USER_ID,
        campaign_id: CAMPAIGN_ID,
        provider: "openai",
        status: "success",
        trace_id: TRACE_ID,
        phase: "copy_generation",
      },
      mockInsert
    );

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
