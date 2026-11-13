// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
import {
  deliverVertical,
  finalizeDefinitiveFailure,
  finalizeExhaustedLimit,
} from "../delivery";

const input = { storeId: "s", campaignId: "c", operationId: "o", authorization: { kind: "system" } as const };
const probe = {
  probeVerticalArtifact: vi.fn(async () => ({
    kind: "integral" as const,
    format: "9:16" as const,
    width: 1080 as const,
    height: 1920 as const,
    mimeType: "image/jpeg" as const,
    storagePath: "p",
    evidenceRef: "e",
  })),
};

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
      finish: vi.fn(),
      recordOutcome: vi.fn(),
    },
    financial: {
      confirmOnVerticalDelivery: vi.fn(async () => ({ status: "delivered" })),
      refundOnDefinitiveFailure: vi.fn(async () => ({ kind: "refunded", state: { status: "refunded" } })),
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
    probeVertical: probe,
    projectDelivered: vi.fn(async () => ({ projected: true, reason: "projected" })),
    projectClosed: vi.fn(async () => ({ projected: true, reason: "projected" })),
    generateThumbnail: vi.fn(async () => ({ status: "created" })),
    clock: () => 0,
    ...overrides,
  } as never;
}

describe("delivery", () => {
  it("acquires publication before confirming and projects after delivery", async () => {
    const d = deps();
    await expect(deliverVertical(input, d)).resolves.toEqual({ kind: "completed" });
    const credit = (d as never as { credit: { beginPublication: { mock: { calls: unknown[] } } } }).credit;
    const financial = (d as never as { financial: { confirmOnVerticalDelivery: { mock: { calls: unknown[] } } } }).financial;
    expect(credit.beginPublication.mock.calls).toHaveLength(1);
    expect(financial.confirmOnVerticalDelivery.mock.calls).toHaveLength(1);
  });

  it("finalizes exhausted limit with absent vertical once", async () => {
    const absentProbe = {
      probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" as const })),
    };
    const d = deps({ probeVertical: absentProbe });
    const result = await finalizeExhaustedLimit(
      { ...input, stage: "expansion", supportReference: "r" },
      d,
    );
    expect(result).toEqual({ kind: "refunded" });
    const record = (d as never as { control: { recordOutcome: { mock: { calls: unknown[] } } } }).control;
    expect(record.recordOutcome.mock.calls).toHaveLength(1);
  });

  it("definitive failure with absent vertical refunds once and closes", async () => {
    const absentProbe = {
      probeVerticalArtifact: vi.fn(async () => ({ kind: "absent" as const })),
    };
    const d = deps({ probeVertical: absentProbe });
    const result = await finalizeDefinitiveFailure(
      { ...input, stage: "base", supportReference: "r" },
      d,
    );
    expect(result).toEqual({ kind: "refunded" });
    const control = (d as never as {
      control: { recordOutcome: { mock: { calls: unknown[] } }; finish: { mock: { calls: unknown[] } } };
    }).control;
    const financial = (d as never as {
      financial: { refundOnDefinitiveFailure: { mock: { calls: unknown[] } } };
    }).financial;
    const projection = (d as never as { projectClosed: { mock: { calls: unknown[] } } }).projectClosed;
    expect(control.recordOutcome.mock.calls).toHaveLength(1);
    expect(financial.refundOnDefinitiveFailure.mock.calls).toHaveLength(1);
    expect(projection.mock.calls).toHaveLength(1);
  });

  it("definitive failure with integral vertical requires delivery and never refunds", async () => {
    const d = deps();
    const result = await finalizeDefinitiveFailure(
      { ...input, stage: "expansion", supportReference: "r" },
      d,
    );
    expect(result).toMatchObject({ kind: "delivery_required" });
    const control = (d as never as { control: { recordOutcome: { mock: { calls: unknown[] } } } }).control;
    const financial = (d as never as {
      financial: { refundOnDefinitiveFailure: { mock: { calls: unknown[] } } };
    }).financial;
    expect(control.recordOutcome.mock.calls).toHaveLength(0);
    expect(financial.refundOnDefinitiveFailure.mock.calls).toHaveLength(0);
  });

  it("definitive failure with indeterminate vertical records unknown without refund", async () => {
    const indeterminateProbe = {
      probeVerticalArtifact: vi.fn(async () => ({ kind: "indeterminate" as const })),
    };
    const d = deps({ probeVertical: indeterminateProbe });
    const result = await finalizeDefinitiveFailure(
      { ...input, stage: "expansion", supportReference: "r" },
      d,
    );
    expect(result).toMatchObject({ kind: "unknown", reason: "vertical_indeterminate" });
    const control = (d as never as {
      control: { recordOutcome: { mock: { calls: Array<[{ outcome?: string }]> } } };
    }).control;
    const financial = (d as never as {
      financial: { refundOnDefinitiveFailure: { mock: { calls: unknown[] } } };
    }).financial;
    expect(control.recordOutcome.mock.calls).toHaveLength(1);
    expect(control.recordOutcome.mock.calls[0][0]).toMatchObject({ outcome: "unknown" });
    expect(financial.refundOnDefinitiveFailure.mock.calls).toHaveLength(0);
  });
});
