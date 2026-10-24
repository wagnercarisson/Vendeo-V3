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
  assertVisualSignatureAdminEnvironment: (...args: unknown[]) => mockGuard(...args),
}));

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const VALID_BODY = {
  orchestratorModel: "gpt-6-luna",
  imagePreset: "sunburst_medium",
  reason: "decisÃ£o local aprovada",
  operationId: OPERATION_ID,
};

async function call(method: "GET" | "PUT" | "POST" | "DELETE", body?: unknown) {
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
    data: { success: true, config_version_id: "11111111-1111-1111-1111-111111111111" },
    error: null,
  });
  mockBuildView.mockResolvedValue({
    configured: false,
    current: null,
    combinations: Array.from({ length: 8 }),
  });
});

describe("GET /api/admin/visual-signature-model-config", () => {
  it("nega nÃ£o-admin sem ler a view", async () => {
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
  it("chama somente a RPC dedicada com reasoning low derivado e identidade canÃ´nica", async () => {
    const response = await call("PUT", VALID_BODY);

    expect(response.status).toBe(200);
    expect(mockRequireSameOrigin).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("admin_set_visual_signature_model_config_v2", {
      p_actor_id: "admin-1",
      p_orchestrator_model: "gpt-6-luna",
      p_image_preset: "sunburst_medium",
      p_reasoning_effort: "low",
      p_reason: "decisÃ£o local aprovada",
      p_operation_id: OPERATION_ID,
      p_environment_scope: "local_validation",
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

  it("erro desconhecido da RPC nÃ£o vaza mensagem bruta", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "permission denied for table x" } });

    const response = await call("PUT", VALID_BODY);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("visual_signature_model_config_write_failed");
    expect(JSON.stringify(body)).not.toContain("permission denied");
  });
});

describe("POST /api/admin/visual-signature-model-config", () => {
  it("publica a versão vigente via RPC", async () => {
    const response = await call("POST", {
      action: "publish",
      expectedConfigVersionId: "11111111-1111-1111-1111-111111111111",
      published: true,
      reason: "publicar",
      operationId: OPERATION_ID,
    });

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_publish_visual_signature_model_config", {
      p_actor_id: "admin-1",
      p_published: true,
      p_expected_config_version_id: "11111111-1111-1111-1111-111111111111",
      p_reason: "publicar",
      p_operation_id: OPERATION_ID,
      p_instance_identity: "127.0.0.1:57781",
    });
  });

  it("ativa piloto com allowlist via RPC", async () => {
    const response = await call("POST", {
      action: "activate",
      expectedConfigVersionId: "11111111-1111-1111-1111-111111111111",
      mode: "pilot",
      pilotStoreIds: ["22222222-2222-2222-2222-222222222222"],
      reason: "piloto",
      operationId: OPERATION_ID,
    });

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_activate_visual_signature_model_config", {
      p_actor_id: "admin-1",
      p_expected_config_version_id: "11111111-1111-1111-1111-111111111111",
      p_mode: "pilot",
      p_pilot_store_ids: ["22222222-2222-2222-2222-222222222222"],
      p_reason: "piloto",
      p_operation_id: OPERATION_ID,
      p_instance_identity: "127.0.0.1:57781",
    });
  });

  it("desativa por operação auditada sem exigir credencial de provider", async () => {
    mockGuard.mockReturnValue({ environment: "production", instanceIdentity: "abc123" });
    const response = await call("POST", {
      action: "activate",
      expectedConfigVersionId: "11111111-1111-1111-1111-111111111111",
      mode: "none",
      reason: "desativação autorizada",
      operationId: OPERATION_ID,
    });

    expect(response.status).toBe(200);
    expect(mockGuard).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("admin_activate_visual_signature_model_config", {
      p_actor_id: "admin-1",
      p_expected_config_version_id: "11111111-1111-1111-1111-111111111111",
      p_mode: "none",
      p_pilot_store_ids: null,
      p_reason: "desativação autorizada",
      p_operation_id: OPERATION_ID,
      p_instance_identity: "abc123",
    });
  });
});

describe("DELETE /api/admin/visual-signature-model-config", () => {
  it("reset auditado chama a RPC de reset e invalida a leitura", async () => {
    const response = await call("DELETE", {
      expectedConfigVersionId: "11111111-1111-1111-1111-111111111111",
      reason: "voltar ao herdado",
      operationId: OPERATION_ID,
    });

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_reset_visual_signature_model_config", {
      p_actor_id: "admin-1",
      p_expected_config_version_id: "11111111-1111-1111-1111-111111111111",
      p_reason: "voltar ao herdado",
      p_operation_id: OPERATION_ID,
      p_instance_identity: "127.0.0.1:57781",
    });
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("reset exige motivo, operationId e versÃ£o", async () => {
    expect((await call("DELETE", { reason: "", operationId: OPERATION_ID })).status).toBe(400);
    expect((await call("DELETE", { reason: "ok" })).status).toBe(400);
    expect(
      (await call("DELETE", { expectedConfigVersionId: "11111111-1111-1111-1111-111111111111", reason: "ok" })).status,
    ).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
