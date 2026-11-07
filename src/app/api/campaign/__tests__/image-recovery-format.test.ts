// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { marker: "admin" },
  createServerClient: vi.fn(),
}));
vi.mock("@/lib/auth/api-handler", () => ({ apiHandler: (handler: unknown) => handler }));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => ({ userId: "99999999-9999-4999-8999-999999999999" })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    is_test_store: true,
  })),
}));
vi.mock("@/lib/campaign/persistence", () => ({ getCampaign: mockGetCampaign }));
vi.mock("@/lib/campaign/new-flow-marker", () => ({
  classifyCampaignFlow: mockClassify,
}));
vi.mock("@/lib/product-1-1/authorization/authorization-service", () => ({
  resolveProductFlowAuthorization: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/product-1-1/submission/eligibility-context", () => ({
  resolveEligibilityContext: vi.fn((store: unknown) => store),
}));

const {
  mockGetCampaign,
  mockClassify,
  mockGetCampaignOperation,
  mockRecoveryCtor,
  mockRecoverDelivery,
  mockOneToOneStoreCtor,
  mockVerticalStoreCtor,
  mockOneToOneProjection,
  mockMakeVerticalProjection,
  mockVerticalProjection,
  MockRecovery,
} = vi.hoisted(() => {
  const recoverDelivery = vi.fn(async () => ({
    outcome: "delivered",
    kind: "integral",
    status: "delivered",
    ref: null,
  }));
  const oneToOneProjection = vi.fn(async () => ({ campaignId: "c" }));
  const verticalProjection = vi.fn(async () => ({ campaignId: "c" }));
  const recoveryCtor = vi.fn();
  class MockRecovery {
    constructor(client: unknown, deps: unknown) {
      recoveryCtor(client, deps);
    }
    recoverDelivery = recoverDelivery;
  }
  return {
    mockGetCampaign: vi.fn(),
    mockClassify: vi.fn(),
    mockGetCampaignOperation: vi.fn(),
    mockRecoveryCtor: recoveryCtor,
    mockRecoverDelivery: recoverDelivery,
    mockOneToOneStoreCtor: vi.fn(),
    mockVerticalStoreCtor: vi.fn(),
    mockOneToOneProjection: oneToOneProjection,
    mockMakeVerticalProjection: vi.fn(() => verticalProjection),
    mockVerticalProjection: verticalProjection,
    MockRecovery,
  };
});

vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: vi.fn(function () {
    return { getCampaignOperation: mockGetCampaignOperation };
  }),
}));
vi.mock("@/lib/product-1-1/artifact/artifact-recovery", () => ({
  ProductOneToOneArtifactRecovery: MockRecovery,
}));
vi.mock("@/lib/product-1-1/artifact/artifact-store", () => ({
  ProductOneToOneArtifactStore: vi.fn(function () {
    const instance = { kind: "one-to-one-prober" };
    mockOneToOneStoreCtor(instance);
    return instance;
  }),
}));
vi.mock("@/lib/product-1-1/orchestration/project-delivered-campaign", () => ({
  projectDeliveredCampaign: mockOneToOneProjection,
}));
vi.mock("@/lib/product-vertical-9-16/artifact/artifact-store", () => ({
  VerticalArtifactStore: vi.fn(function () {
    const instance = { kind: "vertical-prober" };
    mockVerticalStoreCtor(instance);
    return instance;
  }),
}));
vi.mock("@/lib/product-vertical-9-16/orchestration/entrypoint", () => ({
  makeVerticalProjection: mockMakeVerticalProjection,
}));

import { POST } from "../[id]/image-recovery/route";

const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";

function request(): NextRequest {
  return new NextRequest(
    new Request(`http://localhost/api/campaign/${CAMPAIGN_ID}/image-recovery`, {
      method: "POST",
      body: JSON.stringify({ operationId: OPERATION_ID }),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function setup(snapshot: Record<string, unknown>) {
  mockGetCampaign.mockResolvedValue({
    id: CAMPAIGN_ID,
    store_id: "11111111-1111-4111-8111-111111111111",
    input_snapshot: snapshot,
  });
  mockClassify.mockReturnValue("new_flow");
  mockGetCampaignOperation.mockResolvedValue({ operationId: OPERATION_ID });
}

const verticalSnapshot = {
  frozenContentReferences: [],
  campaignFormat: "9:16",
  formatContractVersion: "f59-vertical-9-16-v1",
};
const squareSnapshot = { frozenContentReferences: [] };

describe("F59/59-06 — recuperação de imagem por formato persistido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecoverDelivery.mockResolvedValue({
      outcome: "delivered",
      kind: "integral",
      status: "delivered",
      ref: null,
    });
  });

  it("9:16 usa a sonda e a projeção verticais, com o path esperado", async () => {
    setup(verticalSnapshot);
    const res = await POST(request(), {
      params: Promise.resolve({ id: CAMPAIGN_ID }),
    });

    expect(mockGetCampaign).toHaveBeenCalledWith(CAMPAIGN_ID);
    expect(res.status).toBe(200);
    expect(mockOneToOneStoreCtor).toHaveBeenCalledTimes(1); // perfil 1:1 é construído, não usado
    expect(mockVerticalStoreCtor).toHaveBeenCalledTimes(1);
    expect(mockMakeVerticalProjection).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      CAMPAIGN_ID,
      OPERATION_ID,
      { client: { marker: "admin" } },
    );
    const deps = mockRecoveryCtor.mock.calls[0][1] as {
      artifacts: { kind: string };
      projectDeliveredCampaign: unknown;
    };
    expect(deps.artifacts).toEqual({ kind: "vertical-prober" });
    expect(deps.projectDeliveredCampaign).toBe(mockVerticalProjection);
    expect(mockRecoverDelivery).toHaveBeenCalledWith({
      storeId: "11111111-1111-4111-8111-111111111111",
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
  });

  it("1:1 usa a sonda e a projeção históricas e NÃO carrega o runtime vertical", async () => {
    setup(squareSnapshot);
    const res = await POST(request(), {
      params: Promise.resolve({ id: CAMPAIGN_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockVerticalStoreCtor).not.toHaveBeenCalled();
    expect(mockMakeVerticalProjection).not.toHaveBeenCalled();
    const deps = mockRecoveryCtor.mock.calls[0][1] as {
      artifacts: { kind: string };
      projectDeliveredCampaign: unknown;
    };
    expect(deps.artifacts).toEqual({ kind: "one-to-one-prober" });
    expect(deps.projectDeliveredCampaign).toBe(mockOneToOneProjection);
  });

  it("formato indisponível ⇒ 503 antes de qualquer sonda/recuperação", async () => {
    setup({ frozenContentReferences: [], campaignFormat: "16:9" });
    const res = await POST(request(), {
      params: Promise.resolve({ id: CAMPAIGN_ID }),
    });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("format_unavailable");
    expect(mockRecoveryCtor).not.toHaveBeenCalled();
    expect(mockGetCampaignOperation).not.toHaveBeenCalled();
  });

  it("classificação persistida indeterminada ⇒ 409 antes do formato", async () => {
    setup({ frozenContentReferences: [] });
    mockClassify.mockReturnValue("indeterminate");
    const res = await POST(request(), {
      params: Promise.resolve({ id: CAMPAIGN_ID }),
    });

    expect(res.status).toBe(409);
    expect(mockRecoveryCtor).not.toHaveBeenCalled();
  });
});
