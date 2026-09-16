import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const {
  mockRequireAdmin,
  mockAssertLabEnvironment,
  mockGetExperimentDetail,
  mockEstimateExperimentPlan,
} = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockAssertLabEnvironment: vi.fn(),
  mockGetExperimentDetail: vi.fn(),
  mockEstimateExperimentPlan: vi.fn(),
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
  getExperimentDetail: (...args: unknown[]) => mockGetExperimentDetail(...args),
  listScenarioVersions: vi.fn(),
  getActiveCampaignImageTarget: vi.fn(),
  listRecentExperiments: vi.fn(),
  listPendingEvaluations: vi.fn(),
  getRunDetail: vi.fn(),
}));

vi.mock("@/lib/lab/api/estimate", () => ({
  LAB_EXPERIMENT_NOT_FOUND: "experiment_not_found",
  estimateExperimentPlan: (...args: unknown[]) => mockEstimateExperimentPlan(...args),
}));

import { ForbiddenError } from "@/lib/auth/errors";
import type { LabEnvironmentReason } from "@/lib/lab/environment-guard";

/**
 * F48.1 (D11/D2/D14) — rotas de detalhe e estimativa do experimento.
 */

const EXPERIMENT_ID = "55555555-5555-4555-8555-555555555555";

const DETAIL_FIXTURE = {
  experiment: { id: EXPERIMENT_ID, name: "Exp", status: "running" },
  variants: [{ id: "variant-1", role: "baseline" }],
  scenarios: [],
  runs: [],
  evaluations: [],
  budget: { maxRuns: 6, used: 2, remaining: 4 },
};

function getDetail() {
  return import("../route").then(({ GET }) =>
    GET(new NextRequest(new Request("http://localhost/api/admin/laboratorio/experiments/x")), {
      params: Promise.resolve({ id: EXPERIMENT_ID }),
    }),
  );
}

function getEstimate() {
  return import("../estimate/route").then(({ GET }) =>
    GET(new NextRequest(new Request("http://localhost/api/admin/laboratorio/experiments/x/estimate")), {
      params: Promise.resolve({ id: EXPERIMENT_ID }),
    }),
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
  mockGetExperimentDetail.mockResolvedValue(DETAIL_FIXTURE);
  mockEstimateExperimentPlan.mockResolvedValue({
    perRun: { estimatedCostUsd: 0.05, costSource: "pricing_table" },
    perRunCoverage: "partial",
    plannedRuns: 6,
    remainingRuns: 4,
    totalEstimatedUsd: null,
    coverage: "partial",
  });
});

describe("GET /api/admin/laboratorio/experiments/[id]", () => {
  it("nega não-admin com 403 e não lê o detalhe", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError("Acesso restrito a administradores"));

    const res = await getDetail();

    expect(res.status).toBe(403);
    expect(mockGetExperimentDetail).not.toHaveBeenCalled();
  });

  it("ambiente bloqueado ⇒ 403 environment_blocked sem leitura", async () => {
    await blockEnvironment("non_local_supabase");

    const res = await getDetail();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: "environment_blocked", reason: "non_local_supabase" });
    expect(mockGetExperimentDetail).not.toHaveBeenCalled();
  });

  it("devolve o detalhe com budget restante", async () => {
    const res = await getDetail();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.budget.remaining).toBe(4);
    expect(mockGetExperimentDetail).toHaveBeenCalledWith(expect.anything(), EXPERIMENT_ID);
  });

  it("experimento ausente ⇒ 404 experiment_not_found", async () => {
    mockGetExperimentDetail.mockResolvedValue(null);

    const res = await getDetail();

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("experiment_not_found");
  });
});

describe("GET /api/admin/laboratorio/experiments/[id]/estimate", () => {
  it("nega não-admin com 403", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError("Acesso restrito a administradores"));

    const res = await getEstimate();

    expect(res.status).toBe(403);
    expect(mockEstimateExperimentPlan).not.toHaveBeenCalled();
  });

  it("ambiente bloqueado ⇒ 403 environment_blocked", async () => {
    await blockEnvironment("missing_url");

    const res = await getEstimate();

    expect(res.status).toBe(403);
    expect(mockEstimateExperimentPlan).not.toHaveBeenCalled();
  });

  it("cobertura parcial não bloqueia: 200 com coverage partial e total null", async () => {
    const res = await getEstimate();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.coverage).toBe("partial");
    expect(body.totalEstimatedUsd).toBeNull();
    expect(body.plannedRuns).toBe(6);
  });

  it("estimativa de experimento ausente ⇒ 404", async () => {
    mockEstimateExperimentPlan.mockRejectedValue(new Error("experiment_not_found"));

    const res = await getEstimate();

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("experiment_not_found");
  });
});
