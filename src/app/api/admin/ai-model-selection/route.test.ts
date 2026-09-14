import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({ requireAdmin: () => mockRequireAdmin() }));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

const mockBuildView = vi.fn();
vi.mock("@/lib/ai/ai-model-selection-view", () => ({ buildAiModelSelectionView: () => mockBuildView() }));

const mockInvalidate = vi.fn();
vi.mock("@/lib/ai/ai-model-selection-service", () => ({ invalidateModelSelectionCache: () => mockInvalidate() }));

const operationId = "00000000-0000-0000-0000-000000000001";

function request(method: string, body: Record<string, unknown>) {
  return new NextRequest(new Request("http://localhost/api/admin/ai-model-selection", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("/api/admin/ai-model-selection", () => {
  it("GET exige admin e retorna o composer", async () => {
    mockBuildView.mockResolvedValue({ catalog: [], selections: [], defaults: {}, capabilities: [] });
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ catalog: [], selections: [], defaults: {}, capabilities: [] });

    mockRequireAdmin.mockRejectedValueOnce(new ForbiddenError());
    const denied = await GET();
    expect(denied.status).toBe(403);
    expect(mockBuildView).toHaveBeenCalledTimes(1);
  });

  it("PUT valida, preserva actor/operationId e invalida somente após RPC", async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    const { PUT } = await import("./route");
    const response = await PUT(request("PUT", {
      capability: "campaign_copy",
      provider: "openai",
      model: "gpt-4o",
      protocol: "chat-completions",
      fallback: null,
      reason: "troca operacional",
      operationId,
    }));
    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_set_ai_model_selection", expect.objectContaining({
      p_actor_id: "admin-1",
      p_operation_id: operationId,
      p_fallback_provider: null,
    }));
    expect(mockInvalidate).toHaveBeenCalledTimes(1);

    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "model_not_in_catalog" } });
    const failed = await PUT(request("PUT", {
      capability: "campaign_copy", ...{ provider: "openai", model: "gpt-4o", protocol: "chat-completions" },
      reason: "troca operacional", operationId,
    }));
    expect(failed.status).toBe(400);
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("DELETE aceita somente JSON estrito e reutiliza operationId", async () => {
    mockRpc.mockResolvedValue({ data: { success: true, reset: false }, error: null });
    const { DELETE } = await import("./route");
    const response = await DELETE(request("DELETE", { capability: "campaign_copy", reason: "restaurar", operationId }));
    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_reset_ai_model_selection", {
      p_capability: "campaign_copy",
      p_reason: "restaurar",
      p_actor_id: "admin-1",
      p_operation_id: operationId,
    });
    expect(mockInvalidate).toHaveBeenCalledTimes(1);

    const invalid = await DELETE(request("DELETE", { capability: "campaign_copy", reason: "restaurar", operationId, extra: true }));
    expect(invalid.status).toBe(400);
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
