// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  built: { ok: true, runner: { marker: "runner" } } as Record<string, unknown>,
  recover: vi.fn(async () => ({ attemptSeq: 1 })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/auth/api-handler", () => ({ apiHandler: (handler: unknown) => handler }));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({ requireApiUser: vi.fn(async () => ({ userId: "u" })) }));
vi.mock("@/lib/auth/store-ownership", () => ({ requireOwnership: vi.fn(async () => ({})) }));
vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: vi.fn(async () => ({
    store_id: "s",
    input_snapshot: {
      generationOrigin: "9_16_two_stage",
      generationContractVersion: "f60.5-two-stage-9-16-v1",
    },
  })),
}));
vi.mock("@/lib/product-9-16-two-stage/orchestration/copy-recovery-runner", () => ({
  buildTwoStageCopyRunner: vi.fn(async () => h.built),
}));
vi.mock("@/lib/product-1-1/copy/copy-recovery", () => ({
  ProductOneToOneCopyRecoveryClient: class {
    recoverCopyAttempt = h.recover;
  },
  ProductOneToOneCopyRecoveryError: class extends Error {},
  toAcquisitionMode: (mode: string) => mode,
}));

import { POST } from "../route";

const params = Promise.resolve({ id: "00000000-0000-4000-8000-0000000000c1" });
function request() {
  return new NextRequest("http://localhost/api/campaign/00000000-0000-4000-8000-0000000000c1/copy-recovery", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ operationId: "00000000-0000-4000-8000-0000000000a1", mode: "manual", requestToken: "00000000-0000-4000-8000-0000000000e1" }),
  });
}

describe("copy-recovery two-stage", () => {
  it("uses the frozen runner", async () => {
    const response = await POST(request(), { params });
    expect(response.status).toBe(200);
    expect(h.recover).toHaveBeenCalledWith(
      expect.objectContaining({ runner: { marker: "runner" } }),
    );
  });

  it("fails closed without a valid frozen state", async () => {
    h.built = { ok: false, reason: "frozen_state_unrepairable" };
    h.recover.mockClear();
    const response = await POST(request(), { params });
    expect(response.status).toBe(409);
    expect(h.recover).not.toHaveBeenCalled();
  });
});
