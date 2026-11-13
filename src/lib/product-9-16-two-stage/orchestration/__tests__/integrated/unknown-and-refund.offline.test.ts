// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/campaign/composition-artifacts/access", () => ({
  verifyCampaignAccess: async () => ({ ok: true, authorization: { kind: "system" } }),
}));
import { runNineSixteenTwoStageGeneration } from "../../run-nine-sixteen";
import { INTEGRATED_VIEW, makeIntegratedDeps } from "./helpers";

function baseInput() {
  return {
    mode: "continue" as const,
    storeId: "s",
    campaignId: "c",
    operationId: "o",
    authorization: { kind: "system" as const },
    requestStartedAtMs: 0,
    acquisitionIds: {
      base: "11111111-1111-4111-8111-111111111111",
      expansion: "22222222-2222-4222-8222-222222222222",
    },
  };
}

function continueDeps(base: unknown) {
  return makeIntegratedDeps({
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
      acquire: vi.fn(async () => ({
        acquired: true,
        authorization: "execute",
        reason: null,
        attemptToken: "t",
        attemptNumber: 1,
        stage: "base",
        target: "primary",
      })),
      finish: vi.fn(async () => ({
        success: true,
        idempotent: false,
        status: "failed",
        stage: "base",
        attemptNumber: 1,
      })),
      recordOutcome: vi.fn(async () => ({
        success: true,
        idempotent: false,
        outcome: "unknown",
        stage: "base",
        supportReference: null,
      })),
    },
    base: vi.fn(async () => base),
  });
}

describe("integrated unknown and refund", () => {
  it("persists unknown without refund or retry", async () => {
    const deps = continueDeps({ kind: "unknown_result" });
    const response = await runNineSixteenTwoStageGeneration(baseInput(), deps);
    expect(await response.text()).toContain('"type":"unknown"');
    expect((deps.financial.refundOnDefinitiveFailure as never as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });
});
