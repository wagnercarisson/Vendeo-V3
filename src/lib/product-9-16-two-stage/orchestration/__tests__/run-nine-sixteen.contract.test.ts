// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/campaign/composition-artifacts/access", () => ({
  verifyCampaignAccess: async () => ({ ok: true, authorization: { kind: "system" } }),
}));
import { runNineSixteenTwoStageGeneration } from "../run-nine-sixteen";
import type { RunNineSixteenDeps, RunNineSixteenInput } from "../types";
import type { TwoStageOperationView } from "../../types";

const input: RunNineSixteenInput = {
  mode: "initial",
  storeId: "s",
  campaignId: "c",
  operationId: "o",
  authorization: { kind: "system" },
  requestStartedAtMs: 0,
};

function view(overrides: Partial<TwoStageOperationView> = {}): TwoStageOperationView {
  return {
    campaignId: "c",
    operationId: "o",
    origin: "9_16_two_stage",
    credit: { status: "reserved", terminal: false, delivered: false, refunded: false, reserved: true },
    base: { stage: "base", status: "done", attemptsUsed: 1, failureClass: null, attemptNumber: 1, claimedAt: null },
    expansion: { stage: "expansion", status: "pending", attemptsUsed: 0, failureClass: null, attemptNumber: null, claimedAt: null },
    unknown: false,
    failedOutcome: false,
    supportReference: null,
    nextAction: "acquire_expansion",
    canContinue: true,
    processingPhase: null,
    ...overrides,
  };
}

function deps(overrides: Partial<RunNineSixteenDeps> = {}): RunNineSixteenDeps {
  return {
    control: {
      getOperationView: vi.fn(async () => ({ kind: "found", view: view({ credit: { status: "delivered", terminal: true, delivered: true, refunded: false, reserved: false }, base: { ...view().base, status: "done" }, expansion: { ...view().expansion, status: "done" }, nextAction: "deliver" }) })),
      resume: vi.fn(),
      acquire: vi.fn(),
      finish: vi.fn(),
      recordOutcome: vi.fn(),
    } as never,
    financial: {
      reserveOperationOnce: vi.fn(),
      confirmOnVerticalDelivery: vi.fn(),
      refundOnDefinitiveFailure: vi.fn(),
      readFinancialAuthority: vi.fn(async () => ({ status: "reserved", terminal: false, delivered: false, refunded: false, reserved: true, storeId: "s" })),
    } as never,
    credit: { beginPublication: vi.fn(), getPublicationEpoch: vi.fn(), markArtUploaded: vi.fn(), deliver: vi.fn() } as never,
    clock: () => 0,
    callIdFactory: () => "call",
    newSupportReference: () => "ref",
    base: vi.fn(),
    prepare: vi.fn(),
    expand: vi.fn(),
    readFrozenState: vi.fn(),
    projectDelivered: vi.fn(),
    projectClosed: vi.fn(async () => ({ projected: true, reason: "projected" }) as never),
    probeVertical: { probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" })) } as never,
    generateThumbnail: vi.fn(),
    ...overrides,
  };
}

async function terminal(response: Response) {
  const text = await response.text();
  return JSON.parse(text.trim().split("\n").at(-1) ?? "{}");
}

describe("runNineSixteenTwoStageGeneration", () => {
  it("initial with existing operation is query-only", async () => {
    const d = deps();
    const response = await runNineSixteenTwoStageGeneration(input, d);
    expect(await terminal(response)).toMatchObject({ type: "result", campaignId: "c" });
    expect((d.financial as never as { reserveOperationOnce: { mock: { calls: unknown[] } } }).reserveOperationOnce.mock.calls).toHaveLength(0);
  });

  it("continue with exhausted limit refunds once and does not retry", async () => {
    const failedView = view({
      expansion: { stage: "expansion", status: "failed", attemptsUsed: 2, failureClass: "transient", attemptNumber: 2, claimedAt: null },
      nextAction: "blocked",
      canContinue: false,
    });
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "found", view: failedView })),
        resume: vi.fn(async () => ({ success: true, action: "blocked", nextTarget: null, creditStatus: "reserved", baseStatus: "done", baseAttempts: 1, expansionStatus: "failed", expansionAttempts: 2, unknown: false, failedOutcome: false })),
        recordOutcome: vi.fn(),
        finish: vi.fn(),
        acquire: vi.fn(),
      } as never,
      financial: {
        reserveOperationOnce: vi.fn(),
        confirmOnVerticalDelivery: vi.fn(),
        refundOnDefinitiveFailure: vi.fn(async () => ({ kind: "refunded", state: { status: "refunded" } })),
        readFinancialAuthority: vi.fn(async () => ({ status: "reserved", terminal: false, delivered: false, refunded: false, reserved: true, storeId: "s" })),
      } as never,
    });
    const response = await runNineSixteenTwoStageGeneration(
      { ...input, mode: "continue", acquisitionIds: { base: "11111111-1111-4111-8111-111111111111", expansion: "22222222-2222-4222-8222-222222222222" } },
      d,
    );
    expect(await terminal(response)).toMatchObject({ type: "error", refunded: true });
    expect((d.financial as never as { refundOnDefinitiveFailure: { mock: { calls: unknown[] } } }).refundOnDefinitiveFailure.mock.calls).toHaveLength(1);
  });
});
