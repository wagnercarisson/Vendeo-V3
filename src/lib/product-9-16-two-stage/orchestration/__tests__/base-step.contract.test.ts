// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
import { runBaseStep } from "../base-step";
import type { TwoStageOperationView } from "../../types";
import { durableReconstruction } from "./fixtures";

const content = {
  briefing: { product: { name: "P" }, commercial: { intent: "offer" }, constraints: {} },
  briefingText: "{}",
  campaignIntent: "offer",
  backgroundDirection: "studio",
  productImagesDataUrls: ["data:image/png;base64,AAAA"],
  referenceSelections: [],
  usdBrlRateAtGeneration: null,
  creditValueBrlAtGeneration: null,
} as never;

function view(baseStatus: TwoStageOperationView["base"]["status"]): TwoStageOperationView {
  const pending = (stage: "base" | "expansion") => ({
    stage,
    status: "pending" as const,
    attemptsUsed: 0,
    failureClass: null,
    attemptNumber: null,
    claimedAt: null,
  });
  return {
    campaignId: "c",
    operationId: "o",
    origin: "9_16_two_stage",
    credit: { status: "reserved", terminal: false, delivered: false, refunded: false, reserved: true },
    base: { ...pending("base"), status: baseStatus },
    expansion: pending("expansion"),
    unknown: false,
    failedOutcome: false,
    supportReference: null,
    nextAction: "acquire_base",
    canContinue: true,
    processingPhase: null,
  };
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    control: {
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
        status: "completed",
        stage: "base",
        attemptNumber: 1,
      })),
      getOperationView: vi.fn(async () => ({ kind: "found", view: view("in_progress") })),
    },
    base: vi.fn(async () => ({
      kind: "completed",
      copy: { kind: "not_requested" },
      art: { kind: "created", artifact: {}, snapshotOriginalId: "s" },
      call: null,
    })),
    clock: () => 0,
    ...durableReconstruction(),
    ...overrides,
  } as never;
}

function stepInput(frozenState: unknown, overrides: Record<string, unknown> = {}) {
  return {
    storeId: "s",
    campaignId: "c",
    operationId: "o",
    authorization: { kind: "system" },
    content,
    acquisitionId: "11111111-1111-4111-8111-111111111111",
    attemptReference: "ref",
    attemptTarget: "primary",
    deadlineAtMs: 100_000,
    baseStatus: "pending",
    allowNewPaidStep: true,
    frozenState,
    ...overrides,
  } as never;
}

function calls(d: unknown, path: string): unknown[] {
  const value = path.split(".").reduce<Record<string, unknown>>(
    (current, key) => current[key] as Record<string, unknown>,
    d as Record<string, unknown>,
  );
  return (value as { mock: { calls: unknown[] } }).mock.calls;
}

describe("runBaseStep", () => {
  it("acquires once and finishes completed", async () => {
    const d = deps();
    const result = await runBaseStep(stepInput({ kind: "complete" }), d);
    expect(result).toEqual({ kind: "completed" });
    expect(calls(d, "control.acquire")).toHaveLength(1);
    expect(calls(d, "control.finish")).toHaveLength(1);
  });

  it("does not acquire an in-progress base", async () => {
    const d = deps();
    const result = await runBaseStep(
      { ...(stepInput({ kind: "complete" }) as object), baseStatus: "in_progress" } as never,
      d,
    );
    expect(result).toMatchObject({ kind: "processing", state: "step_in_progress" });
    expect(calls(d, "control.acquire")).toHaveLength(0);
  });

  it("reconstructs durable content when frozen is complete (no caller content)", async () => {
    const d = deps();
    await runBaseStep(stepInput({ kind: "complete" }), d);
    const baseCalls = calls(d, "base") as Array<[{ productImagesDataUrls: readonly string[] }]>;
    expect(baseCalls).toHaveLength(1);
    expect(baseCalls[0][0].productImagesDataUrls).toHaveLength(1);
    expect(baseCalls[0][0].productImagesDataUrls[0]).toMatch(/^data:image\/png;base64,/);
  });

  it("never advances when finish is refused and the step is not done", async () => {
    const d = deps({
      control: {
        acquire: vi.fn(async () => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: "base",
          target: "primary",
        })),
        finish: vi.fn(async () => ({ success: false, reason: "operation_terminal" })),
        getOperationView: vi.fn(async () => ({ kind: "found", view: view("in_progress") })),
      },
    });
    const result = await runBaseStep(stepInput({ kind: "complete" }), d);
    expect(result).toMatchObject({ kind: "unknown" });
    expect(result).not.toMatchObject({ kind: "completed" });
    expect(calls(d, "control.getOperationView")).toHaveLength(1);
  });

  it("accepts a late execution already persisted as done", async () => {
    const d = deps({
      control: {
        acquire: vi.fn(async () => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: "base",
          target: "primary",
        })),
        finish: vi.fn(async () => ({ success: false, reason: "invalid_transition" })),
        getOperationView: vi.fn(async () => ({ kind: "found", view: view("done") })),
      },
    });
    await expect(runBaseStep(stepInput({ kind: "complete" }), d)).resolves.toEqual({
      kind: "completed",
    });
  });

  it("treats a pre-call reconstruction read failure as recoverable processing", async () => {
    const failingClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: "boom" } }),
          }),
        }),
      }),
    } as never;
    const d = deps({ client: failingClient, readInputBytes: undefined });
    const result = await runBaseStep(stepInput({ kind: "absent" }), d);
    expect(result).toMatchObject({
      kind: "processing",
      state: "between_steps",
      nextStep: "base",
      canContinue: true,
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "base")).toHaveLength(0);
  });

  it("rechecks cancellation after reconstruction and before acquire", async () => {
    const controller = new AbortController();
    const d = deps({
      readInputBytes: async () => {
        controller.abort();
        return { kind: "bytes", bytes: Buffer.from("durable-image-bytes") };
      },
    });
    const result = await runBaseStep(
      stepInput({ kind: "complete" }, { signal: controller.signal }),
      d,
    );
    expect(result).toMatchObject({
      kind: "processing",
      reason: "aborted",
      canContinue: true,
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "base")).toHaveLength(0);
  });

  it("rechecks the deadline after reconstruction and before acquire", async () => {
    let clockCalls = 0;
    const d = deps({
      clock: () => (clockCalls++ === 0 ? 0 : 999_999),
    });
    const result = await runBaseStep(stepInput({ kind: "complete" }), d);
    expect(result).toMatchObject({
      kind: "processing",
      reason: "deadline_exceeded",
      canContinue: true,
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
  });
});
