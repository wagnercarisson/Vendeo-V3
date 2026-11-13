// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
import { runBaseStep } from "../base-step";

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

function deps(overrides: Record<string, unknown> = {}) {
  const finish = vi.fn(async () => ({ success: true, idempotent: false, status: "completed", stage: "base", attemptNumber: 1 }));
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
      finish,
    },
    base: vi.fn(async () => ({
      kind: "completed",
      copy: { kind: "not_requested" },
      art: { kind: "created", artifact: {}, snapshotOriginalId: "s" },
      call: null,
    })),
    clock: () => 0,
    ...overrides,
  } as never;
}

describe("runBaseStep", () => {
  it("acquires once and finishes completed", async () => {
    const d = deps();
    const result = await runBaseStep(
      {
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
        frozenState: { kind: "complete" } as never,
      },
      d,
    );
    expect(result).toEqual({ kind: "completed" });
    expect((d as never as { control: { acquire: { mock: { calls: unknown[] } } } }).control.acquire.mock.calls).toHaveLength(1);
    expect((d as never as { control: { finish: { mock: { calls: unknown[] } } } }).control.finish.mock.calls).toHaveLength(1);
  });

  it("does not acquire an in-progress base", async () => {
    const d = deps();
    const result = await runBaseStep(
      {
        storeId: "s",
        campaignId: "c",
        operationId: "o",
        authorization: { kind: "system" },
        content,
        acquisitionId: "11111111-1111-4111-8111-111111111111",
        attemptReference: "ref",
        attemptTarget: "primary",
        deadlineAtMs: 100_000,
        baseStatus: "in_progress",
        allowNewPaidStep: true,
        frozenState: { kind: "complete" } as never,
      },
      d,
    );
    expect(result).toMatchObject({ kind: "processing", state: "step_in_progress" });
    expect((d as never as { control: { acquire: { mock: { calls: unknown[] } } } }).control.acquire.mock.calls).toHaveLength(0);
  });
});
