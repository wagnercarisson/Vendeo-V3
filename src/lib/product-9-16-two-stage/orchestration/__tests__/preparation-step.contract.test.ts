// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
import { runPreparationStep } from "../preparation-step";

describe("runPreparationStep", () => {
  it("is free and completes on prepared", async () => {
    const prepare = vi.fn(async () => ({
      kind: "prepared",
      artifact: {},
      bytes: Buffer.alloc(0),
      persistence: "created",
    }) as never);
    const result = await runPreparationStep(
      {
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        authorization: { kind: "system" },
      },
      { prepare },
    );
    expect(result).toEqual({ kind: "completed" });
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("maps deterministic failure to definitive", async () => {
    const result = await runPreparationStep(
      {
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        authorization: { kind: "system" },
      },
      {
        prepare: async () => ({ kind: "transform_failed", reason: "source_not_jpeg" }),
      },
    );
    expect(result).toEqual({ kind: "definitive", reason: "transform_failed" });
  });
});
