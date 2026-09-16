import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const { mockRequireAdmin, mockAssertLabEnvironment, mockCreateEvaluation } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockAssertLabEnvironment: vi.fn(),
  mockCreateEvaluation: vi.fn(),
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

vi.mock("@/lib/lab/api/evaluation-service", () => {
  class InvalidComparisonRunsError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.name = "InvalidComparisonRunsError";
      this.code = code;
    }
  }
  return {
    InvalidComparisonRunsError,
    createEvaluation: (...args: unknown[]) => mockCreateEvaluation(...args),
  };
});

import { ForbiddenError } from "@/lib/auth/errors";
import type { InvalidComparisonRunsCode } from "@/lib/lab/api/evaluation-service";
import type { LabEnvironmentReason } from "@/lib/lab/environment-guard";

/**
 * F48.1 (D11/D13) — rota de registro da avaliação humana.
 */

const EXPERIMENT_ID = "55555555-5555-4555-8555-555555555555";
const SCENARIO_VERSION_ID = "22222222-2222-4222-8222-222222222222";
const BASELINE_RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CANDIDATE_RUN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const VALID_BODY = {
  scenarioVersionId: SCENARIO_VERSION_ID,
  baselineRunId: BASELINE_RUN_ID,
  candidateRunId: CANDIDATE_RUN_ID,
  verdict: "candidate",
  blindOrder: "candidate_left",
  observation: "Candidata mais legível",
};

function postEvaluation(body: unknown) {
  return import("../route").then(({ POST }) =>
    POST(
      new NextRequest(
        new Request("http://localhost/api/admin/laboratorio/experiments/x/evaluations", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }),
      ),
      { params: Promise.resolve({ id: EXPERIMENT_ID }) },
    ),
  );
}

async function blockEnvironment(reason: LabEnvironmentReason = "disabled_flag") {
  const { LabEnvironmentError } = await import("@/lib/lab/environment-guard");
  mockAssertLabEnvironment.mockImplementation(() => {
    throw new LabEnvironmentError(reason);
  });
}

async function invalidComparison(code: InvalidComparisonRunsCode) {
  const { InvalidComparisonRunsError } = await import("@/lib/lab/api/evaluation-service");
  return new InvalidComparisonRunsError(code);
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
  mockCreateEvaluation.mockResolvedValue({
    evaluationId: "eval-1",
    createdAt: "2026-09-16T00:00:00.000Z",
  });
});

describe("POST /api/admin/laboratorio/experiments/[id]/evaluations", () => {
  it("nega não-admin com 403 e não registra nada", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError("Acesso restrito a administradores"));

    const res = await postEvaluation(VALID_BODY);

    expect(res.status).toBe(403);
    expect(mockCreateEvaluation).not.toHaveBeenCalled();
  });

  it("ambiente bloqueado ⇒ 403 environment_blocked sem registro", async () => {
    await blockEnvironment("remote_blocked");

    const res = await postEvaluation(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: "environment_blocked", reason: "remote_blocked" });
    expect(mockCreateEvaluation).not.toHaveBeenCalled();
  });

  it("payload inválido ⇒ 400 invalid_payload sem registro", async () => {
    const res = await postEvaluation({ ...VALID_BODY, verdict: "invalido" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_payload");
    expect(mockCreateEvaluation).not.toHaveBeenCalled();
  });

  it("runs iguais ⇒ 400 invalid_payload (ids precisam ser distintos)", async () => {
    const res = await postEvaluation({ ...VALID_BODY, candidateRunId: BASELINE_RUN_ID });

    expect(res.status).toBe(400);
    expect(mockCreateEvaluation).not.toHaveBeenCalled();
  });

  it("invalid_comparison_runs ⇒ 400 com o código do serviço", async () => {
    mockCreateEvaluation.mockRejectedValue(await invalidComparison("invalid_comparison_runs"));

    const res = await postEvaluation(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_comparison_runs");
  });

  it("runs_not_terminal ⇒ 400 com o código do serviço", async () => {
    mockCreateEvaluation.mockRejectedValue(await invalidComparison("runs_not_terminal"));

    const res = await postEvaluation(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("runs_not_terminal");
  });

  it("sucesso ⇒ 201 com a avaliação e o avaliador vindo do admin", async () => {
    const res = await postEvaluation(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({
      evaluationId: "eval-1",
      createdAt: "2026-09-16T00:00:00.000Z",
    });
    expect(mockCreateEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        experimentId: EXPERIMENT_ID,
        evaluatorId: "admin-1",
        input: expect.objectContaining({
          baselineRunId: BASELINE_RUN_ID,
          candidateRunId: CANDIDATE_RUN_ID,
          blindOrder: "candidate_left",
        }),
      }),
    );
  });
});
