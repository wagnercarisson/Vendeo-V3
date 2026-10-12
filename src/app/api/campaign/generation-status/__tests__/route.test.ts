import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {},
  createServerClient: vi.fn(),
}));

const { mockRequireOwnership } = vi.hoisted(() => ({ mockRequireOwnership: vi.fn() }));
vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: vi.fn(() => {}) }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(() => Promise.resolve({ userId: "00000000-0000-0000-0000-000000000001" })),
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: mockRequireOwnership,
}));

const { mockGetCampaign } = vi.hoisted(() => ({ mockGetCampaign: vi.fn() }));
vi.mock("@/lib/campaign/persistence", () => ({ getCampaign: mockGetCampaign }));

const { mockQueryOperation } = vi.hoisted(() => ({ mockQueryOperation: vi.fn() }));
vi.mock("@/lib/product-1-1/orchestration/resend-query", () => ({
  queryProductOneToOneOperation: mockQueryOperation,
}));

const CAMPAIGN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OPERATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STORE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    new Request("http://localhost/api/campaign/generation-status", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCampaign.mockResolvedValue({ id: CAMPAIGN_ID, store_id: STORE_ID });
  mockRequireOwnership.mockResolvedValue(undefined);
  mockQueryOperation.mockResolvedValue({
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    state: "delivered",
    terminal: true,
    unknown: false,
    supportReference: null,
    attempts: [{ attemptNumber: 1, target: "primary" }],
    artifactUrl: "https://signed.example/art-1024.jpg",
    artifactKind: "integral",
  });
});

describe("POST /api/campaign/generation-status — reenvio somente consulta (b1b)", () => {
  it("rejeita corpo inválido (Zod estrito) ⇒ 400", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ campaignId: CAMPAIGN_ID }));
    expect(res.status).toBe(400);
    expect(mockQueryOperation).not.toHaveBeenCalled();
  });

  it("sem ownership ⇒ 403 (não consulta)", async () => {
    const { ForbiddenError } = await import("@/lib/auth/errors");
    mockRequireOwnership.mockRejectedValueOnce(new ForbiddenError("não pertence"));

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }));
    expect(res.status).toBe(403);
    expect(mockQueryOperation).not.toHaveBeenCalled();
  });

  it("campanha inexistente ⇒ 404", async () => {
    mockGetCampaign.mockResolvedValueOnce(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }));
    expect(res.status).toBe(404);
    expect(mockQueryOperation).not.toHaveBeenCalled();
  });

  it("devolve o view model PERSISTIDO verbatim e consulta com a identidade + storeId", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.operation).toMatchObject({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      state: "delivered",
      artifactUrl: "https://signed.example/art-1024.jpg",
      artifactKind: "integral",
    });
    expect(mockQueryOperation).toHaveBeenCalledWith({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });
  });

  it("F4: estado `reserved` com objeto salvo ⇒ reporta `reserved` SEM arte/URL", async () => {
    mockQueryOperation.mockResolvedValueOnce({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      state: "reserved",
      terminal: false,
      unknown: false,
      supportReference: null,
      attempts: [],
      artifactUrl: null,
      artifactKind: "integral",
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }));
    const body = await res.json();
    expect(body.operation.state).toBe("reserved");
    expect(body.operation.artifactUrl).toBeNull();
  });

  it("F4: estado `art_uploaded` com objeto salvo ⇒ reporta `art_uploaded` SEM arte/URL", async () => {
    mockQueryOperation.mockResolvedValueOnce({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      state: "art_uploaded",
      terminal: false,
      unknown: false,
      supportReference: null,
      attempts: [],
      artifactUrl: null,
      artifactKind: "integral",
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }));
    const body = await res.json();
    expect(body.operation.state).toBe("art_uploaded");
    expect(body.operation.artifactUrl).toBeNull();
  });

  it("operação inexistente ⇒ 404", async () => {
    mockQueryOperation.mockResolvedValueOnce(null);
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }));
    expect(res.status).toBe(404);
  });

  it("asserção negativa (source): a rota NÃO contém caminho de mutação/provider", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/app/api/campaign/generation-status/route.ts"),
      "utf8",
    );
    for (const forbidden of [
      "acquire",
      "reserve",
      "deliver",
      "refund",
      "recordOperationOutcome",
      "storeArtifact",
      "persistProductOneToOneSnapshot",
      "createNewFlowImageGateway",
      "runProductOneToOneGeneration",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});
