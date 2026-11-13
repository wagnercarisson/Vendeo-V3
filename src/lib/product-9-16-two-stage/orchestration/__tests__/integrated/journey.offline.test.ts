// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/campaign/composition-artifacts/access", () => ({
  verifyCampaignAccess: async () => ({ ok: true, authorization: { kind: "system" } }),
}));
import { runNineSixteenTwoStageGeneration } from "../../run-nine-sixteen";
import { makeIntegratedDeps } from "./helpers";

describe("integrated journey", () => {
  it("runs base -> preparation -> expansion -> delivery with one reservation/confirmation", async () => {
    const deps = makeIntegratedDeps();
    const response = await runNineSixteenTwoStageGeneration(
      {
        mode: "initial",
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        authorization: { kind: "system" },
        requestStartedAtMs: 0,
      },
      deps,
    );
    const text = await response.text();
    expect(text).toContain('"type":"result"');
    expect((deps.financial.reserveOperationOnce as never as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
    expect((deps.financial.confirmOnVerticalDelivery as never as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
    expect((deps.projectDelivered as never as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
  });
});
