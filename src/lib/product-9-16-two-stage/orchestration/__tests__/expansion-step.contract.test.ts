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

describe("runExpansionStep", () => {
  it("acquires expansion once and completes on expanded", async () => {
    const finish = vi.fn(async () => ({ success: true, idempotent: false, status: "completed", stage: "expansion", attemptNumber: 1 }));
    const acquire = vi.fn(async () => ({
      acquired: true,
      authorization: "execute",
      reason: null,
      attemptToken: "t",
      attemptNumber: 1,
      stage: "expansion",
      target: "initial",
    }));
    const result = await runExpansionStep(
      {
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
      },
      {
        control: { acquire: acquire as never, finish: finish as never },
        expand: async () => ({
          kind: "expanded",
          artifact: {},
          bytes: Buffer.alloc(0),
          persistence: "created",
          call: {},
        }) as never,
        retrieve: async () => ({ kind: "integral", artifact: sourceArtifact, bytes: Buffer.alloc(0) }),
        probe: async () => ({ kind: "proceed" }),
        clock: () => 0,
      },
    );
    expect(result).toEqual({ kind: "completed" });
    expect(acquire).toHaveBeenCalledOnce();
    expect(finish).toHaveBeenCalledOnce();
  });
});
