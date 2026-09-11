// @vitest-environment node
// F37.2 (tasks.md §16, 16.1/16.2/16.8/16.7): flag off/legado, gates de entrega
// preservados (download/copy → 403 em pending/regenerating) e guards da rota
// POST /api/campaign/[id]/problem-report.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireSameOrigin = vi.fn();
const mockRequireApiUser = vi.fn();
const mockRequireOwnership = vi.fn();
const mockGetCampaign = vi.fn();
const mockListArtVersions = vi.fn();
const mockIsCampaignApprovalEnabled = vi.fn();
const mockRpc = vi.fn();
const mockAnalyzeReport = vi.fn();
const mockCompleteCorrectionAnalysis = vi.fn();
const mockGenerateCorrectionV2 = vi.fn();

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: vi.fn((...args: unknown[]) => mockRequireSameOrigin(...args)),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async (...args: unknown[]) => mockRequireApiUser(...args)),
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async (...args: unknown[]) =>
    mockRequireOwnership(...args)
  ),
}));

vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: vi.fn(async (...args: unknown[]) => mockGetCampaign(...args)),
  listArtVersions: vi.fn(async (...args: unknown[]) =>
    mockListArtVersions(...args)
  ),
}));

vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: vi.fn(async () => mockIsCampaignApprovalEnabled()),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  supabaseAdmin: {
    rpc: vi.fn(async (...args: unknown[]) => mockRpc(...args)),
    storage: {
      from: vi.fn(() => ({ createSignedUrl: vi.fn() })),
    },
  },
}));

vi.mock("@/lib/campaign/correction-intent-service", () => ({
  CorrectionIntentService: class {
    analyzeReport(...args: unknown[]) {
      return mockAnalyzeReport(...args);
    }
  },
}));

vi.mock("@/lib/campaign/correction-reports", () => ({
  completeCorrectionAnalysis: vi.fn(async (...args: unknown[]) =>
    mockCompleteCorrectionAnalysis(...args)
  ),
  generateCorrectionV2: vi.fn(async (...args: unknown[]) =>
    mockGenerateCorrectionV2(...args)
  ),
}));

import { POST } from "@/app/api/campaign/[id]/problem-report/route";
import {
  computeApprovalState,
  isDeliveryReleased,
} from "@/lib/campaign/display";
import type {
  CampaignArtVersion,
  CampaignRecord,
} from "@/lib/campaign/types";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function campaignFixture(
  overrides: Partial<CampaignRecord> = {}
): CampaignRecord {
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
    operation_run_id: "run-1",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function artVersionFixture(
  overrides: Partial<CampaignArtVersion> = {}
): CampaignArtVersion {
  return {
    id: "version-1",
    campaign_id: VALID_UUID,
    version_number: 1,
    status: "pending",
    storage_path: "store-123/camp.jpg",
    asset_status: "active",
    asset_deleted_at: null,
    brief_snapshot: {},
    render_snapshot: null,
    generation_metadata: null,
    rejection_reason: null,
    correction_in_progress: false,
    created_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function createRequest(id: string, body?: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/campaign/${id}/problem-report`,
    {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        host: "localhost:3000",
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  );
}

function callPost(body?: unknown, id: string = VALID_UUID) {
  return POST(createRequest(id, body), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSameOrigin.mockImplementation(() => {});
  mockRequireApiUser.mockResolvedValue({
    userId: "owner-1",
    claims: { sub: "owner-1" },
  });
  mockRequireOwnership.mockResolvedValue(undefined);
  mockGetCampaign.mockResolvedValue(campaignFixture());
  mockListArtVersions.mockResolvedValue([]);
  mockIsCampaignApprovalEnabled.mockResolvedValue(true);
  mockRpc.mockResolvedValue({
    data: { report_id: "report-1", submission_id: "sub-1", attempt_number: 1 },
    error: null,
  });
  mockAnalyzeReport.mockResolvedValue({
    analysisState: "unclear",
    category: null,
    normalizedInstruction: null,
    guidance: "Reformule o relato.",
  });
  mockCompleteCorrectionAnalysis.mockResolvedValue(undefined);
  mockGenerateCorrectionV2.mockResolvedValue({
    success: true,
    campaignId: VALID_UUID,
    storagePath: "store-123/camp/v2.jpg",
    versionId: "version-2",
  });
});

describe("F37.2 §16 — gates de entrega (download/copy) preservados", () => {
  it("16.1 — flag off → not_enabled e flag on + zero versões → legacy (entrega imediata)", () => {
    const flagOff = computeApprovalState(
      campaignFixture(),
      [artVersionFixture()],
      false
    );
    expect(flagOff).toEqual({ status: "not_enabled" });
    expect(isDeliveryReleased(flagOff)).toBe(true);

    const legacy = computeApprovalState(campaignFixture(), [], true);
    expect(legacy).toEqual({ status: "legacy" });
    expect(isDeliveryReleased(legacy)).toBe(true);
  });

  it("16.1 — download e publication-copy aplicam o gate isDeliveryReleased → 403", () => {
    const download = readFileSync(
      path.join(process.cwd(), "src/app/api/campaign/[id]/download/route.ts"),
      "utf8"
    );
    const copy = readFileSync(
      path.join(
        process.cwd(),
        "src/app/api/campaign/[id]/publication-copy/route.ts"
      ),
      "utf8"
    );

    for (const src of [download, copy]) {
      expect(src).toContain("isDeliveryReleased");
      expect(src).toContain("status: 403");
      expect(src).toContain("Campaign pending approval");
    }
  });

  it("16.2 — regenerating (candidata ativa correction_in_progress) → gate 403", () => {
    const state = computeApprovalState(
      campaignFixture(),
      [artVersionFixture({ correction_in_progress: true })],
      true
    );

    expect(state).toEqual({ status: "regenerating" });
    expect(isDeliveryReleased(state)).toBe(false);
  });

  it("16.8 — pós-recuperação a v1 volta a pending e segue 403 até aprovação explícita", () => {
    const pending = computeApprovalState(
      campaignFixture(),
      [artVersionFixture({ correction_in_progress: false })],
      true
    );
    expect(pending).toEqual({ status: "pending" });
    expect(isDeliveryReleased(pending)).toBe(false);

    const approved = computeApprovalState(
      campaignFixture({
        approved_version_id: "version-1",
        approved_at: "2026-09-02T10:00:00Z",
      }),
      [artVersionFixture({ status: "approved" })],
      true
    );
    expect(approved).toEqual({
      status: "approved",
      approvedAt: "2026-09-02T10:00:00Z",
    });
    expect(isDeliveryReleased(approved)).toBe(true);
  });
});

describe("POST /api/campaign/[id]/problem-report — guards (16.7)", () => {
  it("CSRF inválido → 403 antes da autenticação", async () => {
    const { ForbiddenError } = await import("@/lib/auth/errors");
    mockRequireSameOrigin.mockImplementation(() => {
      throw new ForbiddenError("Cross-origin request denied");
    });

    const res = await callPost({ text: "o preço saiu cortado" });

    expect(res.status).toBe(403);
    expect(mockRequireApiUser).not.toHaveBeenCalled();
  });

  it("não autenticado → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/errors");
    mockRequireApiUser.mockRejectedValue(
      new UnauthorizedError("Usuário não autenticado")
    );

    const res = await callPost({ text: "o preço saiu cortado" });

    expect(res.status).toBe(401);
  });

  it("UUID do parâmetro inválido → 400 antes de getCampaign", async () => {
    const res = await callPost({ text: "o preço saiu cortado" }, "not-a-uuid");

    expect(res.status).toBe(400);
    expect(mockGetCampaign).not.toHaveBeenCalled();
  });

  it("campanha inexistente → 404", async () => {
    mockGetCampaign.mockResolvedValue(null);

    const res = await callPost({ text: "o preço saiu cortado" });

    expect(res.status).toBe(404);
  });

  it("sem ownership → 404 (rpc não chamado)", async () => {
    const { StoreNotFoundError } = await import("@/lib/auth/errors");
    mockRequireOwnership.mockRejectedValue(new StoreNotFoundError());

    const res = await callPost({ text: "o preço saiu cortado" });

    expect(res.status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("flag off → 403 (rpc não chamado)", async () => {
    mockIsCampaignApprovalEnabled.mockResolvedValue(false);

    const res = await callPost({ text: "o preço saiu cortado" });

    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("campanha não ready → 409 (rpc não chamado)", async () => {
    mockGetCampaign.mockResolvedValue(campaignFixture({ status: "generating" }));

    const res = await callPost({ text: "o preço saiu cortado" });

    expect(res.status).toBe(409);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("texto vazio → 400 sem criar caso e sem IA", async () => {
    const res = await callPost({ text: "   " });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockAnalyzeReport).not.toHaveBeenCalled();
  });

  it("texto só pontuação → 400 sem criar caso e sem IA", async () => {
    const res = await callPost({ text: "..." });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockAnalyzeReport).not.toHaveBeenCalled();
  });

  it("body com campo extra → 400 (zod strict)", async () => {
    const res = await callPost({ text: "o preço saiu cortado", extra: true });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it.each([
    ["already_consumed"],
    ["campaign_not_pending"],
    ["no_active_candidate"],
    ["analysis_in_progress"],
    ["rate_limit_exceeded"],
  ])("begin retorna %s → 409 (sem IA)", async (code) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: code } });

    const res = await callPost({ text: "o preço saiu cortado" });

    expect(res.status).toBe(409);
    expect(mockAnalyzeReport).not.toHaveBeenCalled();
  });

  it("blocked → 200 JSON { analysisState, guidance } (sem gerar)", async () => {
    mockAnalyzeReport.mockResolvedValue({
      analysisState: "blocked",
      category: null,
      normalizedInstruction: null,
      guidance: "Alterações de preço não são feitas por aqui.",
    });

    const res = await callPost({ text: "mude o preço para 10 reais" });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      analysisState: "blocked",
      guidance: "Alterações de preço não são feitas por aqui.",
    });
    expect(mockGenerateCorrectionV2).not.toHaveBeenCalled();
  });

  it("eligible → resposta NDJSON com phase + result (contrato do stream)", async () => {
    mockAnalyzeReport.mockResolvedValue({
      analysisState: "eligible",
      category: "truncated_element",
      normalizedInstruction: "Reenquadrar o preço cortado.",
      guidance: "Corrigindo a arte.",
    });
    mockGenerateCorrectionV2.mockImplementation(
      async (input: { onPhaseChange?: (event: unknown) => void }) => {
        input.onPhaseChange?.({ phase: "input_validation", status: "skipped" });
        input.onPhaseChange?.({ phase: "image_generation", status: "started" });
        return {
          success: true,
          campaignId: VALID_UUID,
          storagePath: "store-123/camp/v2.jpg",
          versionId: "version-2",
        };
      }
    );

    const res = await callPost({ text: "o preço saiu cortado" });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/x-ndjson");

    const text = await res.text();
    expect(text).toContain('"type":"phase"');
    expect(text).toContain('"type":"result"');
    expect(text).toContain(`"campaignUrl":"/campanhas/${VALID_UUID}"`);
    expect(mockCompleteCorrectionAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: "report-1",
        submissionId: "sub-1",
        attemptNumber: 1,
        analysisState: "eligible",
      })
    );
  });
});
