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
import {
  DURABLE_BRIEFING,
  DURABLE_DATA_URL,
  durableReconstruction,
} from "./fixtures";

const BASE_ID = "11111111-1111-4111-8111-111111111111";
const EXPANSION_ID = "22222222-2222-4222-8222-222222222222";

const integralProbe = {
  kind: "integral" as const,
  format: "9:16" as const,
  width: 1080 as const,
  height: 1920 as const,
  mimeType: "image/jpeg" as const,
  storagePath: "store/c/vertical.jpg",
  evidenceRef: "e",
};

function step(stage: "base" | "expansion", status: TwoStageOperationView["base"]["status"], overrides: Record<string, unknown> = {}) {
  return {
    stage,
    status,
    attemptsUsed: status === "pending" ? 0 : 1,
    failureClass: null,
    attemptNumber: status === "pending" ? null : 1,
    claimedAt: null,
    ...overrides,
  };
}

function makeView(overrides: Partial<TwoStageOperationView> = {}): TwoStageOperationView {
  return {
    campaignId: "c",
    operationId: "o",
    origin: "9_16_two_stage",
    credit: { status: "reserved", terminal: false, delivered: false, refunded: false, reserved: true },
    base: step("base", "done"),
    expansion: step("expansion", "done"),
    unknown: false,
    failedOutcome: false,
    supportReference: null,
    nextAction: "deliver",
    canContinue: true,
    processingPhase: null,
    ...overrides,
  };
}

function resumeResult(action: string, overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    action,
    nextTarget: action === "acquire_base" || action === "retry_base" ? "primary" : "initial",
    origin: "9_16_two_stage",
    creditStatus: "reserved",
    baseStatus: "done",
    baseAttempts: 1,
    expansionStatus: "pending",
    expansionAttempts: 0,
    unknown: false,
    failedOutcome: false,
    ...overrides,
  };
}

function deliveryResume() {
  return resumeResult("deliver", {
    baseStatus: "done",
    expansionStatus: "done",
    expansionAttempts: 1,
  });
}

const completedBase = {
  kind: "completed",
  copy: { kind: "not_requested" },
  art: { kind: "created", artifact: {}, snapshotOriginalId: "s" },
  call: null,
};

function deps(overrides: Record<string, unknown> = {}): RunNineSixteenDeps {
  return {
    control: {
      getOperationView: vi.fn(async () => ({ kind: "found", view: makeView() })),
      resume: vi.fn(async () => resumeResult("deliver")),
      acquire: vi.fn(async (request: { stage: string }) => ({
        acquired: true,
        authorization: "execute",
        reason: null,
        attemptToken: "t",
        attemptNumber: 1,
        stage: request.stage,
        target: request.stage === "base" ? "primary" : "initial",
      })),
      finish: vi.fn(async (request: { stage?: string }) => ({
        success: true,
        idempotent: false,
        status: "completed",
        stage: request.stage ?? "base",
        attemptNumber: 1,
      })),
      recordOutcome: vi.fn(async (request: { outcome: string }) => ({
        success: true,
        idempotent: false,
        outcome: request.outcome,
        stage: "base",
        supportReference: null,
      })),
    },
    financial: {
      reserveOperationOnce: vi.fn(async () => ({ status: "reserved" })),
      confirmOnVerticalDelivery: vi.fn(async () => ({ status: "delivered" })),
      refundOnDefinitiveFailure: vi.fn(async () => ({
        kind: "refunded",
        state: { status: "refunded" },
      })),
      readFinancialAuthority: vi.fn(async () => ({
        status: "reserved",
        terminal: false,
        delivered: false,
        refunded: false,
        reserved: true,
        storeId: "s",
      })),
    },
    credit: {
      beginPublication: vi.fn(async () => ({ acquired: true, token: "t" })),
      getPublicationEpoch: vi.fn(async () => 1),
      markArtUploaded: vi.fn(),
      deliver: vi.fn(),
    },
    clock: () => 0,
    callIdFactory: () => "call",
    newSupportReference: () => "ref",
    base: vi.fn(async () => completedBase),
    prepare: vi.fn(async () => ({
      kind: "prepared",
      artifact: {},
      bytes: Buffer.alloc(0),
      persistence: "created",
    })),
    expand: vi.fn(async () => ({
      kind: "expanded",
      artifact: {},
      bytes: Buffer.alloc(0),
      persistence: "created",
      call: {},
    })),
    readFrozenState: vi.fn(async () => ({ kind: "complete" })),
    retrieveCompositionArtifact: vi.fn(async () => ({
      kind: "integral",
      artifact: { id: "prepared" },
      bytes: Buffer.alloc(0),
    })),
    probeExpansion: vi.fn(async () => ({ kind: "proceed" })),
    projectDelivered: vi.fn(async () => ({ projected: true, reason: "projected" })),
    projectClosed: vi.fn(async () => ({ projected: true, reason: "projected" })),
    probeVertical: { probeVerticalArtifact: vi.fn(async () => integralProbe) },
    generateThumbnail: vi.fn(async () => ({ status: "created" })),
    reconstruction: durableReconstruction(),
    ...overrides,
  } as never;
}

function initialInput(overrides: Partial<RunNineSixteenInput> = {}): RunNineSixteenInput {
  return {
    mode: "initial",
    storeId: "s",
    campaignId: "c",
    operationId: "o",
    authorization: { kind: "system" },
    requestStartedAtMs: 0,
    ...overrides,
  };
}

function continueInput(overrides: Partial<RunNineSixteenInput> = {}): RunNineSixteenInput {
  return {
    mode: "continue",
    storeId: "s",
    campaignId: "c",
    operationId: "o",
    authorization: { kind: "system" },
    requestStartedAtMs: 0,
    acquisitionIds: { base: BASE_ID, expansion: EXPANSION_ID },
    ...overrides,
  };
}

async function run(
  input: RunNineSixteenInput,
  d: RunNineSixteenDeps,
): Promise<Array<Record<string, unknown>>> {
  const response = await runNineSixteenTwoStageGeneration(input, d);
  const text = await response.text();
  return text
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function terminal(events: Array<Record<string, unknown>>): Record<string, unknown> {
  return events.at(-1) ?? {};
}

function terminals(events: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return events.filter((event) =>
    ["result", "error", "unknown", "processing"].includes(String(event.type)),
  );
}

function calls(d: unknown, path: string): unknown[] {
  const value = path.split(".").reduce<Record<string, unknown>>(
    (current, key) => current[key] as Record<string, unknown>,
    d as Record<string, unknown>,
  );
  return (value as { mock: { calls: unknown[] } }).mock.calls;
}

describe("runNineSixteenTwoStageGeneration", () => {
  it("initial with an existing operation is query-only (no reserve/resume/provider)", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            credit: { status: "delivered", terminal: true, delivered: true, refunded: false, reserved: false },
            nextAction: "deliver",
          }),
        })),
        resume: vi.fn(),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(initialInput(), d);
    expect(terminal(events)).toMatchObject({ type: "result", campaignId: "c" });
    expect(calls(d, "financial.reserveOperationOnce")).toHaveLength(0);
    expect(calls(d, "control.resume")).toHaveLength(0);
    expect(calls(d, "control.acquire")).toHaveLength(0);
    expect(calls(d, "base")).toHaveLength(0);
  });

  it("initial reserves once and runs base -> preparation -> expansion -> delivery with phases", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "absent" })),
        resume: vi.fn(async () => deliveryResume()),
        acquire: vi.fn(async (request: { stage: string }) => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: request.stage,
          target: request.stage === "base" ? "primary" : "initial",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: "base",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(initialInput(), d);
    expect(terminal(events)).toMatchObject({ type: "result" });
    expect(calls(d, "financial.reserveOperationOnce")).toHaveLength(1);
    expect(calls(d, "base")).toHaveLength(1);
    expect(calls(d, "prepare")).toHaveLength(1);
    expect(calls(d, "expand")).toHaveLength(1);
    expect(calls(d, "projectDelivered")).toHaveLength(1);
    expect(calls(d, "control.resume")).toHaveLength(1);

    const phaseNames = events
      .filter((event) => event.type === "phase")
      .map((event) => `${String(event.phase)}:${String(event.status)}`);
    expect(phaseNames[0]).toBe("campaign_validation:running");
    expect(phaseNames).toContain("campaign_validation:complete");
    expect(phaseNames).toContain("campaign_base:complete");
    expect(phaseNames).toContain("campaign_preparation:complete");
    expect(phaseNames).toContain("campaign_expansion:complete");
    expect(phaseNames).toContain("campaign_delivery:complete");
    expect(terminals(events)).toHaveLength(1);
  });

  it("continue after base does not prepare/expand yet; the next continuation prepares before expanding", async () => {
    const first = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_base")),
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
        recordOutcome: vi.fn(),
      },
    });
    const firstEvents = await run(continueInput(), first);
    expect(terminal(firstEvents)).toMatchObject({
      type: "processing",
      state: "between_steps",
      nextStep: "expansion",
      canContinue: true,
    });
    expect(calls(first, "base")).toHaveLength(1);
    expect(calls(first, "prepare")).toHaveLength(0);
    expect(calls(first, "expand")).toHaveLength(0);
    expect(calls(first, "financial.reserveOperationOnce")).toHaveLength(0);

    const order: string[] = [];
    const second = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "done"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_expansion",
          }),
        })),
        resume: vi
          .fn()
          .mockResolvedValueOnce(resumeResult("acquire_expansion"))
          .mockResolvedValueOnce(deliveryResume()),
        acquire: vi.fn(async () => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: "expansion",
          target: "initial",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: "expansion",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
      prepare: vi.fn(async () => {
        order.push("prepare");
        return {
          kind: "prepared",
          artifact: {},
          bytes: Buffer.alloc(0),
          persistence: "reused",
        };
      }),
      expand: vi.fn(async () => {
        order.push("expand");
        return {
          kind: "expanded",
          artifact: {},
          bytes: Buffer.alloc(0),
          persistence: "created",
          call: {},
        };
      }),
    });
    const secondEvents = await run(continueInput(), second);
    expect(terminal(secondEvents)).toMatchObject({ type: "result" });
    expect(order).toEqual(["prepare", "expand"]);
    expect(calls(second, "prepare")).toHaveLength(1);
    expect(calls(second, "expand")).toHaveLength(1);
    expect(calls(second, "base")).toHaveLength(0);
  });

  it("continue retry base with frozen complete rebuilds durable content (no browser content)", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "failed", { failureClass: "transient" }),
            expansion: step("expansion", "pending"),
            nextAction: "retry_base",
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("retry_base", {
            baseStatus: "failed",
            expansionStatus: "pending",
          }),
        ),
        acquire: vi.fn(async () => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 2,
          stage: "base",
          target: "primary",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: "base",
          attemptNumber: 2,
        })),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "processing", nextStep: "expansion" });
    const baseCalls = calls(d, "base") as Array<
      [{ briefing: unknown; productImagesDataUrls: readonly string[] }]
    >;
    expect(baseCalls).toHaveLength(1);
    expect(baseCalls[0][0].briefing).toEqual(DURABLE_BRIEFING);
    expect(baseCalls[0][0].productImagesDataUrls).toEqual([DURABLE_DATA_URL]);
  });

  it("does not advance when finish is refused", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_base")),
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
        recordOutcome: vi.fn(async () => ({
          success: true,
          idempotent: false,
          outcome: "unknown",
          stage: "base",
          supportReference: null,
        })),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "unknown" });
    expect(calls(d, "prepare")).toHaveLength(0);
    expect(calls(d, "expand")).toHaveLength(0);
  });

  it("repairs the projection when delivery is replayed after credit delivered", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({ nextAction: "deliver" }),
        })),
        resume: vi.fn(async () => resumeResult("deliver", { creditStatus: "delivered" })),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "result" });
    expect(calls(d, "projectDelivered")).toHaveLength(1);
    expect(calls(d, "credit.beginPublication")).toHaveLength(0);
  });

  it("exhausted limit with absent vertical refunds once and never retries", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            expansion: step("expansion", "failed", {
              attemptsUsed: 2,
              failureClass: "transient",
            }),
            nextAction: "blocked",
            canContinue: false,
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("blocked", {
            expansionStatus: "failed",
            expansionAttempts: 2,
          }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(async () => ({
          success: true,
          idempotent: false,
          outcome: "failed",
          stage: "expansion",
          supportReference: null,
        })),
      },
      probeVertical: { probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" })) },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "error", refunded: true });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(1);
    expect(calls(d, "control.recordOutcome")).toHaveLength(1);
    expect(calls(d, "control.acquire")).toHaveLength(0);
  });

  it("exhausted limit with an integral vertical delivers instead of refunding", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            expansion: step("expansion", "failed", {
              attemptsUsed: 2,
              failureClass: "transient",
            }),
            nextAction: "blocked",
            canContinue: false,
          }),
        })),
        resume: vi
          .fn()
          .mockResolvedValueOnce(
            resumeResult("blocked", { expansionStatus: "failed", expansionAttempts: 2 }),
          )
          .mockResolvedValueOnce(deliveryResume()),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "result" });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
    expect(calls(d, "projectDelivered")).toHaveLength(1);
  });

  it("exhausted limit with indeterminate evidence records unknown without refund", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            expansion: step("expansion", "failed", {
              attemptsUsed: 2,
              failureClass: "transient",
            }),
            nextAction: "blocked",
            canContinue: false,
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("blocked", { expansionStatus: "failed", expansionAttempts: 2 }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(async () => ({
          success: true,
          idempotent: false,
          outcome: "unknown",
          stage: "expansion",
          supportReference: null,
        })),
      },
      probeVertical: {
        probeVerticalArtifact: vi.fn(async () => ({ kind: "indeterminate" })),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "unknown" });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
    expect(
      (calls(d, "control.recordOutcome")[0] as [{ outcome?: string }])[0],
    ).toMatchObject({ outcome: "unknown" });
  });

  it("blocked for another reason never refunds or records an outcome", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "failed", { failureClass: null }),
            expansion: step("expansion", "pending"),
            nextAction: "blocked",
            canContinue: false,
          }),
        })),
        resume: vi.fn(async () =>
          resumeResult("blocked", { baseStatus: "failed", expansionStatus: "pending" }),
        ),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "processing", canContinue: false });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
    expect(calls(d, "control.recordOutcome")).toHaveLength(0);
  });

  it("persists unknown on an unknown provider result with no retry or refund", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_base")),
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
      base: vi.fn(async () => ({ kind: "unknown_result" })),
    });
    const events = await run(continueInput(), d);
    expect(terminal(events)).toMatchObject({ type: "unknown" });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
    expect(calls(d, "control.acquire")).toHaveLength(1);
  });

  it("returns processing with no acquire when the budget cannot afford the step", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: makeView({
            base: step("base", "pending"),
            expansion: step("expansion", "pending"),
            nextAction: "acquire_base",
          }),
        })),
        resume: vi.fn(async () => resumeResult("acquire_base")),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(continueInput({ timeoutMs: 1 }), d);
    expect(terminal(events)).toMatchObject({
      type: "processing",
      state: "between_steps",
      nextStep: "base",
      canContinue: true,
    });
    expect(calls(d, "control.acquire")).toHaveLength(0);
  });

  it("streams progress before the work completes", async () => {
    let releaseBase: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseBase = resolve;
    });
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => ({ kind: "absent" })),
        resume: vi.fn(async () => deliveryResume()),
        acquire: vi.fn(async (request: { stage: string }) => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: request.stage,
          target: request.stage === "base" ? "primary" : "initial",
        })),
        finish: vi.fn(async () => ({
          success: true,
          idempotent: false,
          status: "completed",
          stage: "base",
          attemptNumber: 1,
        })),
        recordOutcome: vi.fn(),
      },
      base: vi.fn(async () => {
        await gate;
        return completedBase;
      }),
    });

    const response = await runNineSixteenTwoStageGeneration(initialInput(), d);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("missing body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (!buffer.includes('"phase":"campaign_base"')) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value);
    }
    expect(buffer).toContain('"phase":"campaign_base"');
    expect(buffer).not.toContain('"type":"result"');

    releaseBase();
    let rest = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      rest += decoder.decode(chunk.value);
    }
    expect(rest).toContain('"type":"result"');
  });

  it("turns an unhandled exception into exactly one safe terminal", async () => {
    const d = deps({
      control: {
        getOperationView: vi.fn(async () => {
          throw new Error("db down");
        }),
        resume: vi.fn(),
        acquire: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    const events = await run(initialInput(), d);
    expect(terminals(events)).toHaveLength(1);
    expect(terminal(events)).toMatchObject({ type: "unknown", operationId: "o" });
  });
});
