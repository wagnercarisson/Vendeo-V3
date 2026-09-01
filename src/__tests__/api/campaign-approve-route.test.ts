// @vitest-environment node
// F37.1 (tasks.md 14.1-14.4): testes da rota POST /api/campaign/[id]/approve —
// RPC transacional via fonte, mapeamento de erros, "só a candidata ativa é
// aprovável" e guards (ownership 404, flag off 403, não-ready 409, body 400).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireSameOrigin = vi.fn();
const mockRequireApiUser = vi.fn();
const mockRequireOwnership = vi.fn();
const mockGetCampaign = vi.fn();
const mockIsCampaignApprovalEnabled = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: vi.fn(() => mockRequireSameOrigin()),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => mockRequireApiUser()),
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async (storeId: string, userId: string) =>
    mockRequireOwnership(storeId, userId),
  ),
}));

vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: vi.fn(async (id: string) => mockGetCampaign(id)),
}));

vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: vi.fn(async () => mockIsCampaignApprovalEnabled()),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: vi.fn(async (...args: unknown[]) => mockRpc(...args)),
  },
}));

import { POST } from "@/app/api/campaign/[id]/approve/route";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VERSION_UUID = "660e8400-e29b-41d4-a716-446655440001";

function mockCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    store_id: "store-123",
    status: "ready",
    product_name: "Produto",
    input_snapshot: null,
    identity_snapshot: null,
    generation_metadata: null,
    render_snapshot: null,
    publication_copy_snapshot: null,
    publication_copy_current: null,
    storage_path: "store-123/camp.jpg",
    error_message: null,
    approval_status: "pending_approval",
    rejection_count: 0,
    approved_version_id: null,
    approved_at: null,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function createRequest(url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSameOrigin.mockImplementation(() => {});
  mockRequireApiUser.mockResolvedValue({ userId: "owner-1", claims: { sub: "owner-1" } });
  mockRequireOwnership.mockResolvedValue(undefined);
  mockGetCampaign.mockResolvedValue(mockCampaign());
  mockIsCampaignApprovalEnabled.mockResolvedValue(true);
  mockRpc.mockResolvedValue({ data: { success: true }, error: null });
});

describe("POST /api/campaign/[id]/approve", () => {
  it("14.1 — RPC transacional verificado por fonte (guarded update + defensivo + repontar)", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260901000002_f37_1_approve_campaign_art_version_rpc.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("version_not_found");
    expect(sql).toContain("version_campaign_mismatch");
    expect(sql).toContain("version_not_pending");
    expect(sql).toContain("version_not_active");
    expect(sql).toContain("asset_status = 'discarded'");
    expect(sql).toContain("approval_status = 'approved'");
  });

  it("14.2 — versão não-ativa → 409 e rpc chamado com os parâmetros certos", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "version_not_active" },
    });

    const res = await POST(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/approve`, {
        versionId: VERSION_UUID,
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(res.status).toBe(409);
    expect(mockRpc).toHaveBeenCalledWith("approve_campaign_art_version", {
      p_campaign_id: VALID_UUID,
      p_version_id: VERSION_UUID,
    });
  });

  it("14.2 — versão já resolvida (version_not_pending) → 409", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "version_not_pending" },
    });

    const res = await POST(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/approve`, {
        versionId: VERSION_UUID,
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(res.status).toBe(409);
  });

  it("14.3 — version_campaign_mismatch → 404", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "version_campaign_mismatch" },
    });

    const res = await POST(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/approve`, {
        versionId: VERSION_UUID,
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(res.status).toBe(404);
  });

  it("14.3 — version_not_found → 404", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "version_not_found" },
    });

    const res = await POST(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/approve`, {
        versionId: VERSION_UUID,
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(res.status).toBe(404);
  });

  it("14.3 — sucesso → 200 { campaignUrl, status: 'approved' }", async () => {
    const res = await POST(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/approve`, {
        versionId: VERSION_UUID,
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      campaignUrl: `/campanhas/${VALID_UUID}`,
      status: "approved",
    });
  });

  it("14.4 — não-dono → 404 (rpc não chamado)", async () => {
    mockRequireOwnership.mockRejectedValue(
      new (await import("@/lib/auth/errors")).StoreNotFoundError("store not found"),
    );

    const res = await POST(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/approve`, {
        versionId: VERSION_UUID,
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(res.status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("14.4 — flag off → 403 (rpc não chamado)", async () => {
    mockIsCampaignApprovalEnabled.mockResolvedValue(false);

    const res = await POST(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/approve`, {
        versionId: VERSION_UUID,
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("14.4 — campanha não ready → 409 (rpc não chamado)", async () => {
    mockGetCampaign.mockResolvedValue(mockCampaign({ status: "generating" }));

    const res = await POST(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/approve`, {
        versionId: VERSION_UUID,
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(res.status).toBe(409);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("14.4 — body inválido (versionId não é uuid) → 400", async () => {
    const res = await POST(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/approve`, {
        versionId: "not-a-uuid",
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("14.4 — UUID do parâmetro inválido → 400 antes de getCampaign", async () => {
    const res = await POST(
      createRequest("http://localhost:3000/api/campaign/not-a-uuid/approve", {
        versionId: VERSION_UUID,
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    expect(res.status).toBe(400);
    expect(mockGetCampaign).not.toHaveBeenCalled();
  });

  it("14.4 — campanha inexistente → 404", async () => {
    mockGetCampaign.mockResolvedValue(null);

    const res = await POST(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/approve`, {
        versionId: VERSION_UUID,
      }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(res.status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
