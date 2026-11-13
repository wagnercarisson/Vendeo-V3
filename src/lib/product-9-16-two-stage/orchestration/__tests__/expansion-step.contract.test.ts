// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
import { runExpansionStep } from "../expansion-step";

const sourceArtifact = {
  id: "src",
  storeId: "s",
  campaignId: "c",
  operationId: "o",
  role: "square_prepared",
  format: "1:1",
  origin: "deterministic_preparation",
  derivedFromArtifactId: "orig",
  sourceCampaignId: null,
  storageBucket: "b",
  storagePath: "p",
  width: 1152,
  height: 1152,
  mimeType: "image/jpeg",
  byteSize: 1,
  checksumSha256: "x",
  provenance: {},
  createdAt: "now",
} as never;

function expansionInput() {
  return {
    storeId: "s",
    campaignId: "c",
    operationId: "o",
    authorization: { kind: "system" },
    acquisitionId: "22222222-2222-4222-8222-222222222222",
    attemptReference: "ref",
    attemptTarget: "initial",
    deadlineAtMs: 100_000,
    expansionStatus: "pending",
    allowNewPaidStep: true,
  } as never;
}

function deps(overrides: Record<string, unknown> = {}) {
  const acquire = vi.fn(async () => ({
    acquired: true,
    authorization: "execute",
    reason: null,
    attemptToken: "t",
    attemptNumber: 1,
    stage: "expansion",
    target: "initial",
  }));
  const finish = vi.fn(async () => ({
    success: true,
    idempotent: false,
    status: "completed",
    stage: "expansion",
    attemptNumber: 1,
  }));
  return {
    control: {
      acquire,
      finish,
      getOperationView: vi.fn(async () => ({
        kind: "found",
        view: {
          campaignId: "c",
          operationId: "o",
          origin: "9_16_two_stage",
          credit: {
            status: "reserved",
            terminal: false,
            delivered: false,
            refunded: false,
            reserved: true,
          },
          base: {
            stage: "base",
            status: "done",
            attemptsUsed: 1,
            failureClass: null,
            attemptNumber: 1,
            claimedAt: null,
          },
          expansion: {
            stage: "expansion",
            status: "in_progress",
            attemptsUsed: 1,
            failureClass: null,
            attemptNumber: 1,
            claimedAt: null,
          },
          unknown: false,
          failedOutcome: false,
          supportReference: null,
          nextAction: "wait",
          canContinue: false,
          processingPhase: "step_in_progress",
        },
      })),
    },
    expand: vi.fn(async () => ({
      kind: "expanded",
      artifact: {},
      bytes: Buffer.alloc(0),
      persistence: "created",
      call: {},
    })),
    retrieve: vi.fn(async () => ({
      kind: "integral",
      artifact: sourceArtifact,
      bytes: Buffer.alloc(0),
    })),
    probe: vi.fn(async () => ({ kind: "proceed" })),
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

describe("runExpansionStep", () => {
  it("acquires expansion once and completes on expanded", async () => {
    const d = deps();
    await expect(runExpansionStep(expansionInput(), d)).resolves.toEqual({ kind: "completed" });
    expect(calls(d, "control.acquire")).toHaveLength(1);
    expect(calls(d, "control.finish")).toHaveLength(1);
  });

  it("does not advance when finish is refused", async () => {
    const d = deps({
      control: {
        acquire: vi.fn(async () => ({
          acquired: true,
          authorization: "execute",
          reason: null,
          attemptToken: "t",
          attemptNumber: 1,
          stage: "expansion",
          target: "initial",
        })),
        finish: vi.fn(async () => ({ success: false, reason: "operation_terminal" })),
        getOperationView: vi.fn(async () => ({
          kind: "found",
          view: {
            campaignId: "c",
            operationId: "o",
            origin: "9_16_two_stage",
            credit: {
              status: "reserved",
              terminal: false,
              delivered: false,
              refunded: false,
              reserved: true,
            },
            base: {
              stage: "base",
              status: "done",
              attemptsUsed: 1,
              failureClass: null,
              attemptNumber: 1,
              claimedAt: null,
            },
            expansion: {
              stage: "expansion",
              status: "in_progress",
              attemptsUsed: 1,
              failureClass: null,
              attemptNumber: 1,
              claimedAt: null,
            },
            unknown: false,
            failedOutcome: false,
            supportReference: null,
            nextAction: "wait",
            canContinue: false,
            processingPhase: "step_in_progress",
          },
        })),
      },
    });
    const result = await runExpansionStep(expansionInput(), d);
    expect(result).toMatchObject({ kind: "unknown" });
    expect(result).not.toMatchObject({ kind: "completed" });
    expect(calls(d, "control.getOperationView")).toHaveLength(1);
  });
});
