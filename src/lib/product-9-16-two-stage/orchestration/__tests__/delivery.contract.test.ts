// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
import { deliverVertical, finalizeExhaustedLimit } from "../delivery";

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
});
