// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  lookup: { kind: "found", view: null } as Record<string, unknown>,
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
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isProduct9_16TwoStageEnabled: vi.fn(async () => true),
}));
vi.mock("@/lib/product-9-16-two-stage/two-stage-operation-client", () => ({
  ProductTwoStageOperationClient: class {
    getOperationView = vi.fn(async () => h.lookup);
  },
}));

import { POST } from "../route";

function request() {
  return new NextRequest("http://localhost/api/campaign/generation-status", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ campaignId: "00000000-0000-4000-8000-0000000000c1", operationId: "00000000-0000-4000-8000-0000000000a1" }),
  });
}

const view = {
  campaignId: "c",
  operationId: "o",
  origin: "9_16_two_stage",
  credit: { status: "reserved", terminal: false, delivered: false, refunded: false, reserved: true },
  base: { stage: "base", status: "done", attemptsUsed: 1, failureClass: null, attemptNumber: 1, claimedAt: null },
  expansion: { stage: "expansion", status: "pending", attemptsUsed: 0, failureClass: null, attemptNumber: null, claimedAt: null },
  unknown: false,
  failedOutcome: false,
  supportReference: null,
  nextAction: "acquire_expansion",
  canContinue: true,
  processingPhase: null,
};

describe("generation-status two-stage", () => {
  it("returns a state-bearing view", async () => {
    h.lookup = { kind: "found", view };
    const response = await POST(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.operation.state).toBe("processing");
    expect(body.operation.terminal).toBe(false);
  });

  it("distinguishes absent (404) from read_failed (503)", async () => {
    h.lookup = { kind: "absent" };
    expect((await POST(request())).status).toBe(404);
    h.lookup = { kind: "read_failed", reason: "x" };
    expect((await POST(request())).status).toBe(503);
  });
});
