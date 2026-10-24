import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const {
  mockRequireAdmin,
  mockRequireSameOrigin,
  mockRpc,
  mockBuildView,
  mockInvalidate,
  mockGuard,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockRpc: vi.fn(),
  mockBuildView: vi.fn(),
  mockInvalidate: vi.fn(),
  mockGuard: vi.fn(),
}));

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: (...args: unknown[]) => mockRequireSameOrigin(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

vi.mock("@/lib/ai/visual-signature-model-config-view", () => ({
  buildVisualSignatureModelConfigView: (...args: unknown[]) => mockBuildView(...args),
}));

vi.mock("@/lib/ai/visual-signature-model-config-service", () => ({
  invalidateVisualSignatureModelConfigCache: (...args: unknown[]) => mockInvalidate(...args),
}));

vi.mock("@/lib/visual-signature/local-validation/guard", () => ({
  VisualSignatureValidationGuardError: class VisualSignatureValidationGuardError extends Error {
    code = "visual_signature_validation_disabled";
  },
  assertVisualSignatureValidationEnvironment: (...args: unknown[]) => mockGuard(...args),
}));

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const VALID_BODY = {
  orchestratorModel: "gpt-6-luna",
  imagePreset: "sunburst_medium",
  reason: "decisão local aprovada",
  operationId: OPERATION_ID,
};

async function call(method: "GET" | "PUT" | "DELETE", body?: unknown) {
  const route = await import("../visual-signature-model-config/route");
  if (method === "GET") return route.GET();
  return route[method](
    new Request("http://localhost/api/admin/visual-signature-model-config", {
      method,
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockRequireSameOrigin.mockReturnValue(undefined);
  mockGuard.mockReturnValue({ instanceIdentity: "127.0.0.1:57781" });
  mockRpc.mockResolvedValue({
    data: { success: true, config_version_id: "version-1" },
    error: null,
  });
  mockBuildView.mockResolvedValue({
    configured: false,
    current: null,
    combinations: Array.from({ length: 8 }),
  });
});

describe("GET /api/admin/visual-signature-model-config", () => {
  it("nega não-admin sem ler a view", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const response = await call("GET");

    expect(response.status).toBe(403);
    expect(mockBuildView).not.toHaveBeenCalled();
  });

  it("retorna a view para admin com no-store", async () => {
    const response = await call("GET");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.combinations).toHaveLength(8);
  });
});

describe("PUT /api/admin/visual-signature-model-config", () => {
  it("chama somente a RPC dedicada com reasoning low derivado e identidade canônica", async () => {
    const response = await call("PUT", VALID_BODY);

    expect(response.status).toBe(200);
    expect(mockRequireSameOrigin).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("admin_set_visual_signature_model_config", {
      p_actor_id: "admin-1",
      p_orchestrator_model: "gpt-6-luna",
      p_image_preset: "sunburst_medium",
      p_reasoning_effort: "low",
      p_reason: "decisão local aprovada",
      p_operation_id: OPERATION_ID,
      p_instance_identity: "127.0.0.1:57781",
    });
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("rejeita reasoning/modelo/qualidade/identidade vindos do cliente", async () => {
    const response = await call("PUT", {
      ...VALID_BODY,
      reasoningEffort: "high",
      imageModel: "forged",
      imageQuality: "high",
      instanceIdentity: "evil",
    });

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("exige motivo e operationId", async () => {
    expect((await call("PUT", { ...VALID_BODY, reason: "  " })).status).toBe(400);
    expect((await call("PUT", { ...VALID_BODY, operationId: "nope" })).status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("falha do guard local bloqueia antes da RPC", async () => {
    mockGuard.mockImplementation(() => {
      throw new Error("guard failed");
    });

    const response = await call("PUT", VALID_BODY);

    expect(response.status).toBe(409);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("conflito de operation_id retorna 409 seguro, sem SQL bruto", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates ... operation_id_conflict: "detail"' },
    });

    const response = await call("PUT", VALID_BODY);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("operation_id_conflict");
    expect(JSON.stringify(body)).not.toContain("duplicate key");
  });

  it("erro desconhecido da RPC não vaza mensagem bruta", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "permission denied for table x" } });

    const response = await call("PUT", VALID_BODY);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("visual_signature_model_config_write_failed");
    expect(JSON.stringify(body)).not.toContain("permission denied");
  });
});

describe("DELETE /api/admin/visual-signature-model-config", () => {
  it("reset auditado chama a RPC de reset e invalida a leitura", async () => {
    const response = await call("DELETE", {
      reason: "voltar ao herdado",
      operationId: OPERATION_ID,
    });

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_reset_visual_signature_model_config", {
      p_actor_id: "admin-1",
      p_reason: "voltar ao herdado",
      p_operation_id: OPERATION_ID,
      p_instance_identity: "127.0.0.1:57781",
    });
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("reset exige motivo e operationId", async () => {
    expect((await call("DELETE", { reason: "", operationId: OPERATION_ID })).status).toBe(400);
    expect((await call("DELETE", { reason: "ok" })).status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
