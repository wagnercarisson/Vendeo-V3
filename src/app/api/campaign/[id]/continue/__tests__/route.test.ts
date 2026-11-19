// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  campaign: {
    id: "00000000-0000-4000-8000-0000000000c1",
    store_id: "00000000-0000-4000-8000-0000000000b1",
    input_snapshot: {
      generationOrigin: "9_16_two_stage",
      generationContractVersion: "f60.5-two-stage-9-16-v1",
    } as Record<string, unknown>,
  },
  lookup: { kind: "found", view: {} } as Record<string, unknown>,
  run: vi.fn(async () => new Response('{"type":"processing"}\n')),
  jointRun: vi.fn(async () => new Response('{"type":"processing"}\n')),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/auth/api-handler", () => ({ apiHandler: (handler: unknown) => handler }));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({ requireApiUser: vi.fn(async () => ({ userId: "u" })) }));
vi.mock("@/lib/auth/store-ownership", () => ({ requireOwnership: vi.fn(async () => ({})) }));
vi.mock("@/lib/campaign/persistence", () => ({ getCampaign: vi.fn(async () => h.campaign) }));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isProduct9_16TwoStageEnabled: vi.fn(async () => false),
}));
vi.mock("@/lib/product-9-16-two-stage/two-stage-operation-client", () => ({
  ProductTwoStageOperationClient: class {
    getOperationView = vi.fn(async () => h.lookup);
  },
}));
vi.mock("@/lib/product-9-16-two-stage/orchestration/run-nine-sixteen", () => ({
  runNineSixteenTwoStageGeneration: h.run,
}));
vi.mock("@/lib/product-9-16-two-stage/orchestration/delivery-deps", () => ({
  createNineSixteenDeps: vi.fn(() => ({ real: true })),
}));
vi.mock("@/lib/product-two-format/orchestration/run-two-format-deps", () => ({
  createTwoFormatRunDeps: vi.fn(() => ({ joint: true })),
}));
vi.mock("@/lib/product-two-format/orchestration/run-two-format", () => ({
  runTwoFormatGeneration: h.jointRun,
}));

import { POST } from "../route";

const params = Promise.resolve({ id: h.campaign.id });
const BODY = {
  operationId: "00000000-0000-4000-8000-0000000000a1",
  requestIds: {
    base: "00000000-0000-4000-8000-0000000000d1",
    expansion: "00000000-0000-4000-8000-0000000000d2",
  },
};

function request(body: unknown = BODY) {
  return new NextRequest(`http://localhost/api/campaign/${h.campaign.id}/continue`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("continue route", () => {
  beforeEach(() => {
    h.lookup = { kind: "found", view: {} };
    h.campaign.input_snapshot = {
      generationOrigin: "9_16_two_stage",
      generationContractVersion: "f60.5-two-stage-9-16-v1",
    };
    h.run.mockClear();
    h.jointRun.mockClear();
  });

  it("maps requestIds to acquisitionIds and uses deps reais", async () => {
    const response = await POST(request(), { params });
    expect(response.status).toBe(200);
    const [input, deps] = h.run.mock.calls[0] as unknown as [Record<string, unknown>, unknown];
    expect(input).toMatchObject({
      mode: "continue",
      acquisitionIds: BODY.requestIds,
      allowNewPaidStep: false,
    });
    expect(deps).toEqual({ real: true });
  });

  it("rejects absent (409) and read_failed (503) without running", async () => {
    h.lookup = { kind: "absent" };
    expect((await POST(request(), { params })).status).toBe(409);
    h.lookup = { kind: "read_failed", reason: "x" };
    expect((await POST(request(), { params })).status).toBe(503);
    expect(h.run).not.toHaveBeenCalled();
  });

  it("joint: classifica origem antes do schema e usa requestId", async () => {
    h.campaign.input_snapshot = {
      campaignFormat: "1:1+9:16",
      formatContractVersion: "f60.7-two-format-v1",
      generationOrigin: "two_format_two_stage",
      generationContractVersion: "f60.7-two-format-v1",
      jointResumeContext: {
        squareDeliveryId: "00000000-0000-4000-8000-0000000000e1",
        initialRequestIds: {
          base: "00000000-0000-4000-8000-0000000000e2",
        },
      },
    };
    h.jointRun.mockClear();
    const jointBody = {
      operationId: BODY.operationId,
      requestId: "00000000-0000-4000-8000-0000000000e3",
    };
    const response = await POST(request(jointBody), { params });
    expect(response.status).toBe(200);
    const [input, deps] = h.jointRun.mock.calls[0] as unknown as [
      Record<string, unknown>,
      unknown,
    ];
    expect(input).toMatchObject({
      mode: "continue",
      operationId: jointBody.operationId,
      requestId: jointBody.requestId,
      squareDeliveryId: "00000000-0000-4000-8000-0000000000e1",
    });
    expect(deps).toEqual({ joint: true });
    expect(h.run).not.toHaveBeenCalled();
  });

  it("joint: body 9:16 é recusado pelo schema conjunto (não vira individual)", async () => {
    h.campaign.input_snapshot = {
      campaignFormat: "1:1+9:16",
      formatContractVersion: "f60.7-two-format-v1",
      generationOrigin: "two_format_two_stage",
      generationContractVersion: "f60.7-two-format-v1",
      jointResumeContext: {
        squareDeliveryId: "00000000-0000-4000-8000-0000000000e1",
        initialRequestIds: {
          base: "00000000-0000-4000-8000-0000000000e2",
        },
      },
    };
    const response = await POST(request(BODY), { params });
    expect(response.status).toBe(400);
    expect(h.jointRun).not.toHaveBeenCalled();
    expect(h.run).not.toHaveBeenCalled();
  });
});
