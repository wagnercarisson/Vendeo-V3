// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  campaign: {} as Record<string, unknown>,
  operation: null as Record<string, unknown> | null,
  artifact: { kind: "found", artifact: { artifactId: "artifact-1", checksumSha256: "a".repeat(64) } } as Record<string, unknown>,
  state: { state: "eligible", reason: null, refunded: false } as Record<string, unknown>,
  released: { state: "delivered", reason: null, refunded: false } as Record<string, unknown>,
  sameOriginError: null as Error | null,
  requireSameOrigin: vi.fn(),
  requireOwnership: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/api-handler", () => ({ apiHandler: (handler: unknown) => handler }));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: h.requireSameOrigin }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => ({ userId: "user-1" })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: h.requireOwnership,
}));
vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: vi.fn(async () => h.campaign),
}));
vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    async getCampaignOperation() {
      return h.operation;
    }
  },
}));
vi.mock("@/lib/campaign/square-release", () => ({
  readSquareReleaseArtifact: vi.fn(async () => h.artifact),
  readSquareReleaseStateForApi: vi.fn(async () => h.state),
  releaseSquare: vi.fn(async () => h.released),
}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { GET, POST } from "../route";

const CAMPAIGN = "00000000-0000-4000-8000-0000000000c1";
const STORE = "00000000-0000-4000-8000-0000000000b1";
const params = Promise.resolve({ id: CAMPAIGN });

function campaign(format: "1:1" | "9:16") {
  return {
    id: CAMPAIGN,
    store_id: STORE,
    status: "ready",
    input_snapshot:
      format === "9:16"
        ? {
            campaignFormat: "9:16",
            formatContractVersion: "f59-vertical-9-16-v1",
          }
        : {},
  };
}

function request(method: "GET" | "POST") {
  return new NextRequest(
    `http://localhost/api/campaign/${CAMPAIGN}/square-release`,
    { method },
  );
}

beforeEach(() => {
  h.campaign = campaign("9:16");
  h.operation = {
    status: "delivered",
    unknown: false,
    terminal: true,
    operationId: "operation-1",
  };
  h.artifact = {
    kind: "found",
    artifact: { artifactId: "artifact-1", checksumSha256: "a".repeat(64) },
  };
  h.state = { state: "eligible", reason: null, refunded: false };
  h.released = { state: "delivered", reason: null, refunded: false };
  h.sameOriginError = null;
  h.requireSameOrigin.mockReset();
  h.requireSameOrigin.mockImplementation(() => {
    if (h.sameOriginError) throw h.sameOriginError;
  });
  h.requireOwnership.mockReset();
  h.requireOwnership.mockResolvedValue({});
});

describe("API de liberação do quadrado", () => {
  it("GET em campanha 1:1 é incompatível e não lê artefato", async () => {
    h.campaign = campaign("1:1");
    const response = await GET(request("GET"), { params });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      state: "incompatible",
    });
    const { readSquareReleaseArtifact } = await import("@/lib/campaign/square-release");
    expect(readSquareReleaseArtifact).not.toHaveBeenCalled();
  });

  it("GET em 9:16 entregue devolve elegível com custo 1", async () => {
    const response = await GET(request("GET"), { params });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      state: "eligible",
      costCredits: 1,
    });
    expect(h.requireOwnership).toHaveBeenCalledWith(STORE, "user-1");
  });

  it("POST exige same-origin, ownership e delega a liberação", async () => {
    const response = await POST(request("POST"), { params });
    expect(h.requireSameOrigin).toHaveBeenCalledTimes(1);
    expect(h.requireOwnership).toHaveBeenCalledWith(STORE, "user-1");
    const { releaseSquare } = await import("@/lib/campaign/square-release");
    expect(releaseSquare).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({ state: "delivered" });
  });

  it("POST bloqueia quando a origem não é confiável", async () => {
    const forbidden = Object.assign(new Error("Cross-origin request denied"), {
      name: "ForbiddenError",
    });
    h.sameOriginError = forbidden;
    await expect(POST(request("POST"), { params })).rejects.toThrow(
      "Cross-origin request denied",
    );
  });

  it("GET propaga estado de leitura desconhecido sem cobrar", async () => {
    h.state = { state: "unknown", reason: "release_unknown", refunded: false };
    const response = await GET(request("GET"), { params });
    await expect(response.json()).resolves.toMatchObject({
      state: "unknown",
      reason: "release_unknown",
    });
  });
});
