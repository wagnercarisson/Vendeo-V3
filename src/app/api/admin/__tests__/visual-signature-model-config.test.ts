// @vitest-environment node
// F47.3-lh9 — endpoint dedicado da Assinatura Visual (PUT/DELETE).
// Offline: require-admin/CSRF/Supabase/ambiente/view são mocks; nenhum banco.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  mockRequireAdmin,
  mockRequireSameOrigin,
  mockRpc,
  mockResolveEnvironment,
  mockBuildView,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockRpc: vi.fn(),
  mockResolveEnvironment: vi.fn(),
  mockBuildView: vi.fn(),
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

vi.mock("@/lib/visual-signature/admin-environment", () => ({
  resolveVisualSignatureAdminEnvironment: (...args: unknown[]) => mockResolveEnvironment(...args),
}));

vi.mock("@/lib/visual-signature/admin-config-view", () => ({
  buildVisualSignatureAdminConfigView: (...args: unknown[]) => mockBuildView(...args),
}));

import { ForbiddenError } from "@/lib/auth/errors";
import {
  VisualSignatureModelConfigResetSchema,
  VisualSignatureModelConfigUpdateSchema,
} from "@/lib/admin/schemas";
import {
  VISUAL_SIGNATURE_IMAGE_MODELS,
  VISUAL_SIGNATURE_IMAGE_QUALITIES,
  VISUAL_SIGNATURE_ORCHESTRATOR_MODELS,
  type VisualSignatureGenerationConfig,
} from "@/lib/visual-signature/model-config";

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const CONFIG_VERSION_ID = "22222222-2222-4222-8222-222222222222";

const VALID_BODY = {
  orchestratorModel: "gpt-5.5",
  imageModel: "gpt-image-2.5-flare",
  imageQuality: "low",
  reason: "decisão administrativa",
  operationId: OPERATION_ID,
};

const ENVIRONMENT = {
  environmentScope: "local_validation",
  instanceIdentity: "127.0.0.1:57781",
};

function dedicatedView(overrides: Partial<VisualSignatureGenerationConfig> = {}) {
  return {
    status: "dedicated",
    config: {
      orchestratorModel: "gpt-5.5",
      imageModel: "gpt-image-2.5-flare",
      imageQuality: "low",
      imagePreset: "flare_low",
      configVersionId: CONFIG_VERSION_ID,
      ...overrides,
    },
  };
}

const RPC_SUCCESS = { success: true, config_version_id: CONFIG_VERSION_ID };

async function put(body: unknown) {
  const { PUT } = await import("../visual-signature-model-config/route");
  return PUT(
    new Request("http://localhost/api/admin/visual-signature-model-config", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(body),
    }),
  );
}

async function del(body: unknown) {
  const { DELETE } = await import("../visual-signature-model-config/route");
  return DELETE(
    new Request("http://localhost/api/admin/visual-signature-model-config", {
      method: "DELETE",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockResolveEnvironment.mockReturnValue(ENVIRONMENT);
  mockRpc.mockResolvedValue({ data: RPC_SUCCESS, error: null });
  mockBuildView.mockResolvedValue(dedicatedView());
});

describe("PUT/DELETE — autorização e CSRF", () => {
  it.each(["put", "delete"] as const)("%s nega não-admin com 403 sem RPC nem releitura", async (method) => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());
    const res = method === "put" ? await put(VALID_BODY) : await del({ ...VALID_BODY, expectedConfigVersionId: CONFIG_VERSION_ID });
    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockBuildView).not.toHaveBeenCalled();
  });

  it("PUT nega cross-origin sem RPC nem releitura", async () => {
    mockRequireSameOrigin.mockImplementation(() => {
      throw new ForbiddenError();
    });
    const res = await put(VALID_BODY);
    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockBuildView).not.toHaveBeenCalled();
  });

  it("DELETE nega cross-origin sem RPC nem releitura", async () => {
    mockRequireSameOrigin.mockImplementation(() => {
      throw new ForbiddenError();
    });
    const res = await del({ expectedConfigVersionId: CONFIG_VERSION_ID, reason: "x", operationId: OPERATION_ID });
    expect(res.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockBuildView).not.toHaveBeenCalled();
  });
});

describe("PUT — schema estrito", () => {
  it.each(["environmentScope", "instanceIdentity", "actorId", "reasoningEffort", "imagePreset", "extra"])(
    "rejeita campo extra %s com 400 sem RPC",
    async (field) => {
      const res = await put({ ...VALID_BODY, [field]: "x" });
      expect(res.status).toBe(400);
      expect(mockRpc).not.toHaveBeenCalled();
    },
  );

  it("JSON inválido → 400 sem RPC", async () => {
    const { PUT } = await import("../visual-signature-model-config/route");
    const res = await PUT(
      new Request("http://localhost/api/admin/visual-signature-model-config", {
        method: "PUT",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: "{not-json",
      }),
    );
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("PUT — contrato da RPC v3 (9 argumentos)", () => {
  it("chama SOMENTE a RPC v3 com os 9 argumentos derivados", async () => {
    const res = await put(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("admin_set_visual_signature_model_config_v3", {
      p_actor_id: "admin-1",
      p_orchestrator_model: "gpt-5.5",
      p_image_model: "gpt-image-2.5-flare",
      p_image_quality: "low",
      p_reasoning_effort: "low",
      p_reason: "decisão administrativa",
      p_operation_id: OPERATION_ID,
      p_environment_scope: "local_validation",
      p_instance_identity: "127.0.0.1:57781",
    });
    expect(mockRpc.mock.calls[0][0]).not.toBe("admin_set_ai_model_selection");
    expect(body).toEqual({ saved: true, confirmed: true, view: dedicatedView() });
  });

  it.each([
    ["gpt-image-2.5-flare", "low"],
    ["gpt-image-2.5-flare", "medium"],
    ["gpt-image-2.5-sunburst", "low"],
    ["gpt-image-2.5-sunburst", "medium"],
  ] as const)("repassa a combinação %s/%s", async (imageModel, imageQuality) => {
    mockBuildView.mockResolvedValue(
      dedicatedView({
        imageModel,
        imageQuality,
        imagePreset:
          imageModel === "gpt-image-2.5-flare"
            ? imageQuality === "low"
              ? "flare_low"
              : "flare_medium"
            : imageQuality === "low"
              ? "sunburst_low"
              : "sunburst_medium",
      }),
    );
    await put({ ...VALID_BODY, imageModel, imageQuality });
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_set_visual_signature_model_config_v3",
      expect.objectContaining({ p_image_model: imageModel, p_image_quality: imageQuality }),
    );
  });

  it("nunca chama as RPCs genéricas de seleção/reset", async () => {
    await put(VALID_BODY);
    for (const call of mockRpc.mock.calls) {
      expect(call[0]).not.toBe("admin_set_ai_model_selection");
      expect(call[0]).not.toBe("admin_reset_ai_model_selection");
    }
  });

  it("falha de escrita não faz releitura", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "invalid_image_model" } });
    await put(VALID_BODY);
    expect(mockBuildView).not.toHaveBeenCalled();
  });
});

describe("PUT — confirmação por releitura", () => {
  it("releitura error → saved sem confirmed e sem view", async () => {
    mockBuildView.mockResolvedValue({ status: "error", code: "read_failed" });
    const res = await put(VALID_BODY);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ saved: true, confirmed: false, warning: "save_confirmation_failed" });
    expect(body.view).toBeUndefined();
  });

  it("releitura divergente → aviso mismatch com a view ATUAL (nunca o draft)", async () => {
    const actual = dedicatedView({
      orchestratorModel: "gpt-6-luna",
      imageModel: "gpt-image-2.5-sunburst",
      imageQuality: "medium",
      imagePreset: "sunburst_medium",
      configVersionId: "33333333-3333-4333-8333-333333333333",
    });
    mockBuildView.mockResolvedValue(actual);
    const res = await put(VALID_BODY);
    const body = await res.json();
    expect(body).toEqual({
      saved: true,
      confirmed: false,
      warning: "save_confirmation_mismatch",
      view: actual,
    });
    expect(body.view.config.orchestratorModel).toBe("gpt-6-luna");
  });

  it("mesmo trio mas versão divergente da RPC → mismatch", async () => {
    mockRpc.mockResolvedValue({ data: { success: true, config_version_id: "44444444-4444-4444-8444-444444444444" }, error: null });
    const res = await put(VALID_BODY);
    const body = await res.json();
    expect(body.confirmed).toBe(false);
    expect(body.warning).toBe("save_confirmation_mismatch");
  });
});

describe("PUT — erros", () => {
  it.each([
    "invalid_orchestrator",
    "invalid_image_model",
    "invalid_image_quality",
    "invalid_preset_tuple",
    "invalid_reasoning",
    "invalid_environment_scope",
    "orchestrator_not_in_catalog",
  ])("RPC %s → 400 allowlisted sem saved", async (code) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: code } });
    const res = await put(VALID_BODY);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body).toEqual({ error: code });
    expect(body.saved).toBeUndefined();
  });

  it("operation_id_conflict → 409", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "operation_id_conflict" } });
    const res = await put(VALID_BODY);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "operation_id_conflict" });
  });

  it("success !== true → 502 invalid_rpc_response sem releitura", async () => {
    mockRpc.mockResolvedValue({ data: { success: false }, error: null });
    const res = await put(VALID_BODY);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "invalid_rpc_response" });
    expect(mockBuildView).not.toHaveBeenCalled();
  });

  it("erro não mapeado → 500 unexpected_error sem ecoar mensagem crua", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });
    const res = await put(VALID_BODY);
    const text = JSON.stringify(await res.json());
    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: "unexpected_error" });
    expect(text).not.toContain("connection reset");
  });

  it("falha de ambiente → 500 environment_unresolved sem RPC nem releitura", async () => {
    mockResolveEnvironment.mockImplementation(() => {
      throw new Error("visual_signature_environment_config_missing");
    });
    const res = await put(VALID_BODY);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "environment_unresolved" });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockBuildView).not.toHaveBeenCalled();
  });
});

const RESET_BODY = {
  expectedConfigVersionId: CONFIG_VERSION_ID,
  reason: "remoção administrativa",
  operationId: OPERATION_ID,
};

describe("DELETE — reset dedicado (5 argumentos, sem environment)", () => {
  it("chama SOMENTE a RPC dedicada com 5 argumentos", async () => {
    mockBuildView.mockResolvedValue({ status: "legacy" });
    const res = await del(RESET_BODY);
    expect(res.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("admin_reset_visual_signature_model_config", {
      p_actor_id: "admin-1",
      p_expected_config_version_id: CONFIG_VERSION_ID,
      p_reason: "remoção administrativa",
      p_operation_id: OPERATION_ID,
      p_instance_identity: "127.0.0.1:57781",
    });
    const args = mockRpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(args).sort()).toEqual(
      [
        "p_actor_id",
        "p_expected_config_version_id",
        "p_instance_identity",
        "p_operation_id",
        "p_reason",
      ].sort(),
    );
    expect(args.p_environment_scope).toBeUndefined();
    expect(mockRpc.mock.calls[0][0]).not.toBe("admin_reset_ai_model_selection");
    expect(await res.json()).toEqual({ removed: true, confirmed: true, view: { status: "legacy" } });
  });

  it("releitura error → removed sem confirmed", async () => {
    mockBuildView.mockResolvedValue({ status: "error", code: "invalid" });
    const res = await del(RESET_BODY);
    expect(await res.json()).toEqual({
      removed: true,
      confirmed: false,
      warning: "reset_confirmation_failed",
    });
  });

  it("releitura ainda dedicated → mismatch com a view atual", async () => {
    const still = dedicatedView();
    mockBuildView.mockResolvedValue(still);
    const res = await del(RESET_BODY);
    expect(await res.json()).toEqual({
      removed: true,
      confirmed: false,
      warning: "reset_confirmation_mismatch",
      view: still,
    });
  });

  it.each(["missing_config_version_id", "missing_reason"])("RPC %s → 400", async (code) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: code } });
    const res = await del(RESET_BODY);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: code });
  });

  it.each([
    "operation_id_conflict",
    "config_missing",
    "config_version_mismatch",
    "instance_identity_mismatch",
    "deactivate_required",
  ])("RPC %s → 409", async (code) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: code } });
    const res = await del(RESET_BODY);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: code });
  });

  it("success !== true → 502 sem releitura", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const res = await del(RESET_BODY);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "invalid_rpc_response" });
    expect(mockBuildView).not.toHaveBeenCalled();
  });
});

describe("rota — invariantes estáticos", () => {
  const source = readFileSync(
    path.resolve(process.cwd(), "src/app/api/admin/visual-signature-model-config/route.ts"),
    "utf8",
  );

  it("usa apenas as RPCs dedicadas", () => {
    expect(source).toMatch(/\.rpc\(\s*"admin_set_visual_signature_model_config_v3"/);
    expect(source).toMatch(/\.rpc\(\s*"admin_reset_visual_signature_model_config"/);
  });

  it("não muta a tabela via query builder nem usa RPCs genéricas", () => {
    expect(source).not.toMatch(/\.from\(\s*"visual_signature_model_config"\)/);
    expect(source).not.toMatch(/\.insert\(/);
    expect(source).not.toMatch(/\.update\(/);
    expect(source).not.toMatch(/\.delete\(/);
    expect(source).not.toMatch(/admin_set_ai_model_selection/);
    expect(source).not.toMatch(/admin_reset_ai_model_selection/);
    expect(source).not.toMatch(/@\/lib\/product-1-1/);
  });
});

describe("paridade schema × model-config (fonte de verdade)", () => {
  it("aceita exatamente as listas VISUAL_SIGNATURE_*", () => {
    for (const orchestratorModel of VISUAL_SIGNATURE_ORCHESTRATOR_MODELS) {
      for (const imageModel of VISUAL_SIGNATURE_IMAGE_MODELS) {
        for (const imageQuality of VISUAL_SIGNATURE_IMAGE_QUALITIES) {
          const parsed = VisualSignatureModelConfigUpdateSchema.safeParse({
            orchestratorModel,
            imageModel,
            imageQuality,
            reason: "x",
            operationId: OPERATION_ID,
          });
          expect(parsed.success).toBe(true);
        }
      }
    }
    expect(
      VisualSignatureModelConfigUpdateSchema.safeParse({
        ...VALID_BODY,
        orchestratorModel: "gpt-4o",
      }).success,
    ).toBe(false);
    expect(
      VisualSignatureModelConfigResetSchema.safeParse({
        ...RESET_BODY,
        environmentScope: "production",
      }).success,
    ).toBe(false);
  });
});
