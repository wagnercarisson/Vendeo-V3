// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
import {
  deliverVertical,
  finalizeDefinitiveFailure,
  finalizeExhaustedLimit,
} from "../delivery";

const input = {
  storeId: "s",
  campaignId: "c",
  operationId: "o",
  authorization: { kind: "system" } as const,
};

function integralProbe() {
  return {
    kind: "integral" as const,
    format: "9:16" as const,
    width: 1080 as const,
    height: 1920 as const,
    mimeType: "image/jpeg" as const,
    storagePath: "store/c/vertical.jpg",
    evidenceRef: "e",
  };
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    control: {
      resume: vi.fn(async () => ({
        success: true,
        action: "deliver",
        nextTarget: null,
        origin: "9_16_two_stage",
        creditStatus: "reserved",
        baseStatus: "done",
        baseAttempts: 1,
        expansionStatus: "done",
        expansionAttempts: 1,
        unknown: false,
        failedOutcome: false,
      })),
      finish: vi.fn(async () => ({
        success: true,
        idempotent: false,
        status: "failed",
        stage: "base",
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
    probeVertical: { probeVerticalArtifact: vi.fn(async () => integralProbe()) },
    projectDelivered: vi.fn(async () => ({ projected: true, reason: "projected" })),
    projectClosed: vi.fn(async () => ({ projected: true, reason: "projected" })),
    generateThumbnail: vi.fn(async () => ({ status: "created" })),
    clock: () => 0,
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

describe("delivery", () => {
  it("acquires publication before confirming and projects after delivery", async () => {
    const d = deps();
    await expect(deliverVertical(input, d)).resolves.toEqual({ kind: "completed" });
    expect(calls(d, "credit.beginPublication")).toHaveLength(1);
    expect(calls(d, "financial.confirmOnVerticalDelivery")).toHaveLength(1);
    expect(calls(d, "projectDelivered")).toHaveLength(1);
    expect(calls(d, "generateThumbnail")).toHaveLength(1);
    expect((calls(d, "generateThumbnail")[0] as [{ storagePath: string }])[0]).toMatchObject({
      storagePath: "store/c/vertical.jpg",
    });
  });

  it("repairs the projection on a delivered replay without new paid effects", async () => {
    const d = deps({
      control: {
        resume: vi.fn(async () => ({
          success: true,
          action: "blocked",
          nextTarget: null,
          origin: "9_16_two_stage",
          creditStatus: "delivered",
          baseStatus: "done",
          baseAttempts: 1,
          expansionStatus: "done",
          expansionAttempts: 1,
          unknown: false,
          failedOutcome: false,
        })),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
    });
    await expect(deliverVertical(input, d)).resolves.toEqual({ kind: "completed" });
    expect(calls(d, "projectDelivered")).toHaveLength(1);
    expect(calls(d, "generateThumbnail")).toHaveLength(1);
    expect(calls(d, "credit.beginPublication")).toHaveLength(0);
    expect(calls(d, "financial.confirmOnVerticalDelivery")).toHaveLength(0);
  });

  it("does not announce an integral delivery when the vertical is absent on replay", async () => {
    const d = deps({
      control: {
        resume: vi.fn(async () => ({
          success: true,
          action: "blocked",
          nextTarget: null,
          origin: "9_16_two_stage",
          creditStatus: "delivered",
          baseStatus: "done",
          baseAttempts: 1,
          expansionStatus: "done",
          expansionAttempts: 1,
          unknown: false,
          failedOutcome: false,
        })),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
      probeVertical: { probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" })) },
    });
    const result = await deliverVertical(input, d);
    expect(result).toMatchObject({ kind: "unknown" });
    expect(result).not.toMatchObject({ kind: "completed" });
    expect(calls(d, "projectDelivered")).toHaveLength(0);
  });

  it("keeps a failed projection pending and repairs it on the next replay", async () => {
    const projectDelivered = vi
      .fn()
      .mockResolvedValueOnce({ projected: false, reason: "not_ready" })
      .mockResolvedValueOnce({ projected: true, reason: "projected" });
    const d = deps({
      control: {
        resume: vi.fn(async () => ({
          success: true,
          action: "blocked",
          nextTarget: null,
          origin: "9_16_two_stage",
          creditStatus: "delivered",
          baseStatus: "done",
          baseAttempts: 1,
          expansionStatus: "done",
          expansionAttempts: 1,
          unknown: false,
          failedOutcome: false,
        })),
        finish: vi.fn(),
        recordOutcome: vi.fn(),
      },
      projectDelivered,
    });
    await expect(deliverVertical(input, d)).resolves.toEqual({
      kind: "processing",
      reason: "delivery_pending",
    });
    await expect(deliverVertical(input, d)).resolves.toEqual({ kind: "completed" });
    expect(projectDelivered).toHaveBeenCalledTimes(2);
  });

  it("repairs the projection when authority is already delivered after a publication dispute", async () => {
    const d = deps({
      credit: {
        beginPublication: vi.fn(async () => ({ acquired: false, token: null })),
        getPublicationEpoch: vi.fn(async () => 1),
        markArtUploaded: vi.fn(),
        deliver: vi.fn(),
      },
      financial: {
        confirmOnVerticalDelivery: vi.fn(),
        refundOnDefinitiveFailure: vi.fn(),
        readFinancialAuthority: vi.fn(async () => ({
          status: "delivered",
          terminal: true,
          delivered: true,
          refunded: false,
          reserved: false,
          storeId: "s",
        })),
      },
    });
    await expect(deliverVertical(input, d)).resolves.toEqual({ kind: "completed" });
    expect(calls(d, "projectDelivered")).toHaveLength(1);
    expect(calls(d, "financial.confirmOnVerticalDelivery")).toHaveLength(0);
  });

  it("does not block delivery when the thumbnail fails", async () => {
    const d = deps({
      generateThumbnail: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    await expect(deliverVertical(input, d)).resolves.toEqual({ kind: "completed" });
  });

  it("finalizes exhausted limit with absent vertical once", async () => {
    const d = deps({
      probeVertical: { probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" })) },
    });
    const result = await finalizeExhaustedLimit(
      { ...input, stage: "expansion", supportReference: "r" },
      d,
    );
    expect(result).toEqual({ kind: "refunded" });
    expect(calls(d, "control.recordOutcome")).toHaveLength(1);
  });

  it("definitive failure with absent vertical refunds once and closes", async () => {
    const d = deps({
      probeVertical: { probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" })) },
    });
    const result = await finalizeDefinitiveFailure(
      { ...input, stage: "base", supportReference: "r" },
      d,
    );
    expect(result).toEqual({ kind: "refunded" });
    expect(calls(d, "control.recordOutcome")).toHaveLength(1);
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(1);
    expect(calls(d, "projectClosed")).toHaveLength(1);
  });

  it("definitive failure with integral vertical requires delivery and never refunds", async () => {
    const d = deps();
    const result = await finalizeDefinitiveFailure(
      { ...input, stage: "expansion", supportReference: "r" },
      d,
    );
    expect(result).toMatchObject({ kind: "delivery_required" });
    expect(calls(d, "control.recordOutcome")).toHaveLength(0);
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
  });

  it("definitive failure with indeterminate vertical records unknown without refund", async () => {
    const d = deps({
      probeVertical: {
        probeVerticalArtifact: vi.fn(async () => ({ kind: "indeterminate" })),
      },
    });
    const result = await finalizeDefinitiveFailure(
      { ...input, stage: "expansion", supportReference: "r" },
      d,
    );
    expect(result).toMatchObject({ kind: "unknown", reason: "vertical_indeterminate" });
    expect(calls(d, "control.recordOutcome")).toHaveLength(1);
    expect(
      (calls(d, "control.recordOutcome")[0] as [{ outcome?: string }])[0],
    ).toMatchObject({ outcome: "unknown" });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
  });

  it("never refunds when recordOutcome is refused", async () => {
    const d = deps({
      probeVertical: { probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" })) },
      control: {
        resume: vi.fn(),
        finish: vi.fn(),
        recordOutcome: vi.fn(async () => ({
          success: false,
          reason: "operation_terminal",
        })),
      },
    });
    const result = await finalizeDefinitiveFailure(
      { ...input, stage: "base", supportReference: "r" },
      d,
    );
    expect(result).toMatchObject({ kind: "unknown" });
    expect(calls(d, "financial.refundOnDefinitiveFailure")).toHaveLength(0);
  });
});
