// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  campaign: {
    id: "00000000-0000-4000-8000-0000000000c1",
    store_id: "00000000-0000-4000-8000-0000000000b1",
    status: "ready",
    input_snapshot: {} as Record<string, unknown>,
  },
  store: { id: "00000000-0000-4000-8000-0000000000b1", is_test_store: false },
  addition: { kind: "none" } as Record<string, unknown>,
  byRequest: { kind: "none" } as Record<string, unknown>,
  sourceResults: [] as Array<Record<string, unknown>>,
  source: {
    kind: "reusable",
    source: {
      origin: "new_flow_1_1",
      storeId: "00000000-0000-4000-8000-0000000000b1",
      campaignId: "00000000-0000-4000-8000-0000000000c1",
      operationId: "00000000-0000-4000-8000-0000000000a1",
      bucket: "bucket",
      storagePath: "path",
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
      byteSize: 100,
      checksumSha256: "a".repeat(64),
    },
  } as Record<string, unknown>,
  additionFlag: true,
  engineFlag: true,
  config: {
    kind: "found",
    selection: {
      model: "gpt-image-2.5-flare",
      quality: "low",
      configVersionId: "00000000-0000-4000-8000-0000000000d1",
      origin: "configured",
    },
    metadata: {},
  } as Record<string, unknown>,
  run: vi.fn(async () => ({
    ok: true,
    kind: "delivered",
    operationId: "00000000-0000-4000-8000-0000000000a2",
    requestId: "00000000-0000-4000-8000-0000000000a3",
    idempotent: false,
  })),
  continueRun: vi.fn(async () => ({
    ok: true,
    kind: "delivered",
    operationId: "00000000-0000-4000-8000-0000000000a2",
    requestId: "00000000-0000-4000-8000-0000000000a3",
    idempotent: false,
  })),
  depsOptions: null as Record<string, unknown> | null,
  decision: { allowed: true } as Record<string, unknown>,
  pilot: { kind: "inactive" } as Record<string, unknown>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/auth/api-handler", () => ({ apiHandler: (handler: unknown) => handler }));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => ({ userId: "user-1" })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async () => h.store),
}));
vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: vi.fn(async () => h.campaign),
}));
vi.mock("@/lib/campaign/format-addition/delivery-reader", () => ({
  readFormatAdditionByCampaign: vi.fn(async () => h.addition),
  readFormatAdditionByIdentity: vi.fn(async () => h.byRequest),
}));
vi.mock("@/lib/campaign/composition-artifacts/resolve-source", () => ({
  resolveReusableSquareSource: vi.fn(async () => {
    const next = h.sourceResults.shift();
    return next ?? h.source;
  }),
}));
vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignFormatAdditionEnabled: vi.fn(async () => h.additionFlag),
  isProduct9_16TwoStageEnabled: vi.fn(async () => h.engineFlag),
}));
vi.mock("@/lib/ai/nine-sixteen-expansion-model-config-service", () => ({
  readNineSixteenExpansionConfig: vi.fn(async () => h.config),
}));
vi.mock("@/lib/product-1-1/authorization/authorization-service", () => ({
  resolveProductFlowAuthorization: vi.fn(async () => h.decision),
}));
vi.mock("@/lib/product-1-1/submission/eligibility-context", () => ({
  resolveEligibilityContext: vi.fn(() => ({})),
}));
vi.mock("@/lib/product-1-1/pilot/resolve-pilot-spend-gate", () => ({
  resolvePilotSpendGate: vi.fn(async () => h.pilot),
}));
vi.mock("@/lib/campaign/format-addition/orchestration/deps", () => ({
  createProductionFormatAdditionDeps: vi.fn((options) => {
    h.depsOptions = options;
    return { stub: true };
  }),
}));
vi.mock("@/lib/campaign/format-addition/orchestration/run-addition", () => ({
  runFormatAddition: h.run,
}));
vi.mock("@/lib/campaign/format-addition/orchestration/resume-addition", () => ({
  continueFormatAddition: h.continueRun,
}));

import { GET, POST } from "../route";

const params = Promise.resolve({ id: h.campaign.id });
const SECRET = "test-format-addition-secret";

beforeEach(() => {
  process.env.FORMAT_ADDITION_CONFIRMATION_SECRET = SECRET;
  h.campaign.status = "ready";
  h.campaign.input_snapshot = {};
  h.addition = { kind: "none" };
  h.byRequest = { kind: "none" };
  h.sourceResults = [];
  h.source = {
    kind: "reusable",
    source: {
      origin: "new_flow_1_1",
      storeId: h.campaign.store_id,
      campaignId: h.campaign.id,
      operationId: "00000000-0000-4000-8000-0000000000a1",
      bucket: "bucket",
      storagePath: "path",
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
      byteSize: 100,
      checksumSha256: "a".repeat(64),
    },
  };
  h.additionFlag = true;
  h.engineFlag = true;
  h.config = {
    kind: "found",
    selection: {
      model: "gpt-image-2.5-flare",
      quality: "low",
      configVersionId: "00000000-0000-4000-8000-0000000000d1",
      origin: "configured",
    },
    metadata: {},
  };
  h.run.mockClear();
  h.continueRun.mockClear();
  h.depsOptions = null;
  h.decision = { allowed: true };
  h.pilot = { kind: "inactive" };
});

function getRequest() {
  return new NextRequest(
    `http://localhost/api/campaign/${h.campaign.id}/format-additions`,
    { method: "GET" },
  );
}

function postRequest(body: unknown) {
  return new NextRequest(
    `http://localhost/api/campaign/${h.campaign.id}/format-additions`,
    {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(body),
    },
  );
}

async function getToken(): Promise<string> {
  const response = await GET(getRequest(), { params });
  const json = (await response.json()) as { confirmationToken?: string };
  if (!json.confirmationToken) throw new Error("missing token");
  return json.confirmationToken;
}

describe("F62-05 — GET /format-additions", () => {
  it("elegível emite requestId/token sem executar geração", async () => {
    const response = await GET(getRequest(), { params });
    expect(response.status).toBe(200);
    const json = (await response.json()) as Record<string, unknown>;
    expect(json).toMatchObject({
      state: "eligible",
      sourceOrigin: "new_flow_1_1",
      costCredits: 1,
    });
    expect(json.confirmationToken).toEqual(expect.any(String));
    expect(json.requestId).toEqual(expect.any(String));
    expect(json).not.toHaveProperty("operationId");
    expect(h.run).not.toHaveBeenCalled();
  });

  it("flag dedicada desligada bloqueia só a nova adição", async () => {
    h.additionFlag = false;
    const response = await GET(getRequest(), { params });
    const json = (await response.json()) as Record<string, unknown>;
    expect(json).toMatchObject({
      state: "unavailable",
      reason: "addition_disabled",
    });
    expect(json).not.toHaveProperty("confirmationToken");

    h.addition = {
      kind: "found",
      addition: {
        state: "delivered",
        sourceOrigin: "new_flow_1_1",
        refunded: false,
        operationId: "00000000-0000-4000-8000-0000000000a2",
        requestId: "00000000-0000-4000-8000-0000000000a3",
        sourceArtifactId: null,
        sourceRegistrationOperationId: null,
        createdAt: null,
      },
    };
    const delivered = await GET(getRequest(), { params });
    expect((await delivered.json()) as Record<string, unknown>).toMatchObject({
      state: "delivered",
    });
  });

  it("refunded emite token de retry com flag ligada e perde retry com flag desligada", async () => {
    h.addition = {
      kind: "found",
      addition: {
        state: "refunded",
        sourceOrigin: "new_flow_1_1",
        refunded: true,
        operationId: "00000000-0000-4000-8000-0000000000a2",
        requestId: "00000000-0000-4000-8000-0000000000a3",
        sourceArtifactId: null,
        sourceRegistrationOperationId: null,
        createdAt: null,
      },
    };
    const response = await GET(getRequest(), { params });
    const json = (await response.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ state: "refunded", refunded: true });
    expect(json.confirmationToken).toEqual(expect.any(String));

    h.additionFlag = false;
    const blocked = await GET(getRequest(), { params });
    const blockedJson = (await blocked.json()) as Record<string, unknown>;
    expect(blockedJson).toMatchObject({
      state: "refunded",
      reason: "addition_disabled",
    });
    expect(blockedJson).not.toHaveProperty("confirmationToken");
  });

  it("unknown/processing emitem token de retomada mesmo com flag desligada", async () => {
    h.addition = {
      kind: "found",
      addition: {
        state: "processing",
        sourceOrigin: "new_flow_1_1",
        refunded: false,
        operationId: "00000000-0000-4000-8000-0000000000a2",
        requestId: "00000000-0000-4000-8000-0000000000a3",
        sourceArtifactId: null,
        sourceRegistrationOperationId: null,
        createdAt: null,
      },
    };
    h.additionFlag = false;
    const response = await GET(getRequest(), { params });
    const json = (await response.json()) as Record<string, unknown>;
    expect(json).toMatchObject({
      state: "processing",
      requestId: "00000000-0000-4000-8000-0000000000a3",
    });
    expect(json.confirmationToken).toEqual(expect.any(String));
  });

  it("fonte incompatível explica sem prometer token", async () => {
    h.source = { kind: "not_reusable", reason: "unsupported_dimensions" };
    const response = await GET(getRequest(), { params });
    expect((await response.json()) as Record<string, unknown>).toMatchObject({
      state: "incompatible",
      reason: "unsupported_dimensions",
    });
  });

  it("incerteza da origem nova não vira incompatibilidade da legada", async () => {
    h.sourceResults = [
      { kind: "not_reusable", reason: "artifact_indeterminate" },
      { kind: "not_reusable", reason: "path_not_canonical" },
    ];
    const response = await GET(getRequest(), { params });
    expect((await response.json()) as Record<string, unknown>).toMatchObject({
      state: "unavailable",
      reason: "artifact_indeterminate",
    });
  });

  it("segredo ausente falha fechado", async () => {
    delete process.env.FORMAT_ADDITION_CONFIRMATION_SECRET;
    const response = await GET(getRequest(), { params });
    expect(response.status).toBe(503);
    expect((await response.json()) as Record<string, unknown>).toMatchObject({
      state: "unavailable",
      reason: "confirmation_unavailable",
    });
  });
});

describe("F62-05 — POST /format-additions", () => {
  it("body inválido e token inválido são recusados", async () => {
    const invalidBody = await POST(postRequest({ format: "1:1" }), { params });
    expect(invalidBody.status).toBe(422);

    const extra = await POST(
      postRequest({
        format: "9:16",
        confirmationToken: "nope",
        operationId: "00000000-0000-4000-8000-0000000000a9",
      }),
      { params },
    );
    expect(extra.status).toBe(422);

    const invalidToken = await POST(
      postRequest({ format: "9:16", confirmationToken: "nope" }),
      { params },
    );
    expect(invalidToken.status).toBe(403);
    expect(h.run).not.toHaveBeenCalled();
  });

  it("replay delivered/refunded retorna terminal sem operação", async () => {
    for (const state of ["delivered", "refunded"] as const) {
      h.addition = { kind: "none" };
      const token = await getToken();
      h.byRequest = {
        kind: "found",
        addition: {
          state,
          sourceOrigin: "new_flow_1_1",
          refunded: state === "refunded",
          operationId: "00000000-0000-4000-8000-0000000000a2",
          requestId: "00000000-0000-4000-8000-0000000000a3",
          sourceArtifactId: null,
          sourceRegistrationOperationId: null,
          createdAt: null,
        },
      };
      const response = await POST(
        postRequest({ format: "9:16", confirmationToken: token }),
        { params },
      );
      expect(response.status).toBe(200);
      expect(h.run).not.toHaveBeenCalled();
      expect(h.continueRun).not.toHaveBeenCalled();
    }
  });

  it("retoma processing/unknown com a reserva durável, inclusive flag desligada", async () => {
    for (const state of ["processing", "unknown"] as const) {
      h.addition = { kind: "none" };
      h.additionFlag = true;
      h.byRequest = { kind: "none" };
      const token = await getToken();
      h.byRequest = {
        kind: "found",
        addition: {
          state,
          sourceOrigin: "new_flow_1_1",
          refunded: false,
          operationId: "00000000-0000-4000-8000-0000000000a2",
          requestId: "00000000-0000-4000-8000-0000000000a3",
          sourceArtifactId: null,
          sourceRegistrationOperationId: null,
          createdAt: null,
        },
      };
      h.additionFlag = false;
      h.run.mockClear();
      h.continueRun.mockClear();
      const response = await POST(
        postRequest({ format: "9:16", confirmationToken: token }),
        { params },
      );
      expect(response.status).toBe(200);
      expect(h.run).not.toHaveBeenCalled();
      expect(h.continueRun).toHaveBeenCalledTimes(1);
      expect(
        (h.continueRun.mock.calls[0] as unknown as [Record<string, unknown>])[0],
      ).toMatchObject({
        operationId: "00000000-0000-4000-8000-0000000000a2",
        requestId: expect.any(String),
      });
    }
  });

  it("replay de R1 não devolve R2 ativo", async () => {
    h.addition = { kind: "none" };
    const token = await getToken();
    h.byRequest = {
      kind: "found",
      addition: {
        state: "refunded",
        sourceOrigin: "new_flow_1_1",
        refunded: true,
        operationId: "00000000-0000-4000-8000-0000000000a2",
        requestId: "00000000-0000-4000-8000-0000000000a3",
        sourceArtifactId: null,
        sourceRegistrationOperationId: null,
        createdAt: null,
      },
    };
    h.addition = {
      kind: "found",
      addition: {
        state: "processing",
        sourceOrigin: "new_flow_1_1",
        refunded: false,
        operationId: "00000000-0000-4000-8000-0000000000b2",
        requestId: "00000000-0000-4000-8000-0000000000b3",
        sourceArtifactId: null,
        sourceRegistrationOperationId: null,
        createdAt: null,
      },
    };
    const response = await POST(
      postRequest({ format: "9:16", confirmationToken: token }),
      { params },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      state: "refunded",
      refunded: true,
    });
  });

  it("retry só é aceito quando o estado atual é refunded", async () => {
    const startToken = await getToken();
    h.addition = {
      kind: "found",
      addition: {
        state: "refunded",
        sourceOrigin: "new_flow_1_1",
        refunded: true,
        operationId: "00000000-0000-4000-8000-0000000000a2",
        requestId: "00000000-0000-4000-8000-0000000000a3",
        sourceArtifactId: null,
        sourceRegistrationOperationId: null,
        createdAt: null,
      },
    };
    const retryToken = await getToken();
    h.addition = {
      kind: "found",
      addition: {
        state: "delivered",
        sourceOrigin: "new_flow_1_1",
        refunded: false,
        operationId: "00000000-0000-4000-8000-0000000000b2",
        requestId: "00000000-0000-4000-8000-0000000000b3",
        sourceArtifactId: null,
        sourceRegistrationOperationId: null,
        createdAt: null,
      },
    };
    const rejected = await POST(
      postRequest({ format: "9:16", confirmationToken: retryToken }),
      { params },
    );
    expect(rejected.status).toBe(409);
    expect(h.run).not.toHaveBeenCalled();
    expect(startToken).toEqual(expect.any(String));
  });

  it("checksum divergente da fonte confirmada bloqueia sem run", async () => {
    const token = await getToken();
    h.source = {
      kind: "reusable",
      source: {
        origin: "new_flow_1_1",
        storeId: h.campaign.store_id,
        campaignId: h.campaign.id,
        operationId: "00000000-0000-4000-8000-0000000000a1",
        bucket: "bucket",
        storagePath: "path",
        width: 1024,
        height: 1024,
        mimeType: "image/jpeg",
        byteSize: 100,
        checksumSha256: "b".repeat(64),
      },
    };
    const response = await POST(
      postRequest({ format: "9:16", confirmationToken: token }),
      { params },
    );
    expect(response.status).toBe(409);
    expect(h.run).not.toHaveBeenCalled();
  });

  it("abertura usa checksum/requestId do token e injeta autorização/piloto reais", async () => {
    const token = await getToken();
    const verifiedPayload = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString("utf8"),
    ) as { requestId: string; sourceChecksum: string; intent: string };

    const response = await POST(
      postRequest({ format: "9:16", confirmationToken: token }),
      { params },
    );
    expect(response.status).toBe(200);
    expect((await response.json()) as Record<string, unknown>).toMatchObject({
      state: "delivered",
    });

    const [input, deps] = h.run.mock.calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(input).toMatchObject({
      campaignId: h.campaign.id,
      requestId: verifiedPayload.requestId,
      sourceOrigin: "new_flow_1_1",
      confirmedSourceChecksumSha256: verifiedPayload.sourceChecksum,
      allowNewPaidStep: true,
    });
    expect(deps).toEqual({ stub: true });
    expect(h.depsOptions).toMatchObject({
      authorizeProductFlow: expect.any(Function),
      pilotSpendResolver: expect.any(Function),
    });
    await expect(
      (h.depsOptions?.pilotSpendResolver as () => Promise<unknown>)(),
    ).resolves.toEqual({ kind: "inactive" });
  });

  it("flag off e motor off bloqueiam antes do run", async () => {
    const token = await getToken();
    h.additionFlag = false;
    expect(
      (await POST(postRequest({ format: "9:16", confirmationToken: token }), {
        params,
      })).status,
    ).toBe(403);

    h.additionFlag = true;
    h.engineFlag = false;
    expect(
      (await POST(postRequest({ format: "9:16", confirmationToken: token }), {
        params,
      })).status,
    ).toBe(503);
    expect(h.run).not.toHaveBeenCalled();
  });

  it("mapeia gate de saldo/rate do run para 402/429", async () => {
    const token = await getToken();
    h.run.mockResolvedValueOnce({
      ok: false,
      code: "gate_blocked",
      reason: "insufficient_credits",
    } as never);
    expect(
      (await POST(postRequest({ format: "9:16", confirmationToken: token }), {
        params,
      })).status,
    ).toBe(402);

    h.run.mockResolvedValueOnce({
      ok: false,
      code: "gate_blocked",
      reason: "rate_limit_exceeded",
    } as never);
    expect(
      (await POST(postRequest({ format: "9:16", confirmationToken: token }), {
        params,
      })).status,
    ).toBe(429);
  });
});
