// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
import { reconcileBaseArtifact } from "../reconciliation";

const artifact = {
  id: "a",
  storeId: "s",
  campaignId: "c",
  operationId: "o",
  role: "square_original",
  format: "1:1",
  origin: "provider_generation",
  derivedFromArtifactId: null,
  sourceCampaignId: null,
  storageBucket: "b",
  storagePath: "p",
  width: 1024,
  height: 1024,
  mimeType: "image/jpeg",
  byteSize: 1,
  checksumSha256: "x",
  provenance: {},
  createdAt: "now",
} as never;

const baseInput = { storeId: "s", campaignId: "c", operationId: "o", authorization: { kind: "system" } as const };

describe("reconcileBaseArtifact", () => {
  it("completes only with admissible frozen state and artifact", async () => {
    const result = await reconcileBaseArtifact(baseInput, {
      readFrozenState: async () => ({ kind: "complete" }) as never,
      probeBase: async () => ({ kind: "reused", artifact, bytes: Buffer.alloc(0), adoption: false }),
    });
    expect(result).toEqual({ kind: "completed" });
  });

  it("blocks artifact without frozen state", async () => {
    const result = await reconcileBaseArtifact(baseInput, {
      readFrozenState: async () => ({ kind: "absent" }) as never,
      probeBase: async () => ({ kind: "reused", artifact, bytes: Buffer.alloc(0), adoption: false }),
    });
    expect(result).toEqual({ kind: "definitive", reason: "artifact_without_frozen_state" });
  });

  it("maps indeterminate probe to unknown", async () => {
    const result = await reconcileBaseArtifact(baseInput, {
      readFrozenState: async () => ({ kind: "complete" }) as never,
      probeBase: async () => ({ kind: "blocked", reason: "pre_call_probe_indeterminate" }),
    });
    expect(result).toEqual({ kind: "unknown", reason: "pre_call_probe_indeterminate" });
  });

  it("maps an indeterminate frozen state to unknown, not definitive", async () => {
    const result = await reconcileBaseArtifact(baseInput, {
      readFrozenState: async () => ({ kind: "indeterminate" }) as never,
      probeBase: async () => ({ kind: "proceed" }),
    });
    expect(result).toEqual({ kind: "unknown", reason: "frozen_state_indeterminate" });
  });
});
