import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";

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

vi.mock("@/lib/ai/nine-sixteen-expansion-model-config-view", () => ({
  buildNineSixteenExpansionConfigView: (...args: unknown[]) => mockBuildView(...args),
}));

vi.mock("@/lib/ai/nine-sixteen-expansion-model-config-service", () => ({
  invalidateNineSixteenExpansionConfigCache: (...args: unknown[]) => mockInvalidate(...args),
}));

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const CONFIG_VERSION_ID = "44444444-4444-4444-8444-444444444444";

const VALID_BODY = {
  model: "gpt-image-2.5-flare",
  quality: "medium",
  reason: "troca aprovada",
  operationId: OPERATION_ID,
};

const RPC_RESULT = {
  success: true,
  idempotent: false,
  scope: "expansion",
  model: "gpt-image-2.5-flare",
  quality: "medium",
  config_version_id: CONFIG_VERSION_ID,
};

const VIEW = {
  eligibleModels: ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"],
  eligibleQualities: ["low", "medium"],
  state: "absent",
  configured: false,
  current: null,
  configVersionId: null,
  updatedBy: null,
  updatedAt: null,
  reason: null,
  targetCoverageByCombination: {},
  readError: null,
};

async function get() {
  const { GET } = await import("../nine-sixteen-expansion-model-config/route");
  return GET();
}

async function put(body: unknown) {
  const { PUT } = await import("../nine-sixteen-expansion-model-config/route");
  return PUT(
    new Request("http://localhost/api/admin/nine-sixteen-expansion-model-config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function putRaw(raw: string) {
  const { PUT } = await import("../nine-sixteen-expansion-model-config/route");
  return PUT(
    new Request("http://localhost/api/admin/nine-sixteen-expansion-model-config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: raw,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: ADMIN_ID });
  mockRpc.mockResolvedValue({ data: RPC_RESULT, error: null });
  mockBuildView.mockResolvedValue(VIEW);
});

describe("GET /api/admin/nine-sixteen-expansion-model-config — autorização", () => {
  it("sem sessão → 401 sem ler a view", async () => {
    mockRequireAdmin.mockRejectedValue(new UnauthorizedError());

    const res = await get();

    expect(res.status).toBe(401);
    expect(mockBuildView).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("usuário autenticado não-admin → 403 sem ler a view", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await get();

    expect(res.status).toBe(403);
    expect(mockBuildView).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("GET — estado tolerante (nunca 500 por leitura)", () => {
  it("vigente → 200 com a view", async () => {
    const configured = {
      ...VIEW,
      state: "configured",
      configured: true,
      current: {
        model: "gpt-image-2.5-flare",
        quality: "medium",
        configVersionId: CONFIG_VERSION_ID,
        origin: "configured",
      },
      configVersionId: CONFIG_VERSION_ID,
      updatedBy: ADMIN_ID,
      updatedAt: "2026-11-17T12:00:00.000Z",
      reason: "troca aprovada",
      targetCoverageByCombination: {
        "gpt-image-2.5-flare|medium": {
          model: "gpt-image-2.5-flare",
          quality: "medium",
          pricingCoverage: "complete",
          missingComponents: [],
        },
      },
    };
    mockBuildView.mockResolvedValue(configured);

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockBuildView).toHaveBeenCalledTimes(1);
    expect(body.configured).toBe(true);
    expect(body.state).toBe("configured");
    expect(body.current.model).toBe("gpt-image-2.5-flare");
  });

  it("ausente → 200 com state absent e configured false", async () => {
    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.state).toBe("absent");
    expect(body.configured).toBe(false);
  });

  it("falha de leitura → 200 com readError e state read_failed (nunca ausência)", async () => {
    mockBuildView.mockResolvedValue({
      ...VIEW,
      state: "read_failed",
      readError: "nine_sixteen_expansion_config_read_failed:db_down",
    });

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.state).toBe("read_failed");
    expect(body.readError).toContain("nine_sixteen_expansion_config_read_failed");
    expect(body.state).not.toBe("absent");
  });
});

describe("PUT — autorização e ator derivado no servidor", () => {
  it("sem sessão → 401 e RPC não invocada", async () => {
    mockRequireAdmin.mockRejectedValue(new UnauthorizedError());

    const res = await put(VALID_BODY);

    expect(res.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("não-admin → 403 e RPC não invocada", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await put(VALID_BODY);

    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("p_actor_id vem de requireAdmin e nunca do corpo", async () => {
    const res = await put({
      ...VALID_BODY,
      actor: "99999999-9999-4999-8999-999999999999",
      actorId: "99999999-9999-4999-8999-999999999999",
    });

    // Chaves extras são recusadas pelo `.strict()` antes da RPC.
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();

    const ok = await put(VALID_BODY);
    expect(ok.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith("admin_set_nine_sixteen_expansion_model_config", {
      p_actor_id: ADMIN_ID,
      p_model: "gpt-image-2.5-flare",
      p_quality: "medium",
      p_reason: "troca aprovada",
      p_operation_id: OPERATION_ID,
    });
  });
});

describe("PUT — validação estrita (Zod → 400 sem RPC)", () => {
  it.each([
    ["motivo em branco", { ...VALID_BODY, reason: "   " }],
    ["qualidade high", { ...VALID_BODY, quality: "high" }],
    ["modelo gpt-image-2", { ...VALID_BODY, model: "gpt-image-2" }],
    ["modelo fora das listas", { ...VALID_BODY, model: "dall-e-3" }],
    ["operationId não-UUID", { ...VALID_BODY, operationId: "not-a-uuid" }],
    ["chave actor", { ...VALID_BODY, actor: "x" }],
    ["chave actorId", { ...VALID_BODY, actorId: "x" }],
    ["chave fallbackModel", { ...VALID_BODY, fallbackModel: "gpt-image-2.5-sunburst" }],
    ["chave productionActive", { ...VALID_BODY, productionActive: true }],
  ])("rejeita %s com 400", async (_label, body) => {
    const res = await put(body);

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("corpo não-JSON → 400 sem RPC", async () => {
    const res = await putRaw("{not-json");

    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("PUT — sucesso e invalidação de cache", () => {
  it("responde 200 com config e invalida o cache exatamente uma vez após o sucesso", async () => {
    const res = await put(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.config).toEqual(RPC_RESULT);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockInvalidate).toHaveBeenCalledTimes(1);
    // A invalidação precisa acontecer DEPOIS da RPC bem-sucedida.
    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(
      mockInvalidate.mock.invocationCallOrder[0],
    );
  });
});

describe("PUT — conflito e erros da RPC", () => {
  it.each([
    "missing_reason",
    "missing_operation_id",
    "missing_actor_id",
    "actor_not_admin",
    "invalid_model",
    "invalid_quality",
    "model_not_in_catalog",
    "model_not_in_expansion_list",
    "operation_id_conflict",
    "operation_config_conflict",
  ])("bad request %s → 400 sem invalidar o cache", async (code) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: code } });

    const res = await put(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(code);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("conflito de operationId mantém a mensagem para a UI", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "operation_id_conflict" } });

    const res = await put(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("operation_id_conflict");
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("erro desconhecido → 500 sem invalidar o cache", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });

    const res = await put(VALID_BODY);

    expect(res.status).toBe(500);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});

describe("rota — forma (somente RPC; nenhuma mutação direta)", () => {
  it("muta exclusivamente via .rpc e não expõe DELETE", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/app/api/admin/nine-sixteen-expansion-model-config/route.ts",
      ),
      "utf8",
    );
    expect(source).toMatch(/\.rpc\(\s*"admin_set_nine_sixteen_expansion_model_config"/);
    expect(source).not.toMatch(/\.from\(/);
    expect(source).not.toMatch(/\.insert\(/);
    expect(source).not.toMatch(/\.update\(/);
    expect(source).not.toMatch(/\.delete\(/);
    expect(source).not.toMatch(/export const DELETE/);
  });
});
