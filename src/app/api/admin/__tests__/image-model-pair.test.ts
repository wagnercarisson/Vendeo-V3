import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const { mockRequireAdmin, mockRpc, mockBuildView, mockInvalidate } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockRpc: vi.fn(),
  mockBuildView: vi.fn(),
  mockInvalidate: vi.fn(),
}));

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

vi.mock("@/lib/ai/image-model-pair-config-view", () => ({
  buildImageModelPairConfigView: (...args: unknown[]) => mockBuildView(...args),
}));

vi.mock("@/lib/ai/image-model-pair-config-service", () => ({
  invalidateImageModelPairConfigCache: (...args: unknown[]) => mockInvalidate(...args),
}));

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";

const VALID_BODY = {
  primaryModel: "gpt-image-2.5-sunburst",
  primaryQuality: "medium",
  fallbackModel: "gpt-image-2",
  fallbackQuality: "medium",
  reason: "decisão inicial expressa",
  operationId: OPERATION_ID,
};

const RPC_RESULT = {
  success: true,
  idempotent: false,
  scope: "new_flow",
  primary_model: "gpt-image-2.5-sunburst",
  primary_quality: "medium",
  fallback_model: "gpt-image-2",
  fallback_quality: "medium",
  config_version_id: "44444444-4444-4444-8444-444444444444",
};

async function get() {
  const { GET } = await import("../image-model-pair/route");
  return GET();
}

async function put(body: unknown) {
  const { PUT } = await import("../image-model-pair/route");
  return PUT(
    new Request("http://localhost/api/admin/image-model-pair", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockRpc.mockResolvedValue({ data: RPC_RESULT, error: null });
  mockBuildView.mockResolvedValue({
    eligibleModels: ["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"],
    eligibleQualities: ["low", "medium"],
    configured: false,
    current: null,
    origin: null,
    configVersionId: null,
    pricing: null,
  });
});

describe("GET /api/admin/image-model-pair", () => {
  it("nega acesso não-admin com 403 sem consultar a view (D-05)", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await get();

    expect(res.status).toBe(403);
    expect(mockBuildView).not.toHaveBeenCalled();
  });

  it("retorna 200 com o view model para admin", async () => {
    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockBuildView).toHaveBeenCalledTimes(1);
    expect(body.configured).toBe(false);
    expect(body.eligibleModels).toContain("gpt-image-2.5-sunburst");
  });
});

describe("PUT /api/admin/image-model-pair — gravação auditada via RPC (D-04)", () => {
  it("chama a RPC auditada com todos os parâmetros, invalida o cache e retorna a config", async () => {
    const res = await put(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("admin_set_image_model_pair_config", {
      p_actor_id: "admin-1",
      p_primary_model: "gpt-image-2.5-sunburst",
      p_primary_quality: "medium",
      p_fallback_model: "gpt-image-2",
      p_fallback_quality: "medium",
      p_reason: "decisão inicial expressa",
      p_operation_id: OPERATION_ID,
    });
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
    expect(body.config).toEqual(RPC_RESULT);
  });

  it("não invalida o cache quando a RPC falha", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "invalid_quality" } });

    const res = await put(VALID_BODY);

    expect(res.status).toBe(400);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});

describe("PUT — validação Zod (T-56.1-24)", () => {
  it("rejeita motivo vazio com 400 sem chamar a RPC", async () => {
    const res = await put({ ...VALID_BODY, reason: "   " });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejeita operationId não-UUID com 400", async () => {
    const res = await put({ ...VALID_BODY, operationId: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejeita modelo fora do catálogo elegível com 400", async () => {
    const res = await put({ ...VALID_BODY, primaryModel: "dall-e-3" });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejeita qualidade fora do catálogo elegível com 400", async () => {
    const res = await put({ ...VALID_BODY, fallbackQuality: "high" });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejeita par principal idêntico ao fallback com 400", async () => {
    const res = await put({
      ...VALID_BODY,
      fallbackModel: "gpt-image-2.5-sunburst",
      fallbackQuality: "medium",
    });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejeita campo desconhecido (strict) com 400", async () => {
    const res = await put({ ...VALID_BODY, extra: true });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("PUT — mapeamento de erros da RPC", () => {
  it.each([
    "missing_reason",
    "invalid_quality",
    "model_not_in_catalog",
    "missing_operation_id",
  ])("erro de negócio %s → 400", async (code) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: code } });

    const res = await put(VALID_BODY);

    expect(res.status).toBe(400);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("erro não mapeado → 500", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });

    const res = await put(VALID_BODY);

    expect(res.status).toBe(500);
  });
});

describe("PUT — sem mutação direta pelo query builder (D-04)", () => {
  it("o handler não usa .from(\"image_model_pair_config\").insert/update", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/app/api/admin/image-model-pair/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/\.rpc\(\s*"admin_set_image_model_pair_config"/);
    expect(source).not.toMatch(/\.from\(\s*"image_model_pair_config"\)/);
    expect(source).not.toMatch(/\.insert\(/);
    expect(source).not.toMatch(/\.update\(/);
  });
});

describe("PUT — idempotência por operation_id (D-04)", () => {
  it("reenvio com o mesmo operationId retorna o mesmo resultado, sem duplicar estado", async () => {
    const idempotent = { ...RPC_RESULT, idempotent: true };
    mockRpc.mockResolvedValue({ data: idempotent, error: null });

    const first = await put(VALID_BODY);
    const second = await put(VALID_BODY);
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondBody.config).toEqual(firstBody.config);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    for (const call of mockRpc.mock.calls) {
      expect((call[1] as { p_operation_id: string }).p_operation_id).toBe(OPERATION_ID);
    }
  });

  it("403 para não-admin sem chamar a RPC nem invalidar o cache", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await put(VALID_BODY);

    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("par fora do catálogo mantém a config vigente (RPC não é chamada)", async () => {
    const res = await put({ ...VALID_BODY, fallbackModel: "dall-e-3" });

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
