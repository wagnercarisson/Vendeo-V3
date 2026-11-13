// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/campaign/composition-artifacts/access", () => ({
  verifyCampaignAccess: async () => ({ ok: true, authorization: { kind: "system" } }),
}));
import { runNineSixteenTwoStageGeneration } from "../../run-nine-sixteen";
import { INTEGRATED_VIEW, makeIntegratedDeps } from "./helpers";

describe("integrated resume and budget", () => {
  it("does not acquire when the budget cannot afford the step", async () => {
    const deps = makeIntegratedDeps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "found", view: INTEGRATED_VIEW })),
        resume: vi.fn(async () => ({
          success: true,
          action: "acquire_base",
          nextTarget: "primary",
          origin: "9_16_two_stage",
          creditStatus: "reserved",
          baseStatus: "pending",
          baseAttempts: 0,
          expansionStatus: "pending",
          expansionAttempts: 0,
          unknown: false,
          failedOutcome: false,
        })),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const response = await runNineSixteenTwoStageGeneration(
      {
        mode: "continue",
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        authorization: { kind: "system" },
        requestStartedAtMs: 0,
        timeoutMs: 1,
        acquisitionIds: {
          base: "11111111-1111-4111-8111-111111111111",
          expansion: "22222222-2222-4222-8222-222222222222",
        },
      },
      deps,
    );
    expect(await response.text()).toContain('"type":"processing"');
    expect((deps.control.acquire as never as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });
});
