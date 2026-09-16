import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const {
  mockRequireAdmin,
  mockAssertLabEnvironment,
  mockListScenarioVersions,
  mockListRecentExperiments,
  mockCreateExperiment,
  mockComputeReadiness,
  mockTransitionExperiment,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockAssertLabEnvironment: vi.fn(),
  mockListScenarioVersions: vi.fn(),
  mockListRecentExperiments: vi.fn(),
  mockCreateExperiment: vi.fn(),
  mockComputeReadiness: vi.fn(),
  mockTransitionExperiment: vi.fn(),
}));

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/lab/environment-guard", () => {
  class LabEnvironmentError extends Error {
    readonly reason: string;
    constructor(reason: string) {
      super(`Laboratório bloqueado: ${reason}`);
      this.name = "LabEnvironmentError";
      this.reason = reason;
    }
  }
  return {
    LabEnvironmentError,
    assertLabEnvironment: () => mockAssertLabEnvironment(),
    labEnvironmentDeniedBody: (reason: string) => ({ error: "environment_blocked", reason }),
    getLabEnvironment: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("@/lib/lab/api/experiment-queries", () => ({
  listScenarioVersions: (...args: unknown[]) => mockListScenarioVersions(...args),
  listRecentExperiments: (...args: unknown[]) => mockListRecentExperiments(...args),
  getActiveCampaignImageTarget: vi.fn(),
  listPendingEvaluations: vi.fn(),
  getExperimentDetail: vi.fn(),
  getRunDetail: vi.fn(),
}));

vi.mock("@/lib/lab/domain/experiment-service", () => ({
  createExperiment: (...args: unknown[]) => mockCreateExperiment(...args),
  computeExperimentReadiness: (...args: unknown[]) => mockComputeReadiness(...args),
  transitionExperiment: (...args: unknown[]) => mockTransitionExperiment(...args),
}));

import { ForbiddenError } from "@/lib/auth/errors";
import type { LabEnvironmentReason } from "@/lib/lab/environment-guard";
import { ModelTargetNotInCatalogError } from "@/lib/lab/domain/model-target";
import type { LabModelTarget } from "@/lib/lab/domain/schemas";

/**
 * F48.1 (D11/D2/D5/D14) — rotas de cenários e experimentos.
 * Todas as dependências externas são mockadas: nenhuma chamada de rede.
 */

const TARGET: LabModelTarget = { provider: "openai", model: "gpt-5.5", protocol: "responses" };

const VALID_PAYLOAD = {
  name: "Exp prompt",
  objective: "Comparar prompts",
  hypothesis: "A candidata vende mais",
  changedDimension: "prompt",
  modelTarget: TARGET,
  params: { size: "1024x1024", quality: "high", skipInputValidation: true },
  repetitions: 1,
  maxRuns: 6,
  scenarioVersionIds: ["22222222-2222-4222-8222-222222222222"],
  baseline: { promptName: "campaign-image-director-offer" },
  candidate: {
    promptName: "campaign-image-director-offer",
    promptContent: "Prompt candidata",
  },
};

function getScenarios() {
  return import("../scenarios/route").then(({ GET }) =>
    GET(new NextRequest(new Request("http://localhost/api/admin/laboratorio/scenarios"))),
  );
}

function getExperiments() {
  return import("../experiments/route").then(({ GET }) =>
    GET(new NextRequest(new Request("http://localhost/api/admin/laboratorio/experiments"))),
  );
}

function postExperiment(body: unknown) {
  return import("../experiments/route").then(({ POST }) =>
    POST(
      new NextRequest(
        new Request("http://localhost/api/admin/laboratorio/experiments", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
}

async function blockEnvironment(reason: LabEnvironmentReason = "disabled_flag") {
  const { LabEnvironmentError } = await import("@/lib/lab/environment-guard");
  mockAssertLabEnvironment.mockImplementation(() => {
    throw new LabEnvironmentError(reason);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockAssertLabEnvironment.mockReturnValue({
    enabled: true,
    supabaseHost: "localhost",
    local: true,
    reason: "ok",
  });
  mockListScenarioVersions.mockResolvedValue([]);
  mockListRecentExperiments.mockResolvedValue([]);
  mockComputeReadiness.mockResolvedValue({ ready: false, reasons: ["missing_scenarios"] });
});

describe("GET /api/admin/laboratorio/scenarios", () => {
  it("nega não-admin com 403 e não executa nenhuma operação", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError("Acesso restrito a administradores"));

    const res = await getScenarios();

    expect(res.status).toBe(403);
    expect(mockAssertLabEnvironment).not.toHaveBeenCalled();
    expect(mockListScenarioVersions).not.toHaveBeenCalled();
  });

  it("ambiente bloqueado ⇒ 403 environment_blocked e o serviço de leitura não é chamado", async () => {
    await blockEnvironment("non_local_supabase");

    const res = await getScenarios();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: "environment_blocked", reason: "non_local_supabase" });
    expect(mockListScenarioVersions).not.toHaveBeenCalled();
  });

  it("lista as versões de cenário quando o ambiente é permitido", async () => {
    mockListScenarioVersions.mockResolvedValue([
      { id: "sv-1", slug: "produto-oferta-preco", version: 1 },
    ]);

    const res = await getScenarios();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.scenarios).toHaveLength(1);
    expect(mockListScenarioVersions).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/admin/laboratorio/experiments", () => {
  it("nega não-admin com 403", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError("Acesso restrito a administradores"));

    const res = await getExperiments();

    expect(res.status).toBe(403);
    expect(mockListRecentExperiments).not.toHaveBeenCalled();
  });

  it("ambiente bloqueado ⇒ 403 environment_blocked sem leitura", async () => {
    await blockEnvironment("missing_url");

    const res = await getExperiments();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("environment_blocked");
    expect(mockListRecentExperiments).not.toHaveBeenCalled();
  });

  it("lista os experimentos recentes", async () => {
    mockListRecentExperiments.mockResolvedValue([{ id: "exp-1", name: "Exp" }]);

    const res = await getExperiments();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.experiments).toHaveLength(1);
  });
});

describe("POST /api/admin/laboratorio/experiments", () => {
  it("nega não-admin com 403", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError("Acesso restrito a administradores"));

    const res = await postExperiment(VALID_PAYLOAD);

    expect(res.status).toBe(403);
    expect(mockCreateExperiment).not.toHaveBeenCalled();
  });

  it("ambiente bloqueado ⇒ 403 environment_blocked sem criação", async () => {
    await blockEnvironment("remote_blocked");

    const res = await postExperiment(VALID_PAYLOAD);

    expect(res.status).toBe(403);
    expect(mockCreateExperiment).not.toHaveBeenCalled();
  });

  it("payload inválido ⇒ 400 invalid_payload e nenhuma criação", async () => {
    const res = await postExperiment({ name: "" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_payload");
    expect(mockCreateExperiment).not.toHaveBeenCalled();
  });

  it("changedDimension model ⇒ 400 unsupported_changed_dimension", async () => {
    const res = await postExperiment({ ...VALID_PAYLOAD, changedDimension: "model" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("unsupported_changed_dimension");
    expect(mockCreateExperiment).not.toHaveBeenCalled();
  });

  it("changedDimension configuration ⇒ 400 unsupported_changed_dimension", async () => {
    const res = await postExperiment({ ...VALID_PAYLOAD, changedDimension: "configuration" });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("unsupported_changed_dimension");
  });

  it("alvo fora do catálogo ⇒ 400 model_target_not_in_catalog", async () => {
    mockCreateExperiment.mockRejectedValue(new ModelTargetNotInCatalogError(TARGET));

    const res = await postExperiment(VALID_PAYLOAD);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("model_target_not_in_catalog");
  });

  it("criação válida e pronta ⇒ 201 com status ready e autor registrado", async () => {
    mockCreateExperiment.mockResolvedValue({ experimentId: "exp-1" });
    mockComputeReadiness.mockResolvedValue({ ready: true, reasons: [] });
    mockTransitionExperiment.mockResolvedValue({ status: "ready" });

    const res = await postExperiment(VALID_PAYLOAD);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({
      experimentId: "exp-1",
      status: "ready",
      readiness: { ready: true, reasons: [] },
    });
    expect(mockCreateExperiment).toHaveBeenCalledWith(expect.any(Object), {
      actorId: "admin-1",
      client: expect.anything(),
    });
    expect(mockTransitionExperiment).toHaveBeenCalledWith("exp-1", "ready", {
      actorId: "admin-1",
      client: expect.anything(),
    });
  });

  it("criação válida não pronta ⇒ 201 com status draft e os motivos", async () => {
    mockCreateExperiment.mockResolvedValue({ experimentId: "exp-2" });
    mockComputeReadiness.mockResolvedValue({
      ready: false,
      reasons: ["missing_scenarios", "model_target_not_in_catalog"],
    });

    const res = await postExperiment(VALID_PAYLOAD);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.status).toBe("draft");
    expect(body.readiness.reasons).toEqual(["missing_scenarios", "model_target_not_in_catalog"]);
    expect(mockTransitionExperiment).not.toHaveBeenCalled();
  });
});
